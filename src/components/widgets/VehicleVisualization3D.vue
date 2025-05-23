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
          v-model="widget.options.modelPath"
          label="Model Path (GLB/GLTF file)"
          hint="Path to your .glb or .gltf model file (e.g., /models/vehicle.glb)"
          persistent-hint
          class="mb-4"
          @update:model-value="reloadModel"
        />

        <v-slider
          v-model="widget.options.cameraHeight"
          label="Camera Y Position"
          min="1"
          max="50"
          step="0.5"
          thumb-label
          class="mb-4"
        />

        <v-slider
          v-model="widget.options.cameraDistance"
          label="Camera Z Position"
          min="1"
          max="50"
          step="1"
          thumb-label
          class="mb-4"
        />
        <v-slider
          v-model="widget.options.frustumSize"
          label="Zoom (Frustum Size)"
          min="1"
          max="50"
          step="1"
          thumb-label
          class="mb-4"
        />

        <v-switch
          v-model="widget.options.autoRotate"
          label="Auto Rotate"
          class="mb-4"
        />

        <v-switch
          v-model="widget.options.showGrid"
          label="Show Grid Helper"
          class="mb-4"
        />

        <v-expansion-panels theme="dark">
          <v-expansion-panel class="bg-[#FFFFFF11] text-white mt-2">
            <v-expansion-panel-title>Lighting & Environment</v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-slider
                v-model="widget.options.ambientLightIntensity"
                label="Ambient Light"
                min="0"
                max="5"
                step="0.1"
                thumb-label
                class="mb-2"
              />
              <v-slider
                v-model="widget.options.directionalLightIntensity"
                label="Directional Light"
                min="0"
                max="5"
                step="0.1"
                thumb-label
                class="mb-2"
              />
              <v-color-picker
                v-model="widget.options.backgroundColor"
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
import { computed, nextTick, onBeforeMount, onMounted, onUnmounted, ref, shallowRef, toRefs, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { useAppInterfaceStore } from '@/stores/appInterface'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Widget } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()

const props = defineProps<{
  widget: Widget
}>()
const { widget: widgetRef } = toRefs(props) // Use widgetRef to access widget props reactively

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
  widgetRef.value.options = { ...defaultOptions, ...widgetRef.value.options }
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
const interactiveMaterials = ref<Array<{ material: THREE.MeshStandardMaterial; originalColor: THREE.Color; name: string; type: string }>>([])

const colorRed = new THREE.Color(0xff0000)
const colorGreen = new THREE.Color(0x00ff00)

const { width, height } = useWindowSize() // For responsive canvas, might need adjustment if canvasContainer has its own size

function initThree() {
  if (!canvasContainer.value) return

  modelLoaded.value = false
  loadError.value = null

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(widgetRef.value.options.backgroundColor)

  // Camera
  const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
  camera = new THREE.OrthographicCamera(
    widgetRef.value.options.frustumSize * aspect / -2,
    widgetRef.value.options.frustumSize * aspect / 2,
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

function loadModel() {
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
          mesh.material.forEach(mat => mat.dispose())
        } else if (mesh.material) {
          (mesh.material as THREE.Material).dispose()
        }
      }
    })
    loadedModel = null
  }
  interactiveMaterials.value = []
  if (controlsContainer.value) {
    controlsContainer.value.innerHTML = '' // Clear old sliders
  }


  const loader = new GLTFLoader()
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/')
  loader.setDRACOLoader(dracoLoader)

  const modelPath = widgetRef.value.options.modelPath
  if (!modelPath) {
    loadError.value = "Model path is not defined."
    return
  }

  loader.load(
    modelPath,
    (gltf) => {
      loadedModel = gltf.scene
      const box = new THREE.Box3().setFromObject(loadedModel)
      const center = box.getCenter(new THREE.Vector3())
      loadedModel.position.sub(center) // Center the model

      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0) { // Avoid division by zero if model is empty or flat
        const scale = widgetRef.value.options.frustumSize / maxDim / 2 // Adjust scale to fit view
        loadedModel.scale.set(scale, scale, scale)
      }

      scene?.add(loadedModel)
      modelLoaded.value = true
      console.log("Model loaded successfully:", modelPath)

      // Reset camera target to the center of the newly loaded model if needed
      if (controls) {
         // Assuming model is centered at origin after loading
        controls.target.set(0, 0, 0)
        controls.update()
      }
      extractInteractiveMaterials()
    },
    (xhr) => {
      console.log((xhr.loaded / xhr.total * 100) + '% loaded')
    },
    (error) => {
      console.error('An error happened during loading:', error)
      loadError.value = `Failed to load model: ${error.message || 'Unknown error'}. Check console for details.`
      modelLoaded.value = false;
    }
  )
}

function extractInteractiveMaterials() {
  if (!loadedModel || !controlsContainer.value) return;

  interactiveMaterials.value = []; // Clear previous
  controlsContainer.value.innerHTML = ''; // Clear old sliders

  let materialIdCounter = 0;
  loadedModel.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
      const materials = Array.isArray((child as THREE.Mesh).material) ? (child as THREE.Mesh).material : [(child as THREE.Mesh).material];
      materials.forEach(mat => {
        // Ensure material is MeshStandardMaterial or MeshPhysicalMaterial for color property
        if (!(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial)) return;

        const matNameLower = mat.name ? mat.name.toLowerCase() : '';
        let materialType = null;

        if (matNameLower.includes('motor') && matNameLower.includes('blackplastic')) {
          materialType = 'Motor';
        } else if (matNameLower.includes('lights')) {
          materialType = 'Light';
        }

        if (materialType && mat.color && !interactiveMaterials.value.find(m => m.material === mat)) {
          const originalColor = mat.color.clone();
          const materialInfo = {
            material: mat,
            originalColor: originalColor,
            name: mat.name || `${materialType}Material-${++materialIdCounter}`,
            type: materialType
          };
          interactiveMaterials.value.push(materialInfo);

          // Create slider
          const controlItem = document.createElement('div');
          controlItem.className = 'control-item'; // Add styles for this class

          const label = document.createElement('label');
          label.innerText = `${materialInfo.name} (${materialInfo.type}):`;
          label.htmlFor = materialInfo.name + '-slider';
          label.style.color = 'white'; // Example style
          label.style.display = 'block';


          const slider = document.createElement('input');
          slider.type = 'range';
          slider.id = materialInfo.name + '-slider';
          slider.min = "-100";
          slider.max = "100";
          slider.value = "0";
          slider.style.width = '100%';

          slider.addEventListener('input', (event) => {
            const value = parseInt((event.target as HTMLInputElement).value);
            if (value === 0) {
              materialInfo.material.color.copy(materialInfo.originalColor);
            } else if (value < 0) {
              const t = Math.abs(value) / 100;
              materialInfo.material.color.copy(materialInfo.originalColor).lerp(colorRed, t);
            } else { // value > 0
              const t = value / 100;
              materialInfo.material.color.copy(materialInfo.originalColor).lerp(colorGreen, t);
            }
          });
          controlItem.appendChild(label);
          controlItem.appendChild(slider);
          controlsContainer.value?.appendChild(controlItem);
        }
      });
    }
  });
}


function reloadModel() {
  // Debounce or ensure this is called appropriately, e.g., on blur or specific user action
  loadModel();
}


function onWindowResize() {
  if (!camera || !renderer || !canvasContainer.value) return

  const aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
  camera.left = widgetRef.value.options.frustumSize * aspect / -2
  camera.right = widgetRef.value.options.frustumSize * aspect / 2
  camera.top = widgetRef.value.options.frustumSize / 2
  camera.bottom = widgetRef.value.options.frustumSize / -2
  camera.updateProjectionMatrix()
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
}

function animate() {
  if (!renderer || !scene || !camera) return
  animationFrameId = requestAnimationFrame(animate)

  if (widgetRef.value.options.autoRotate && loadedModel) {
    loadedModel.rotation.y += 0.005;
  }

  controls?.update()
  renderer.render(scene, camera)
}

function cleanupThree() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
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
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose());
        } else if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
      }
    })
  }
  interactiveMaterials.value.forEach(im => {
    if (im.material) im.material.dispose();
  })
  interactiveMaterials.value = []

  if (controlsContainer.value) {
    controlsContainer.value.innerHTML = '';
  }


  scene?.traverse(object => {
    if (!objectIsLoadedModelOrDescendant(object, loadedModel) && (object as any).geometry) {
      (object as any).geometry.dispose()
    }
    if (!objectIsLoadedModelOrDescendant(object, loadedModel) && (object as any).material) {
      if (Array.isArray((object as any).material)) {
        (object as any).material.forEach((material: THREE.Material) => material.dispose())
      } else {
        (object as any).material.dispose()
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

function objectIsLoadedModelOrDescendant(object: THREE.Object3D, model: THREE.Group | null): boolean {
  if (!model) return false;
  let parent = object.parent;
  while (parent !== null) {
    if (parent === model) return true;
    parent = parent.parent;
  }
  return object === model;
}

const canvasVisibility = canvasContainer.value ? useElementVisibility(canvasContainer) : ref(true)

function setupWatchers() {
  // Watch for changes in widget options and update the scene accordingly
  watch(() => widgetRef.value.options.backgroundColor, (newColor) => {
    if (scene) scene.background = new THREE.Color(newColor)
  })

  watch(() => widgetRef.value.options.ambientLightIntensity, (intensity) => {
    scene?.children.forEach(child => {
      if (child instanceof THREE.AmbientLight) child.intensity = intensity
    })
  })

  watch(() => widgetRef.value.options.directionalLightIntensity, (intensity) => {
    scene?.children.forEach(child => {
      if (child instanceof THREE.DirectionalLight) child.intensity = intensity
    })
  })

  watch(() => [widgetRef.value.options.cameraHeight, widgetRef.value.options.cameraDistance], ([y, z]) => {
    if (camera) {
      camera.position.y = y
      camera.position.z = z
      camera.lookAt(0,0,0) // Ensure it keeps looking at the origin
      controls?.update()
    }
  })

   watch(() => widgetRef.value.options.frustumSize, () => {
    onWindowResize(); // Recalculates camera projection
  });


  watch(() => widgetRef.value.options.showGrid, (show) => {
    if (scene) {
      if (show && !gridHelper) {
        gridHelper = new THREE.GridHelper(50, 50);
        scene.add(gridHelper);
      } else if (!show && gridHelper) {
        scene.remove(gridHelper);
        gridHelper.dispose();
        gridHelper = null;
      }
    }
  });

  watch(width, onWindowResize)
  watch(height, onWindowResize)

  // Re-initialize if canvas becomes visible after being hidden
  watch(canvasVisibility, (isVisible) => {
    if (isVisible && !renderer) { // If visible and not initialized
      initThree();
    } else if (!isVisible && renderer) { // If not visible and initialized
      // Optionally pause rendering or cleanup if it's going to be hidden for long
      // For now, we keep it running, but cleanupThree() could be called here
      // if performance is a concern when many widgets are hidden.
    }
  });
}


onMounted(() => {
  nextTick(() => { // Ensure DOM elements are available
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
  background-color: rgba(0,0,0,0.7);
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
  background-color: rgba(0,0,0,0.6);
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

.controls-panel .control-item input[type="range"] {
  width: calc(100% - 10px); /* Adjust for padding or borders */
  display: block;
}

/* Style for v-progress-circular and text inside overlays for better visibility */
.loading-overlay .v-progress-circular {
  margin-bottom: 10px;
}
</style>