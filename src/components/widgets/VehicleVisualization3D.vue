<template>
  <div class="main">
    <div ref="canvasContainer" class="canvas-container" />
    <div v-if="!modelLoaded && !loadError" class="loading-overlay">
      <v-progress-circular indeterminate color="white" />
      <span class="loading-text">Loading 3D model...</span>
    </div>
    <div v-if="loadError" class="error-overlay">
      <v-icon color="red">mdi-alert-circle</v-icon>
      <span class="error-text">{{ loadError }}</span>
    </div>
    <div ref="controlsContainer" class="controls-panel"></div>
  </div>

  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
    <v-card class="px-8 pb-6 pt-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">3D Vehicle Visualization Config</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="modelPath"
          label="Model Path (GLB/GLTF file)"
          hint="Path to your .glb or .gltf model file (e.g., /models/vehicle.glb)"
          persistent-hint
          class="mb-4"
          @update:model-value="reloadModel"
        />

        <v-slider
          v-model="cameraHeight"
          label="Camera Y Position"
          min="1"
          max="50"
          step="0.5"
          thumb-label
          class="mb-4"
        />

        <v-slider
          v-model="cameraDistance"
          label="Camera Z Position"
          min="1"
          max="50"
          step="1"
          thumb-label
          class="mb-4"
        />
        <v-slider
          v-model="frustumSize"
          label="Zoom (Frustum Size)"
          min="1"
          max="50"
          step="1"
          thumb-label
          class="mb-4"
        />

        <v-switch v-model="autoRotate" label="Auto Rotate" class="mb-4" />

        <v-switch v-model="showGrid" label="Show Grid Helper" class="mb-4" />

        <v-expansion-panels theme="dark">
          <v-expansion-panel class="bg-[#FFFFFF11] text-white mt-2">
            <v-expansion-panel-title>Lighting & Environment</v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-slider
                v-model="ambientLightIntensity"
                label="Ambient Light"
                min="0"
                max="5"
                step="0.1"
                thumb-label
                class="mb-2"
              />
              <v-slider
                v-model="directionalLightIntensity"
                label="Directional Light"
                min="0"
                max="5"
                step="0.1"
                thumb-label
                class="mb-2"
              />
              <v-color-picker
                v-model="backgroundColor"
                theme="dark"
                class="ma-1 bg-[#FFFFFF11] text-white"
                width="100%"
                show-swatches
              />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useElementVisibility, useWindowSize } from '@vueuse/core'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { computed, nextTick, onBeforeMount, onMounted, onUnmounted, ref, shallowRef, toRefs, watch } from 'vue'

import {
  getDataLakeVariableData,
  listenDataLakeVariable,
  unlistenDataLakeVariable,
} from '@/libs/actions/data-lake'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  /** Widget definition and configuration */
  widget: Widget
}>()
const { widget: widgetRef } = toRefs(props) // Use widgetRef to access widget props reactively

// Computed properties with getters and setters to avoid prop mutation warnings
const modelPath = computed({
  get: () => widgetRef.value.options.modelPath,
  set: (value) => { widgetRef.value.options.modelPath = value }
})

const cameraHeight = computed({
  get: () => widgetRef.value.options.cameraHeight,
  set: (value) => { widgetRef.value.options.cameraHeight = value }
})

const cameraDistance = computed({
  get: () => widgetRef.value.options.cameraDistance,
  set: (value) => { widgetRef.value.options.cameraDistance = value }
})

const frustumSize = computed({
  get: () => widgetRef.value.options.frustumSize,
  set: (value) => { widgetRef.value.options.frustumSize = value }
})

const autoRotate = computed({
  get: () => widgetRef.value.options.autoRotate,
  set: (value) => { widgetRef.value.options.autoRotate = value }
})

const showGrid = computed({
  get: () => widgetRef.value.options.showGrid,
  set: (value) => { widgetRef.value.options.showGrid = value }
})

const ambientLightIntensity = computed({
  get: () => widgetRef.value.options.ambientLightIntensity,
  set: (value) => { widgetRef.value.options.ambientLightIntensity = value }
})

const directionalLightIntensity = computed({
  get: () => widgetRef.value.options.directionalLightIntensity,
  set: (value) => { widgetRef.value.options.directionalLightIntensity = value }
})

const backgroundColor = computed({
  get: () => widgetRef.value.options.backgroundColor,
  set: (value) => { widgetRef.value.options.backgroundColor = value }
})

// Default options
const defaultOptions = {
  modelPath: 'brov2_heavy.glb', // Default model
  cameraHeight: 10,
  cameraDistance: 10,
  frustumSize: 10,
  autoRotate: false,
  showGrid: true,
  ambientLightIntensity: 0.5,
  directionalLightIntensity: 0.8,
  backgroundColor: '#cccccc',
}

// Initialize widget options with defaults if not present
onBeforeMount(() => {
  // Ensure default options are applied without reassigning widgetRef.value.options directly
  Object.keys(defaultOptions).forEach((key) => {
    if (!(key in widgetRef.value.options)) {
      ;(widgetRef.value.options as any)[key] = (defaultOptions as any)[key]
    }
  })
})

const canvasContainer = ref<HTMLElement | null>(null)
const controlsContainer = ref<HTMLElement | null>(null) // For material sliders
const modelLoaded = ref(false)
const loadError = ref<string | null>(null)

let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animationFrameId: number | null = null
let loadedModel: THREE.Group | null = null
let gridHelper: THREE.GridHelper | null = null
const interactiveMaterials = ref<
  Array<{
    /**
     *
     */
    material: THREE.MeshStandardMaterial
    /**
     *
     */
    originalColor: THREE.Color
    /**
     *
     */
    name: string
    /**
     *
     */
    type: string
  }>
>([])
const motorMaterials = ref<
  Array<{
    /**
     *
     */
    material: THREE.MeshStandardMaterial
    /**
     *
     */
    originalColor: THREE.Color
    /**
     *
     */
    name: string
    /**
     *
     */
    motorNumber: number | null
  }>
>([])

const colorRed = new THREE.Color(0xff0000)
const colorGreen = new THREE.Color(0x00ff00)

// Track servo listeners for cleanup
const servoListeners = ref<Record<number, string>>({})

// Track lights listener for cleanup
let lightsListenerId: string | undefined

/**
 * Interface for light material information stored in datalake control
 */
interface LightMaterialInfo {
  /** The Three.js material object */
  material: THREE.MeshStandardMaterial
  /** The original color of the material */
  originalColor: THREE.Color
  /** The name of the material */
  name: string
  /** The type of the material */
  type: string
}

// Store all light materials for datalake control
const allLightMaterials = ref<LightMaterialInfo[]>([])

const { width, height } = useWindowSize() // For responsive canvas, might need adjustment if canvasContainer has its own size

/** Initializes the Three.js scene, camera, renderer, and controls. */
function initThree(): void {
  if (!canvasContainer.value) return

  modelLoaded.value = false
  loadError.value = null

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(widgetRef.value.options.backgroundColor)

  // Camera
  const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
  camera = new THREE.OrthographicCamera(
    (widgetRef.value.options.frustumSize * aspect) / -2,
    (widgetRef.value.options.frustumSize * aspect) / 2,
    widgetRef.value.options.frustumSize / 2,
    widgetRef.value.options.frustumSize / -2,
    0.1,
    1000
  )
  camera.position.set(0, widgetRef.value.options.cameraHeight, widgetRef.value.options.cameraDistance)
  camera.lookAt(0, 0, 0)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  canvasContainer.value.appendChild(renderer.domElement)

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, widgetRef.value.options.ambientLightIntensity)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, widgetRef.value.options.directionalLightIntensity)
  directionalLight.position.set(5, 10, 7.5)
  scene.add(directionalLight)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.screenSpacePanning = false // Keep as false for orthographic usually
  controls.target.set(0, 0, 0) // Adjust target if model is offset
  controls.update()

  // Grid Helper
  if (widgetRef.value.options.showGrid) {
    gridHelper = new THREE.GridHelper(50, 50)
    scene.add(gridHelper)
  }

  loadModel()
  animate()
  setupWatchers()
}

/** Loads the GLB/GLTF model. */
function loadModel(): void {
  if (!scene) return
  modelLoaded.value = false
  loadError.value = null

  // Clear previous model and material controls
  if (loadedModel) {
    scene.remove(loadedModel)
    loadedModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose())
        } else if (mesh.material) {
          ;(mesh.material as THREE.Material).dispose()
        }
      }
    })
    loadedModel = null
  }
  interactiveMaterials.value = []
  motorMaterials.value = []
  if (controlsContainer.value) {
    controlsContainer.value.innerHTML = '' // Clear old sliders
  }

  const loader = new GLTFLoader()
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/')
  loader.setDRACOLoader(dracoLoader)

  const currentModelPath = widgetRef.value.options.modelPath
  if (!currentModelPath) {
    loadError.value = 'Model path is not defined.'
    return
  }

  loader.load(
    currentModelPath,
    (gltf) => {
      loadedModel = gltf.scene
      const box = new THREE.Box3().setFromObject(loadedModel)
      const center = box.getCenter(new THREE.Vector3())
      loadedModel.position.sub(center) // Center the model

      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0) {
        // Avoid division by zero if model is empty or flat
        const scale = widgetRef.value.options.frustumSize / maxDim / 2 // Adjust scale to fit view
        loadedModel.scale.set(scale, scale, scale)
      }

      scene?.add(loadedModel)
      modelLoaded.value = true
      console.log('Model loaded successfully:', currentModelPath)

      // Reset camera target to the center of the newly loaded model if needed
      if (controls) {
        // Assuming model is centered at origin after loading
        controls.target.set(0, 0, 0)
        controls.update()
      }
      extractInteractiveMaterials()
    },
    (xhr) => {
      console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
    },
    (error) => {
      console.error('An error happened during loading:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      loadError.value = `Failed to load model: ${errorMessage}. Check console for details.`
      modelLoaded.value = false
    }
  )
}

/** Extracts materials from the loaded model to create interactive controls. */
function extractInteractiveMaterials(): void {
  if (!loadedModel || !controlsContainer.value) return

  interactiveMaterials.value = [] // Clear previous light materials
  motorMaterials.value = [] // Clear previous motor materials
  allLightMaterials.value = [] // Clear previous light materials for datalake control
  controlsContainer.value.innerHTML = '' // Clear old sliders

  let materialIdCounter = 0
  loadedModel.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
      const meshNode = child as THREE.Mesh
      const materialsToProcess: THREE.Material[] = Array.isArray(meshNode.material)
        ? meshNode.material
        : [meshNode.material]

      materialsToProcess.forEach((mat: THREE.Material) => {
        if (!(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial)) return

        const matStandard = mat as THREE.MeshStandardMaterial // Cast for color access
        const matNameLower = matStandard.name ? matStandard.name.toLowerCase() : ''
        let materialType = null
        let motorNumber: number | null = null

        if (matNameLower.includes('motor') && matNameLower.includes('blackplastic')) {
          materialType = 'Motor'
          const motorNumMatch = matStandard.name.match(/\d+/)
          if (motorNumMatch && motorNumMatch[0]) {
            motorNumber = parseInt(motorNumMatch[0], 10)
          }
        } else if (matNameLower.includes('lights')) {
          materialType = 'Light'
        }

        if (
          materialType === 'Light' &&
          matStandard.color &&
          !interactiveMaterials.value.find((m) => m.material === matStandard)
        ) {
          const originalColor = matStandard.color.clone()
          const materialInfo: LightMaterialInfo = {
            material: matStandard,
            originalColor: originalColor,
            name: matStandard.name || `${materialType}Material-${++materialIdCounter}`,
            type: materialType,
          }
          interactiveMaterials.value.push(materialInfo)

          // Add to the lights array for datalake control
          allLightMaterials.value.push(materialInfo)

        } else if (
          materialType === 'Motor' &&
          matStandard.color &&
          !motorMaterials.value.find((m) => m.material === matStandard)
        ) {
          const originalColor = matStandard.color.clone()
          motorMaterials.value.push({
            material: matStandard,
            originalColor: originalColor,
            name: matStandard.name || `MotorMaterial-${motorNumber || ++materialIdCounter}`,
            motorNumber: motorNumber,
          })
          // No slider for motors, color will be controlled by servo output
          // Ensure motor starts with its original color
          matStandard.color.copy(originalColor)
        }
      })
    }
  })

  // Set up servo and lights listeners after processing all materials
  setupServoListeners()
  setupLightsListener()
}

/** Reloads the model, typically called when model path changes. */
function reloadModel(): void {
  // Debounce or ensure this is called appropriately, e.g., on blur or specific user action
  loadModel()
}

/** Handles window resize events to update camera and renderer. */
function onWindowResize(): void {
  if (!camera || !renderer || !canvasContainer.value) return

  const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
  camera.left = (widgetRef.value.options.frustumSize * aspect) / -2
  camera.right = (widgetRef.value.options.frustumSize * aspect) / 2
  camera.top = widgetRef.value.options.frustumSize / 2
  camera.bottom = widgetRef.value.options.frustumSize / -2
  camera.updateProjectionMatrix()
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
}

/** Animation loop for rendering the scene. */
function animate(): void {
  if (!renderer || !scene || !camera) return
  animationFrameId = requestAnimationFrame(animate)

  if (widgetRef.value.options.autoRotate && loadedModel) {
    loadedModel.rotation.y += 0.005
  }

  controls?.update()
  renderer.render(scene, camera)
}

/** Cleans up Three.js resources on component unmount. */
function cleanupThree(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }

  // Clean up servo and lights listeners
  cleanupServoListeners()
  cleanupLightsListener()

  if (renderer) {
    renderer.dispose()
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement)
    }
  }
  if (loadedModel) {
    scene?.remove(loadedModel)
    loadedModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose())
        } else if (mesh.material) {
          ;(mesh.material as THREE.Material).dispose()
        }
      }
    })
  }
  interactiveMaterials.value.forEach((im) => {
    if (im.material) im.material.dispose()
  })
  interactiveMaterials.value = []

  if (controlsContainer.value) {
    controlsContainer.value.innerHTML = ''
  }

  scene?.traverse((object) => {
    if (!objectIsLoadedModelOrDescendant(object, loadedModel) && (object as any).geometry) {
      ;(object as any).geometry.dispose()
    }
    if (!objectIsLoadedModelOrDescendant(object, loadedModel) && (object as any).material) {
      if (Array.isArray((object as any).material)) {
        ;(object as any).material.forEach((material: THREE.Material) => material.dispose())
      } else {
        ;(object as any).material.dispose()
      }
    }
  })

  scene = null
  camera = null
  renderer = null
  controls = null
  loadedModel = null
  gridHelper = null
}

/**
 * Checks if an object is the loaded model or one of its descendants.
 * @param object
 * @param model
 * @returns {boolean} True if the object is the loaded model or one of its descendants
 */
function objectIsLoadedModelOrDescendant(object: THREE.Object3D, model: THREE.Group | null): boolean {
  if (!model) return false
  let parent = object.parent
  while (parent !== null) {
    if (parent === model) return true
    parent = parent.parent
  }
  return object === model
}

const canvasVisibility = canvasContainer.value ? useElementVisibility(canvasContainer) : ref(true)

/** Sets up watchers for reactive properties. */
function setupWatchers(): void {
  // Watch for changes in widget options and update the scene accordingly
  watch(
    () => widgetRef.value.options.backgroundColor,
    (newColor) => {
      if (scene) scene.background = new THREE.Color(newColor)
    }
  )

  watch(
    () => widgetRef.value.options.ambientLightIntensity,
    (intensity) => {
      scene?.children.forEach((child) => {
        if (child instanceof THREE.AmbientLight) child.intensity = intensity
      })
    }
  )

  watch(
    () => widgetRef.value.options.directionalLightIntensity,
    (intensity) => {
      scene?.children.forEach((child) => {
        if (child instanceof THREE.DirectionalLight) child.intensity = intensity
      })
    }
  )

  watch(
    () => [widgetRef.value.options.cameraHeight, widgetRef.value.options.cameraDistance],
    ([y, z]) => {
      if (camera) {
        camera.position.y = y
        camera.position.z = z
        camera.lookAt(0, 0, 0) // Ensure it keeps looking at the origin
        controls?.update()
      }
    }
  )

  watch(
    () => widgetRef.value.options.frustumSize,
    () => {
      onWindowResize() // Recalculates camera projection
    }
  )

  watch(
    () => widgetRef.value.options.showGrid,
    (show) => {
      if (scene) {
        if (show && !gridHelper) {
          gridHelper = new THREE.GridHelper(50, 50)
          scene.add(gridHelper)
        } else if (!show && gridHelper) {
          scene.remove(gridHelper)
          gridHelper.dispose()
          gridHelper = null
        }
      }
    }
  )

  watch(width, onWindowResize)
  watch(height, onWindowResize)

  // Re-initialize if canvas becomes visible after being hidden
  watch(canvasVisibility, (isVisible) => {
    if (isVisible && !renderer) {
      // If visible and not initialized
      initThree()
    } else if (!isVisible && renderer) {
      // If not visible and initialized
      // Optionally pause rendering or cleanup if it's going to be hidden for long
    }
  })
}

/**
 * Sets up listeners for servo output channels from the datalake
 */
function setupServoListeners(): void {
  // Clean up existing listeners first
  cleanupServoListeners()

  motorMaterials.value.forEach((motorInfo) => {
    if (motorInfo.motorNumber === null || motorInfo.motorNumber < 1 || motorInfo.motorNumber > 8) {
      return
    }

    const servoChannel = motorInfo.motorNumber
    const dataLakeVariableId = `SERVO_OUTPUT_RAW/servo${servoChannel}_raw`

    // Set up listener for this specific servo channel
    const listenerId = listenDataLakeVariable(dataLakeVariableId, (value) => {
      updateMotorColor(motorInfo, value as number)
    })

    // Track the listener for cleanup
    servoListeners.value[servoChannel] = listenerId

    // Get initial value
    const initialValue = getDataLakeVariableData(dataLakeVariableId)
    if (typeof initialValue === 'number') {
      updateMotorColor(motorInfo, initialValue)
    }
  })
}

/**
 * Updates motor color based on servo value
 */
function updateMotorColor(motorInfo: any, servoRawValue: number): void {
  if (typeof servoRawValue !== 'number') {
    motorInfo.material.color.copy(motorInfo.originalColor)
    return
  }

  let t = 0
  let targetColor: THREE.Color | null = null

  if (servoRawValue === 1500) {
    motorInfo.material.color.copy(motorInfo.originalColor)
    return
  } else if (servoRawValue > 1500) {
    t = Math.min(1, (servoRawValue - 1500) / 500)
    targetColor = colorGreen
  } else {
    t = Math.min(1, (1500 - servoRawValue) / 500)
    targetColor = colorRed
  }

  if (targetColor) {
    motorInfo.material.color.copy(motorInfo.originalColor).lerp(targetColor, t)
  } else {
    motorInfo.material.color.copy(motorInfo.originalColor)
  }
}

/**
 * Cleans up servo listeners
 */
function cleanupServoListeners(): void {
  Object.entries(servoListeners.value).forEach(([servoChannel, listenerId]) => {
    const dataLakeVariableId = `SERVO_OUTPUT_RAW/servo${servoChannel}_raw`
    unlistenDataLakeVariable(dataLakeVariableId, listenerId)
  })
  servoListeners.value = {}
}

/**
 * Sets up listener for the Lights1 datalake variable
 */
function setupLightsListener(): void {
  // Clean up existing listener first
  cleanupLightsListener()

  if (allLightMaterials.value.length === 0) return

  const dataLakeVariableId = 'Lights1'

  // Set up listener for the Lights1 variable
  lightsListenerId = listenDataLakeVariable(dataLakeVariableId, (value) => {
    updateAllLightsColor(value as number)
  })

  // Get initial value
  const initialValue = getDataLakeVariableData(dataLakeVariableId)
  if (typeof initialValue === 'number') {
    updateAllLightsColor(initialValue)
  }
}

/**
 * Updates all light materials based on the Lights1 datalake value
 * Expected range: 0 to 1 (0 = original color, 1 = full green intensity)
 */
function updateAllLightsColor(value: number): void {
  if (typeof value !== 'number') {
    // Reset to original colors if value is invalid
    allLightMaterials.value.forEach((materialInfo) => {
      materialInfo.material.color.copy(materialInfo.originalColor)
    })
    return
  }

  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, value))

  allLightMaterials.value.forEach((materialInfo) => {
    if (clampedValue === 0) {
      // 0% - Original color
      materialInfo.material.color.copy(materialInfo.originalColor)
    } else {
      // 1% to 100% - Blend toward green based on intensity
      materialInfo.material.color.copy(materialInfo.originalColor).lerp(colorGreen, clampedValue)
    }
  })
}

/**
 * Cleans up lights listener
 */
function cleanupLightsListener(): void {
  if (lightsListenerId) {
    unlistenDataLakeVariable('Lights1', lightsListenerId)
    lightsListenerId = undefined
  }
}

onMounted(() => {
  nextTick(() => {
    // Ensure DOM elements are available
    if (canvasContainer.value) {
      initThree()
    }
  })
})

onUnmounted(() => {
  cleanupThree()
})

// Expose functions or variables to template if needed, though script setup does this mostly automatically
</script>

<style scoped>
.main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 300px;
  min-height: 200px;
  background: #1a1a1a; /* Fallback, will be overridden by widget option */
  border-radius: 8px;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
  text-align: center;
  z-index: 10;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 20px;
  border-radius: 8px;
}

.loading-text,
.error-text {
  font-size: 14px;
  font-weight: 500;
}

.error-text {
  color: #ff8a80; /* Softer red for dark themes */
}

.controls-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 10px;
  border-radius: 5px;
  max-height: calc(90vh - 20px); /* Adjust based on needs */
  max-width: 250px;
  overflow-y: auto;
  z-index: 5; /* Ensure it's above the canvas but below modals */
}

.controls-panel .control-item {
  margin-bottom: 10px;
}

.controls-panel .control-item label {
  display: block;
  margin-bottom: 5px;
  font-size: 0.9em;
}

.controls-panel .control-item input[type='range'] {
  width: calc(100% - 10px); /* Adjust for padding or borders */
  display: block;
}

/* Style for v-progress-circular and text inside overlays for better visibility */
.loading-overlay .v-progress-circular {
  margin-bottom: 10px;
}
</style>
