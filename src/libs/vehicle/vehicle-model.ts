import { type Material, type Object3D, type WebGLRenderer, Box3, Mesh, PMREMGenerator, Texture } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import dracoWasmUrl from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url'
import dracoWrapperUrl from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Every material a node draws with, whether it holds one or several.
 * @param {Object3D} object - Node of a loaded model.
 * @returns {Material[]} Its materials, empty when it draws nothing.
 */
export const materialsOf = (object: Object3D): Material[] =>
  ([] as Material[]).concat((object as Partial<Mesh>).material ?? [])

/**
 * Releases the geometry, materials and textures of every node under a root.
 * @param {Object3D} root - Node whose subtree is released.
 */
export const disposeObject = (root: Object3D): void => {
  root.traverse((object) => {
    ;(object as Partial<Mesh>).geometry?.dispose()
    materialsOf(object).forEach((material) => {
      Object.values(material).forEach((value) => value instanceof Texture && value.dispose())
      material.dispose()
    })
  })
}

const enclosureOpacity = 0.35

/**
 * Draws every part of a model solid except the acrylic of the enclosure and the light lenses, which read as see-through.
 * @param {Object3D} model - Loaded vehicle model.
 */
export const prepareMaterials = (model: Object3D): void => {
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

/**
 * Bounds of a model's body, leaving the tether out.
 * @param {Object3D} model - Loaded vehicle model.
 * @returns {Box3} The box around every mesh but the tether.
 */
export const bodyBounds = (model: Object3D): Box3 => {
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
 * Loads a Draco-compressed glTF model.
 * @param {string} url - URL of the model.
 * @returns {Promise<Object3D>} The model's scene root.
 */
export const loadModel = async (url: string): Promise<Object3D> => {
  const draco = new DRACOLoader().setDecoderPath({ js: dracoWrapperUrl, wasm: dracoWasmUrl })
  try {
    return (await new GLTFLoader().setDRACOLoader(draco).loadAsync(url)).scene
  } finally {
    draco.dispose()
  }
}

/**
 * Builds the soft studio lighting the vehicle materials reflect.
 * @param {WebGLRenderer} renderer - Renderer the environment map is made for.
 * @returns {Texture} The environment map, to be disposed with the scene.
 */
export const roomEnvironment = (renderer: WebGLRenderer): Texture => {
  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const texture = pmrem.fromScene(room, 0.04).texture
  room.dispose()
  pmrem.dispose()
  return texture
}

/**
 * A propeller of the model, turning about its hub.
 */
export interface Propeller {
  /**
   * Node holding the propeller, with its origin on the hub and its Y axis along the shaft.
   */
  node: Object3D
  /**
   * 1 when it turns counter-clockwise seen from above, -1 when clockwise.
   */
  spin: number
}

/**
 * Finds the propellers of a model, which marks them with nodes named `propeller-cw-*` or `propeller-ccw-*` for the
 * rotation seen from above.
 * @param {Object3D} model - Loaded vehicle model.
 * @returns {Propeller[]} Its propellers, empty when it has none.
 */
export const propellersOf = (model: Object3D): Propeller[] => {
  const propellers: Propeller[] = []
  model.traverse((node) => {
    const rotation = /^propeller-(cw|ccw)-/.exec(node.name)?.[1]
    if (rotation !== undefined) propellers.push({ node, spin: rotation === 'ccw' ? 1 : -1 })
  })
  return propellers
}
