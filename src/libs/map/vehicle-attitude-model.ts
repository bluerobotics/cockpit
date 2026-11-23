import {
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'

import { idlePropellerSpeed } from '@/libs/vehicle/propeller-spin'
import {
  bodyBounds,
  disposeObject,
  loadModel,
  materialsOf,
  prepareMaterials,
  propellersOf,
  roomEnvironment,
} from '@/libs/vehicle/vehicle-model'

/**
 * A vehicle model drawn from straight above, tilted to the vehicle's roll and pitch.
 */
export interface VehicleAttitudeRenderer {
  /**
   * Renders the vehicle at an attitude and copies the frame into every target canvas.
   * @param {number} roll - Roll in radians, positive with the right side down.
   * @param {number} pitch - Pitch in radians, positive with the nose up.
   * @param {Iterable<HTMLCanvasElement>} targets - Canvases the frame is copied into, scaled to their size.
   * @param {number} spinSeconds - Time the propellers turn for since the last frame, 0 to leave them still.
   */
  draw: (roll: number, pitch: number, targets: Iterable<HTMLCanvasElement>, spinSeconds: number) => void
  /**
   * Whether the model has propellers to spin.
   */
  hasPropellers: boolean
  /**
   * Releases the renderer and every GPU resource the vehicle holds.
   */
  dispose: () => void
}

// glTF models face +Z with +Y up, which leaves their right side towards -X.
const forwardAxis = new Vector3(0, 0, 1)
const rightAxis = new Vector3(-1, 0, 0)

const fieldOfViewDegrees = 35

// At marker size the quadcopter's blue shell washes out against map imagery, and its black parts reflect the studio
// lighting enough to read as grey, so the marker darkens the shell and propellers and draws the black parts matte. Its
// camera is left out, since from above it stretches the nose into a bottle neck.
const darkenedMaterials: Record<string, number> = { 'blue shell': 0.8, 'propeller grey': 0.3 }
const matteBlackMaterials = new Set(['black hdpe', 'carbon fiber', 'motor top', 'propeller grey'])
const hiddenMaterials = new Set(['camera housing', 'camera lens'])

const adjustMaterialsForMap = (model: Object3D): void => {
  const materials = new Set<Material>()
  model.traverse((object) => materialsOf(object).forEach((material) => materials.add(material)))
  materials.forEach((material) => {
    const standard = material as MeshStandardMaterial
    const factor = darkenedMaterials[material.name]
    if (factor !== undefined) standard.color?.multiplyScalar(factor)
    if (matteBlackMaterials.has(material.name)) Object.assign(standard, { envMapIntensity: 0, roughness: 1 })
    if (hiddenMaterials.has(material.name)) material.visible = false
  })
}

// The quadcopter's GPS puck, mast and mount share materials with the frame, so they are cut out by where they sit:
// on the centreline, behind the end of the body.
const quadcopterNodeName = 'Quadcopter'
const gpsAntennaBounds = new Box3(new Vector3(-0.025, 0.02, -0.175), new Vector3(0.025, 0.1, -0.1))

const removeGpsAntenna = (model: Object3D): void => {
  const vertex = new Vector3()
  model.getObjectByName(quadcopterNodeName)?.traverse((object) => {
    const geometry = (object as Partial<Mesh>).geometry
    const index = geometry?.index
    if (!geometry || !index) return
    const position = geometry.getAttribute('position')
    const inAntenna = (corner: number): boolean =>
      gpsAntennaBounds.containsPoint(vertex.fromBufferAttribute(position, index.getX(corner)))
    const kept: number[] = []
    for (let corner = 0; corner < index.count; corner += 3) {
      if (inAntenna(corner) && inAntenna(corner + 1) && inAntenna(corner + 2)) continue
      kept.push(index.getX(corner), index.getX(corner + 1), index.getX(corner + 2))
    }
    if (kept.length < index.count) geometry.setIndex(kept)
  })
}

const framingMargin = 1.15

/**
 * Orientation of a glTF model at a roll and pitch, applied in the aerospace order (pitch, then roll about the
 * pitched forward axis).
 * @param {number} roll - Roll in radians, positive with the right side down.
 * @param {number} pitch - Pitch in radians, positive with the nose up.
 * @returns {Quaternion} The model's orientation.
 */
const attitudeQuaternion = (roll: number, pitch: number): Quaternion =>
  new Quaternion().setFromAxisAngle(rightAxis, pitch).multiply(new Quaternion().setFromAxisAngle(forwardAxis, roll))

/**
 * Loads a vehicle model and prepares a top-down view of it, nose towards the top of the frame.
 * @param {string} modelUrl - URL of the Draco-compressed glTF model.
 * @param {number} sizePx - Width and height of the rendered frame, in device pixels.
 * @param {() => void} onContextLost - Called if the WebGL context is lost, after which the renderer draws nothing.
 * @returns {Promise<VehicleAttitudeRenderer>} The renderer, once the model has loaded.
 */
export const createVehicleAttitudeRenderer = async (
  modelUrl: string,
  sizePx: number,
  onContextLost: () => void
): Promise<VehicleAttitudeRenderer> => {
  const model = await loadModel(modelUrl)
  prepareMaterials(model)
  adjustMaterialsForMap(model)
  removeGpsAntenna(model)

  const bounds = bodyBounds(model)
  model.position.sub(bounds.getCenter(new Vector3()))
  const size = bounds.getSize(new Vector3())
  const radius = size.length() / 2

  const propellers = propellersOf(model)
  const pivot = new Group().add(model)
  // Lit mostly from above, so a tilted vehicle shows a bright side rising towards the camera and a darker one sinking.
  const sun = new DirectionalLight(0xffffff, 2)
  sun.position.set(0, 1, 0)
  const scene = new Scene().add(pivot, sun, new AmbientLight(0xffffff, 0.3))

  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.addEventListener('webglcontextlost', onContextLost)
  renderer.setSize(sizePx, sizePx, false)
  scene.environment = roomEnvironment(renderer)
  scene.environmentIntensity = 0.5

  const camera = new PerspectiveCamera(fieldOfViewDegrees, 1)
  // Frames the top of the body with a margin for the corners a tilt swings outwards.
  const halfFootprint = (Math.max(size.x, size.z) / 2) * framingMargin
  const distance = size.y / 2 + halfFootprint / Math.tan(((fieldOfViewDegrees / 2) * Math.PI) / 180)
  camera.position.set(0, distance, 0)
  camera.up.copy(forwardAxis)
  camera.lookAt(0, 0, 0)
  camera.near = distance - radius * 1.5
  camera.far = distance + radius * 1.5
  camera.updateProjectionMatrix()

  return {
    hasPropellers: propellers.length > 0,
    draw: (roll, pitch, targets, spinSeconds) => {
      propellers.forEach(({ node, spin }) => node.rotateY(spin * idlePropellerSpeed * spinSeconds))
      pivot.quaternion.copy(attitudeQuaternion(roll, pitch))
      renderer.render(scene, camera)
      for (const target of targets) {
        const context = target.getContext('2d')
        context?.clearRect(0, 0, target.width, target.height)
        context?.drawImage(renderer.domElement, 0, 0, target.width, target.height)
      }
    },
    dispose: () => {
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      disposeObject(scene)
      scene.environment?.dispose()
      renderer.dispose()
    },
  }
}
