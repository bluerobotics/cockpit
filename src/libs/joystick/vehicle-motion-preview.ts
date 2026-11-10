import {
  type Material,
  type Object3D,
  Box3,
  DirectionalLight,
  GridHelper,
  Group,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShadowMaterial,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import dracoWasmUrl from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url'
import dracoWrapperUrl from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import type { VehicleMotion } from '@/libs/joystick/stick-modes'

/**
 * A rendered vehicle that acts out the motions a stick commands.
 */
export interface VehicleMotionPreview {
  /**
   * Moves the vehicle one body length along a linear motion, or 30 degrees about a rotational one, and back to rest.
   */
  play: (motion: VehicleMotion, direction: number) => void
  /**
   * Stops the animation and releases the renderer and every GPU resource the vehicle holds.
   */
  dispose: () => void
}

/**
 * One command of a motion, played out to its full amplitude and back.
 */
interface MotionAnimation {
  /**
   * Motion being played.
   */
  motion: VehicleMotion
  /**
   * 1 for the positive direction of the motion, -1 for the opposite one.
   */
  direction: number
  /**
   * When the motion started, on the `performance.now()` clock.
   */
  start: number
}

const rotationAmplitude = Math.PI / 6
const motionDurationMs = 1600
const framingMargin = 1.1
const idlePropellerSpeed = (390 * 2 * Math.PI) / 60
const commandedPropellerSpeedFactor = 1.5
const idleFrameIntervalMs = 1000 / 30

// glTF models face +Z with +Y up, which leaves their right side towards -X. Turning right is clockwise seen from above,
// so a negative turn about +Y.
const motionAxes: Record<VehicleMotion, Vector3> = {
  surge: new Vector3(0, 0, 1),
  sway: new Vector3(-1, 0, 0),
  heave: new Vector3(0, 1, 0),
  yaw: new Vector3(0, -1, 0),
}

// Looking from above the vehicle's left front quarter, so its nose faces the viewer: forward reads down and to the left
// on screen, and right reads up and to the left.
const isometricDirection = new Vector3(1, 1, 1).normalize()

const materialsOf = (object: Object3D): Material[] =>
  ([] as Material[]).concat((object as Partial<Mesh>).material ?? [])

const disposeObject = (root: Object3D): void => {
  root.traverse((object) => {
    ;(object as Partial<Mesh>).geometry?.dispose()
    materialsOf(object).forEach((material) => {
      Object.values(material).forEach((value) => value instanceof Texture && value.dispose())
      material.dispose()
    })
  })
}

const enclosureOpacity = 0.35

// Only the acrylic of the enclosure and the light lenses reads as see-through, so every other part is drawn solid.
const prepareMaterials = (model: Object3D): void => {
  model.traverse((object) => {
    materialsOf(object).forEach((material) => {
      const acrylic = material.name.toLowerCase().includes('acrilic')
      material.transparent = acrylic
      material.opacity = acrylic ? enclosureOpacity : 1
      material.depthWrite = !acrylic
    })
  })
}

// The BlueROV2 tether trails well behind the frame, so it is left out of the body the motions are scaled by.
const tetherNodeName = 'BezierCurve012'

const bodyBounds = (model: Object3D): Box3 => {
  const bounds = new Box3()
  const visit = (object: Object3D): void => {
    if (object.name === tetherNodeName) return
    if ((object as Partial<Mesh>).isMesh) bounds.expandByObject(object)
    object.children.forEach(visit)
  }
  model.updateWorldMatrix(true, true)
  visit(model)
  return bounds
}

/**
 * A propeller of the model, turning about its hub.
 */
interface Propeller {
  /**
   * Node holding the propeller, with its origin on the hub and its Y axis along the shaft.
   */
  node: Object3D
  /**
   * 1 when it turns counter-clockwise seen from above, -1 when clockwise.
   */
  spin: number
}

// Models mark their propellers with nodes named `propeller-cw-*` or `propeller-ccw-*`, for the rotation seen from above.
const propellersOf = (model: Object3D): Propeller[] => {
  const propellers: Propeller[] = []
  model.traverse((node) => {
    const rotation = /^propeller-(cw|ccw)-/.exec(node.name)?.[1]
    if (rotation !== undefined) propellers.push({ node, spin: rotation === 'ccw' ? 1 : -1 })
  })
  return propellers
}

const loadModel = async (url: string): Promise<Object3D> => {
  const draco = new DRACOLoader().setDecoderPath({ js: dracoWrapperUrl, wasm: dracoWasmUrl })
  try {
    return (await new GLTFLoader().setDRACOLoader(draco).loadAsync(url)).scene
  } finally {
    draco.dispose()
  }
}

type MotionOffsets = Partial<Record<VehicleMotion, number>>

const linearMotions = ['surge', 'sway', 'heave'] as const

const offsetOf = (offsets: MotionOffsets, motion: VehicleMotion): number =>
  Math.min(1, Math.max(-1, offsets[motion] ?? 0))

// Linear motions are along the body axes, so they follow the heading the yaw has turned the vehicle to.
const poseMatrix = (size: Vector3, offsets: MotionOffsets): Matrix4 => {
  const rotation = new Quaternion().setFromAxisAngle(motionAxes.yaw, rotationAmplitude * offsetOf(offsets, 'yaw'))
  const translation = linearMotions.reduce(
    (sum, motion) =>
      sum.addScaledVector(motionAxes[motion], Math.abs(motionAxes[motion].dot(size)) * offsetOf(offsets, motion)),
    new Vector3()
  )
  return new Matrix4().compose(translation.applyQuaternion(rotation), rotation, new Vector3(1, 1, 1))
}

// Every corner of the whole model at rest and at each combination of extremes it can be driven to, so the camera
// frames all of them at once.
const framingPoints = (extent: Box3, size: Vector3, motions: VehicleMotion[]): Vector3[] => {
  const { min, max } = extent
  const corners = [min.x, max.x].flatMap((x) =>
    [min.y, max.y].flatMap((y) => [min.z, max.z].map((z) => new Vector3(x, y, z)))
  )
  const poses = motions.reduce<MotionOffsets[]>(
    (all, motion) => all.flatMap((offsets) => [-1, 0, 1].map((offset) => ({ ...offsets, [motion]: offset }))),
    [{}]
  )
  return poses.flatMap((offsets) => {
    const pose = poseMatrix(size, offsets)
    return corners.map((corner) => corner.clone().applyMatrix4(pose))
  })
}

/**
 * Renders a vehicle model inside a host element, seen in isometric projection, ready to act out stick motions.
 * @param {HTMLElement} host - Element the canvas fills; it should be sized by its container, not by its content.
 * @param {string} modelUrl - URL of the Draco-compressed glTF model to show.
 * @param {VehicleMotion[]} motions - Motions the vehicle can be asked to play, which the camera leaves room for.
 * @returns {Promise<VehicleMotionPreview>} The preview, once the model has loaded.
 */
export const createVehicleMotionPreview = async (
  host: HTMLElement,
  modelUrl: string,
  motions: VehicleMotion[]
): Promise<VehicleMotionPreview> => {
  const model = await loadModel(modelUrl)
  prepareMaterials(model)

  const bounds = bodyBounds(model)
  const size = bounds.getSize(new Vector3())
  model.position.sub(bounds.getCenter(new Vector3()))
  const extent = new Box3().setFromObject(model)

  const pivot = new Group().add(model)
  const scene = new Scene().add(pivot)

  const points = framingPoints(extent, size, motions)
  const reach = Math.max(...points.map((point) => Math.max(Math.abs(point.x), Math.abs(point.z))))
  const floor = new GridHelper(reach * 3, 12, 0xffffff, 0xffffff)
  materialsOf(floor).forEach((material) => {
    material.transparent = true
    material.opacity = 0.15
  })
  floor.position.y = extent.min.y - (motions.includes('heave') ? size.y : 0)
  scene.add(floor)

  // Lit from straight above, so the shadow stays under the vehicle and the gap to it shows how far it rose or sank.
  const sunHeight = extent.max.y + size.y + reach
  const sun = new DirectionalLight(0xffffff, 0.6)
  sun.position.set(0, sunHeight, 0)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.radius = 4
  const shadowReach = reach * 1.5
  Object.assign(sun.shadow.camera, {
    left: -shadowReach,
    right: shadowReach,
    top: shadowReach,
    bottom: -shadowReach,
    near: 0.01,
    far: sunHeight - floor.position.y + 1,
  })
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)
  model.traverse((object) => {
    object.castShadow = true
  })

  const shadowFloor = new Mesh(new PlaneGeometry(reach * 3, reach * 3), new ShadowMaterial({ opacity: 0.35 }))
  shadowFloor.rotation.x = -Math.PI / 2
  shadowFloor.position.y = floor.position.y - size.y * 0.01
  shadowFloor.receiveShadow = true
  scene.add(shadowFloor)

  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true
  host.appendChild(renderer.domElement)

  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  scene.environment = pmrem.fromScene(room, 0.04).texture
  room.dispose()
  pmrem.dispose()

  const distance = reach * 10
  const camera = new OrthographicCamera()
  camera.position.copy(isometricDirection).multiplyScalar(distance)
  camera.lookAt(0, 0, 0)
  camera.near = 0.01
  camera.far = distance * 2
  // Framing every combined extreme leaves the vehicle small at rest, so zoom in and let the furthest combinations clip.
  camera.zoom = 1.8
  camera.updateMatrixWorld()
  const projected = points.map((point) => point.clone().applyMatrix4(camera.matrixWorldInverse))
  const halfWidth = Math.max(...projected.map((point) => Math.abs(point.x)))
  const halfHeight = Math.max(...projected.map((point) => Math.abs(point.y)))

  const render = (): void => renderer.render(scene, camera)

  const resize = (): void => {
    const { clientWidth: width, clientHeight: height } = host
    if (width === 0 || height === 0) return
    const aspect = width / height
    const top = Math.max(halfHeight, halfWidth / aspect) * framingMargin
    Object.assign(camera, { top, bottom: -top, left: -top * aspect, right: top * aspect })
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  // Each command plays as its own pulse and the pulses add up, so motions commanded one after another combine instead
  // of the newer one cutting the older one short.
  let animations: MotionAnimation[] = []
  let frame: number | undefined
  let lastTick: number | undefined

  // Propellers keep turning while the vehicle rests, so a model that has them keeps being drawn.
  const propellers = propellersOf(model)

  const tick = (now: number): void => {
    animations = animations.filter((animation) => now - animation.start < motionDurationMs)
    // ponytail: the idle spin redraws the shadowed scene at 30 fps; freeze the shadow map while idle if that costs too much.
    if (animations.length === 0 && lastTick !== undefined && now - lastTick < idleFrameIntervalMs) {
      frame = requestAnimationFrame(tick)
      return
    }
    const offsets: MotionOffsets = {}
    animations.forEach(({ motion, direction, start }) => {
      // Out to the full amplitude and back, easing away from rest, through the turn and into rest again.
      const pulse = 0.5 - 0.5 * Math.cos((2 * Math.PI * (now - start)) / motionDurationMs)
      offsets[motion] = (offsets[motion] ?? 0) + direction * pulse
    })
    poseMatrix(size, offsets).decompose(pivot.position, pivot.quaternion, pivot.scale)
    const elapsedSeconds = lastTick === undefined ? 0 : (now - lastTick) / 1000
    const speed = idlePropellerSpeed * (animations.length > 0 ? commandedPropellerSpeedFactor : 1)
    propellers.forEach(({ node, spin }) => node.rotateY(spin * speed * elapsedSeconds))
    lastTick = now
    render()
    frame = animations.length > 0 || propellers.length > 0 ? requestAnimationFrame(tick) : undefined
  }
  if (propellers.length > 0) frame = requestAnimationFrame(tick)

  return {
    play: (motion, direction) => {
      if (direction === 0) return
      animations.push({ motion, direction, start: performance.now() })
      frame ??= requestAnimationFrame(tick)
    },
    dispose: () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      animations = []
      observer.disconnect()
      disposeObject(scene)
      sun.shadow.dispose()
      scene.environment?.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
