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

        <v-switch v-model="showGrid" label="Show Grid Helper" class="mb-4" />

        <div class="color-controls">
          <h4 class="mb-3">Motor Colors</h4>
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model="positiveMotorColor"
                label="Positive Color (>1500)"
                type="color"
                class="mb-2"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="negativeMotorColor"
                label="Negative Color (<1500)"
                type="color"
                class="mb-2"
                hide-details
              />
            </v-col>
          </v-row>

          <h4 class="mb-3 mt-4">Light Color</h4>
          <v-text-field
            v-model="lightColor"
            label="Light Color (100% intensity)"
            type="color"
            class="mb-2"
            hide-details
          />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useElementVisibility, useResizeObserver, useWindowSize } from '@vueuse/core'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { computed, nextTick, onBeforeMount, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'

import {
  getDataLakeVariableData,
  listenDataLakeVariable,
  setDataLakeVariableData,
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
  set: (value) => {
    widgetRef.value.options.modelPath = value
  },
})

const cameraHeight = computed({
  get: () => widgetRef.value.options.cameraHeight,
  set: (value) => {
    widgetRef.value.options.cameraHeight = value
  },
})

const cameraDistance = computed({
  get: () => widgetRef.value.options.cameraDistance,
  set: (value) => {
    widgetRef.value.options.cameraDistance = value
  },
})

const showGrid = computed({
  get: () => widgetRef.value.options.showGrid,
  set: (value) => {
    widgetRef.value.options.showGrid = value
  },
})

const positiveMotorColor = computed({
  get: () => widgetRef.value.options.positiveMotorColor,
  set: (value) => {
    widgetRef.value.options.positiveMotorColor = value
  },
})

const negativeMotorColor = computed({
  get: () => widgetRef.value.options.negativeMotorColor,
  set: (value) => {
    widgetRef.value.options.negativeMotorColor = value
  },
})

const lightColor = computed({
  get: () => widgetRef.value.options.lightColor,
  set: (value) => {
    widgetRef.value.options.lightColor = value
  },
})

// User-selected colors as THREE.Color objects
const positiveColor = computed(() => new THREE.Color(widgetRef.value.options.positiveMotorColor || '#00ff00'))
const negativeColor = computed(() => new THREE.Color(widgetRef.value.options.negativeMotorColor || '#ff0000'))
const userLightColor = computed(() => new THREE.Color(widgetRef.value.options.lightColor || '#00ff00'))

// Default options
const defaultOptions = {
  modelPath: 'brov2_heavy.glb', // Default model
  cameraHeight: 10, // Higher for better top-down view
  cameraDistance: 15, // Not used for positioning in top-down view, but kept for UI
  showGrid: false, // Grid disabled by default
  positiveMotorColor: '#00ff00', // Green for positive values
  negativeMotorColor: '#ff0000', // Red for negative values
  lightColor: '#00ff00', // Green for light color
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
const modelLoaded = ref(false)
const loadError = ref<string | null>(null)

// Internal frustum size - automatically calculated based on model dimensions
const calculatedFrustumSize = ref(10) // Default value

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

// Color transition system
/** Duration for color transitions in milliseconds */
const transitionDuration = 300 // milliseconds
/** Map tracking active color transitions for materials */
const activeTransitions = ref<Map<THREE.MeshStandardMaterial, {
  /** Starting color of the transition */
  startColor: THREE.Color
  /** Target color of the transition */
  targetColor: THREE.Color
  /** Timestamp when transition started */
  startTime: number
  /** Duration of the transition in milliseconds */
  duration: number
}>>(new Map())

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

const canvasVisibility = canvasContainer.value ? useElementVisibility(canvasContainer) : ref(true)

// Track canvas container dimensions
const containerWidth = ref(0)
const containerHeight = ref(0)

// Watch for canvas container size changes
useResizeObserver(canvasContainer, (entries) => {
  if (entries.length > 0) {
    const entry = entries[0]
    containerWidth.value = entry.contentRect.width
    containerHeight.value = entry.contentRect.height

    // Trigger resize handling when container dimensions change
    onWindowResize()
  }
})

/** Initializes the Three.js scene, camera, renderer, and controls. */
function initThree(): void {
  if (!canvasContainer.value) return

  modelLoaded.value = false
  loadError.value = null

  // Scene
  scene = new THREE.Scene()

  // Camera
  const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
  camera = new THREE.OrthographicCamera(
    (calculatedFrustumSize.value * aspect) / -2,
    (calculatedFrustumSize.value * aspect) / 2,
    calculatedFrustumSize.value / 2,
    calculatedFrustumSize.value / -2,
    0.1,
    1000
  )

  // Set top-down view position (directly above the vehicle)
  camera.position.set(0, widgetRef.value.options.cameraHeight, 0)
  camera.lookAt(0, 0, 0)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.style.display = 'block' // Ensure no inline spacing issues
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  canvasContainer.value.appendChild(renderer.domElement)

  // Set background to always be transparent
  scene.background = null // Transparent background
  renderer.setClearColor(0x000000, 0) // Fully transparent

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0) // Fixed ambient light intensity
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0) // Fixed directional light intensity
  directionalLight.position.set(10, 10, 7.5)
  scene.add(directionalLight)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.enableRotate = false // Disable rotation
  controls.enablePan = false // Disable panning
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
        // Calculate optimal frustum size based on model dimensions and canvas aspect ratio
        const aspect = canvasContainer.value
          ? canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
          : 1

        // Add 20% padding around the model
        const padding = 1.2

        // For top-down view, we primarily care about X and Z dimensions
        const horizontalSize = Math.max(size.x, size.z)

        // Calculate frustum size considering aspect ratio
        // The frustum needs to show the horizontal size, accounting for aspect ratio
        if (aspect >= 1) {
          // Wide canvas: frustum height determines what we see
          calculatedFrustumSize.value = horizontalSize * padding
        } else {
          // Tall canvas: frustum width determines what we see
          calculatedFrustumSize.value = (horizontalSize * padding) / aspect
        }

        // Don't scale the model anymore - let the frustum size handle the view
        // The model stays at its original size

        // Update camera with new frustum size
        if (camera && canvasContainer.value) {
          const newAspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
          camera.left = (calculatedFrustumSize.value * newAspect) / -2
          camera.right = (calculatedFrustumSize.value * newAspect) / 2
          camera.top = calculatedFrustumSize.value / 2
          camera.bottom = calculatedFrustumSize.value / -2
          camera.updateProjectionMatrix()
        }
      }

      scene?.add(loadedModel)
      modelLoaded.value = true
      console.log('Model loaded successfully:', currentModelPath)
      console.log('Calculated frustum size:', calculatedFrustumSize.value)

      // Reset camera target to the center of the newly loaded model if needed
      if (controls) {
        // Assuming model is centered at origin after loading
        controls.target.set(0, 0, 0)
        controls.update()
      }
      console.log('About to extract interactive materials')
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
  if (!loadedModel) return

  console.log('Extracting interactive materials from loaded model')

  interactiveMaterials.value = [] // Clear previous light materials
  motorMaterials.value = [] // Clear previous motor materials
  allLightMaterials.value = [] // Clear previous light materials for datalake control

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
          console.log('Found motor material:', matStandard.name, 'Motor number:', motorNumber)
        } else if (matNameLower.includes('lights')) {
          materialType = 'Light'
          console.log('Found light material:', matStandard.name)
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

  console.log(
    'Found',
    motorMaterials.value.length,
    'motor materials and',
    allLightMaterials.value.length,
    'light materials'
  )

  // Set up servo and lights listeners after processing all materials
  console.log('About to call setupServoListeners and setupLightsListener')
  setupServoListeners()
  setupLightsListener()
  console.log('Finished setting up listeners')

  // Manual test after 2 seconds
  setTimeout(() => {
    console.log('=== MANUAL DATALAKE TEST ===')

    // Test setting a test variable
    try {
      setDataLakeVariableData('test-variable', 999)
      console.log('Set test-variable to 999')
    } catch (error) {
      console.error('Error setting test variable:', error)
    }

    // Test reading servo variables
    for (let i = 1; i <= 8; i++) {
      const servoVar = `SERVO_OUTPUT_RAW/servo${i}_raw`
      const value = getDataLakeVariableData(servoVar)
      console.log(`${servoVar}:`, value)
    }

    // Test reading lights variable
    const lightsValue = getDataLakeVariableData('Lights1')
    console.log('Lights1:', lightsValue)

    // Test manual servo update
    try {
      setDataLakeVariableData('SERVO_OUTPUT_RAW/servo1_raw', 1600)
      console.log('Manually set servo1_raw to 1600')
    } catch (error) {
      console.error('Error setting servo variable:', error)
    }

    // Test manual lights update
    try {
      setDataLakeVariableData('Lights1', 0.5)
      console.log('Manually set Lights1 to 0.5')
    } catch (error) {
      console.error('Error setting lights variable:', error)
    }
  }, 2000)
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
  camera.left = (calculatedFrustumSize.value * aspect) / -2
  camera.right = (calculatedFrustumSize.value * aspect) / 2
  camera.top = calculatedFrustumSize.value / 2
  camera.bottom = calculatedFrustumSize.value / -2
  camera.updateProjectionMatrix()
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)

  // If we have a loaded model, recalculate the frustum size for the new aspect ratio
  if (loadedModel) {
    const box = new THREE.Box3().setFromObject(loadedModel)
    const size = box.getSize(new THREE.Vector3())
    const horizontalSize = Math.max(size.x, size.z)

    if (horizontalSize > 0) {
      const padding = 1.2

      if (aspect >= 1) {
        // Wide canvas: frustum height determines what we see
        calculatedFrustumSize.value = horizontalSize * padding
      } else {
        // Tall canvas: frustum width determines what we see
        calculatedFrustumSize.value = (horizontalSize * padding) / aspect
      }

      // Update camera again with the new frustum size
      camera.left = (calculatedFrustumSize.value * aspect) / -2
      camera.right = (calculatedFrustumSize.value * aspect) / 2
      camera.top = calculatedFrustumSize.value / 2
      camera.bottom = calculatedFrustumSize.value / -2
      camera.updateProjectionMatrix()
    }
  }
}

/**
 * Starts a smooth color transition for a material
 * @param material - The material to transition
 * @param targetColor - The target color to transition to
 * @param duration - Duration of the transition in milliseconds (optional)
 */
function startColorTransition(
  material: THREE.MeshStandardMaterial,
  targetColor: THREE.Color,
  duration: number = transitionDuration
): void {
  const currentColor = material.color.clone()
  const now = Date.now()

  activeTransitions.value.set(material, {
    startColor: currentColor,
    targetColor: targetColor.clone(),
    startTime: now,
    duration: duration,
  })
}

/**
 * Updates all active color transitions
 */
function updateTransitions(): void {
  const now = Date.now()
  const completedTransitions: THREE.MeshStandardMaterial[] = []

  activeTransitions.value.forEach((transition, material) => {
    const elapsed = now - transition.startTime
    const progress = Math.min(elapsed / transition.duration, 1)

    // Use smooth easing function (ease-out)
    const easedProgress = 1 - Math.pow(1 - progress, 3)

    // Interpolate between start and target colors
    material.color.copy(transition.startColor).lerp(transition.targetColor, easedProgress)

    // Mark transition as complete if we've reached the end
    if (progress >= 1) {
      completedTransitions.push(material)
    }
  })

  // Remove completed transitions
  completedTransitions.forEach((material) => {
    activeTransitions.value.delete(material)
  })
}

/** Animation loop for rendering the scene. */
function animate(): void {
  if (!renderer || !scene || !camera) return
  animationFrameId = requestAnimationFrame(animate)

  // Update color transitions
  updateTransitions()

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

  // Clear active transitions
  activeTransitions.value.clear()

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

/** Sets up watchers for reactive properties. */
function setupWatchers(): void {
  // Watch for changes in widget options and update the scene accordingly

  watch(
    () => [widgetRef.value.options.cameraHeight, widgetRef.value.options.cameraDistance],
    ([y, distance]) => {
      if (camera) {
        // Maintain top-down view position (directly above)
        camera.position.set(0, y, 0)
        camera.lookAt(0, 0, 0) // Ensure it keeps looking at the origin
        controls?.update()
      }
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

  console.log('Setting up servo listeners for motors:', motorMaterials.value.length)

  motorMaterials.value.forEach((motorInfo) => {
    if (motorInfo.motorNumber === null || motorInfo.motorNumber < 1 || motorInfo.motorNumber > 8) {
      console.log('Skipping motor with invalid number:', motorInfo.motorNumber)
      return
    }

    console.log(`Setting up listener for motor ${motorInfo.motorNumber}...`)

    const servoChannel = motorInfo.motorNumber
    const dataLakeVariableId = `SERVO_OUTPUT_RAW/servo${servoChannel}_raw`

    console.log('Setting up listener for:', dataLakeVariableId)

    // Set up listener for this specific servo channel
    const listenerId = listenDataLakeVariable(dataLakeVariableId, (value) => {
      updateMotorColor(motorInfo, value as number)
    })

    console.log('Listener ID for', dataLakeVariableId, ':', listenerId)

    // Track the listener for cleanup
    servoListeners.value[servoChannel] = listenerId

    // Get initial value
    const initialValue = getDataLakeVariableData(dataLakeVariableId)
    console.log(`Initial value for ${dataLakeVariableId}:`, initialValue)
    if (typeof initialValue === 'number') {
      updateMotorColor(motorInfo, initialValue)
    }
  })

  console.log('Current servo listeners:', servoListeners.value)
}

/**
 * Updates motor color based on servo value
 * @param motorInfo
 * @param servoRawValue
 */
function updateMotorColor(motorInfo: any, servoRawValue: number): void {
  if (typeof servoRawValue !== 'number') {
    startColorTransition(motorInfo.material, motorInfo.originalColor)
    return
  }

  let t = 0
  let targetColor: THREE.Color | null = null

  if (servoRawValue === 1500) {
    startColorTransition(motorInfo.material, motorInfo.originalColor)
    return
  } else if (servoRawValue > 1500) {
    t = Math.min(1, (servoRawValue - 1500) / 500)
    targetColor = positiveColor.value
  } else {
    t = Math.min(1, (1500 - servoRawValue) / 500)
    targetColor = negativeColor.value
  }

  if (targetColor) {
    // Create the target color by blending original with red/green
    const blendedColor = motorInfo.originalColor.clone().lerp(targetColor, t)
    startColorTransition(motorInfo.material, blendedColor)
  } else {
    startColorTransition(motorInfo.material, motorInfo.originalColor)
  }
}

/**
 * Cleans up servo listeners
 */
function cleanupServoListeners(): void {
  console.log('Cleaning up servo listeners:', servoListeners.value)
  Object.entries(servoListeners.value).forEach(([servoChannel, listenerId]) => {
    const dataLakeVariableId = `SERVO_OUTPUT_RAW/servo${servoChannel}_raw`
    console.log('Unlisten from', dataLakeVariableId, 'with ID:', listenerId)
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

  if (allLightMaterials.value.length === 0) {
    console.log('No light materials found, skipping lights listener setup')
    return
  }

  console.log('Setting up lights listener for', allLightMaterials.value.length, 'light materials')

  const dataLakeVariableId = 'Lights1'

  // Set up listener for the Lights1 variable
  lightsListenerId = listenDataLakeVariable(dataLakeVariableId, (value) => {
    updateAllLightsColor(value as number)
  })

  // Get initial value
  const initialValue = getDataLakeVariableData(dataLakeVariableId)
  console.log(`Initial value for ${dataLakeVariableId}:`, initialValue)
  if (typeof initialValue === 'number') {
    updateAllLightsColor(initialValue)
  }
}

/**
 * Updates all light materials based on the Lights1 datalake value
 * Expected range: 0 to 1 (0 = original color, 1 = full green intensity)
 * @param value
 */
function updateAllLightsColor(value: number): void {
  if (typeof value !== 'number') {
    // Reset to original colors if value is invalid
    allLightMaterials.value.forEach((materialInfo) => {
      startColorTransition(materialInfo.material, materialInfo.originalColor)
    })
    return
  }

  // Clamp value between 0 and 1
  const clampedValue = Math.max(0, Math.min(1, value))

  allLightMaterials.value.forEach((materialInfo) => {
    if (clampedValue === 0) {
      // 0% - Original color
      startColorTransition(materialInfo.material, materialInfo.originalColor)
    } else {
      // 1% to 100% - Blend toward green based on intensity
      const blendedColor = materialInfo.originalColor.clone().lerp(userLightColor.value, clampedValue)
      startColorTransition(materialInfo.material, blendedColor)
    }
  })
}

/**
 * Cleans up lights listener
 */
function cleanupLightsListener(): void {
  console.log('Cleaning up lights listener:', lightsListenerId)
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
  position: relative;
  background: transparent; /* Fully transparent background */
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: transparent;
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

.color-controls {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.color-controls h4 {
  color: rgba(255, 255, 255, 0.87);
  font-weight: 500;
}

/* Style for v-progress-circular and text inside overlays for better visibility */
.loading-overlay .v-progress-circular {
  margin-bottom: 10px;
}
</style>
