<template>
  <div ref="mapBase" class="page-base" :class="widgetStore.editingMode ? 'pointer-events-none' : 'pointer-events-auto'">
    <div ref="cesiumContainer" class="map"></div>

    <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" width="auto">
      <v-card class="pa-2" :style="interfaceStore.globalGlassMenuStyles">
        <v-card-title class="text-center">Map widget settings</v-card-title>
        <v-card-text>
          <v-switch
            v-model="widget.options.showVehiclePath"
            class="my-1"
            label="Show vehicle path"
            :color="widget.options.showVehiclePath ? 'white' : undefined"
            hide-details
          />
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { type Ref, computed, onBeforeMount, onBeforeUnmount, onMounted, ref, toRefs } from 'vue'
import { 
  Viewer, 
  createWorldTerrainAsync, 
  Cartesian3, 
  Entity, 
  HeightReference,
  ModelGraphics,
  CallbackProperty,
  HeadingPitchRoll,
  Math,
  Transforms,
  Quaternion
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { WaypointCoordinates } from '@/types/mission'
import type { Widget } from '@/types/widgets'

// Initialize stores
const vehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const widgetStore = useWidgetManagerStore()

// Define props
const props = defineProps<{ widget: Widget }>()
const widget = toRefs(props).widget

// Set up refs
const cesiumContainer = ref<HTMLElement | null>(null)
const viewer = ref<Viewer | null>(null)
const vehicleEntity = ref<Entity | null>(null)
const mapBase = ref<HTMLElement>()

// Register coordinate variables for logging
datalogger.registerUsage(DatalogVariable.latitude)
datalogger.registerUsage(DatalogVariable.longitude)

// Initialize widget options
onBeforeMount(() => {
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showVehiclePath: true,
    }
  }
})

// Calculate live vehicle position and heading
const vehiclePosition = computed(() =>
  vehicleStore.coordinates.latitude
    ? ([vehicleStore.coordinates.latitude, vehicleStore.coordinates.longitude] as WaypointCoordinates)
    : undefined
)

const vehicleAttitude = computed(() => 
  vehicleStore.attitude
)

// Create position callback property
const createPositionCallback = () => {
  return new CallbackProperty((time, result) => {
    if (!vehiclePosition.value) return undefined
    return Cartesian3.fromDegrees(
      vehiclePosition.value[1],
      vehiclePosition.value[0],
      vehicleStore.coordinates.altitude
    )
  }, false)
}

// Create orientation callback property
const createOrientationCallback = () => {
  return new CallbackProperty((time, result) => {
    if (!vehicleAttitude.value || !vehiclePosition.value) {
      return undefined
    }
    
    const hpr = new HeadingPitchRoll(
      vehicleAttitude.value.yaw - Math.PI_OVER_TWO,
      vehicleAttitude.value.pitch,
      vehicleAttitude.value.roll
    )
    
    const position = Cartesian3.fromDegrees(
      vehiclePosition.value[1],
      vehiclePosition.value[0],
      vehicleStore.coordinates.altitude
    )

    result = result || new Quaternion()
    return Transforms.headingPitchRollQuaternion(
      position,
      hpr
    )
  }, false)
}

// Get model configuration based on vehicle type
const getModelConfig = () => {
  let modelUrl = '/models/boat.glb'
  let modelScale = 1.0
  let modelMinPixelSize = 50

  if (vehicleStore.vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) {
    modelUrl = '/models/boat.glb'
    modelScale = 0.5
  } else if (vehicleStore.vehicleType === MavType.MAV_TYPE_SUBMARINE) {
    modelUrl = "/models/bluerov.glb"
    modelScale = 10
  }

  return { modelUrl, modelScale, modelMinPixelSize }
}

// Initialize Cesium viewer
onMounted(async () => {
  if (!cesiumContainer.value) return

  const terrainProvider = await createWorldTerrainAsync()

  viewer.value = new Viewer(cesiumContainer.value, {
    terrainProvider,
    baseLayerPicker: false,
    timeline: false,
    animation: false,
    homeButton: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    geocoder: false,
    fullscreenButton: false
  })

  createVehicleEntity()
})

// Create and update vehicle entity
const createVehicleEntity = () => {
  if (!viewer.value) return

  if (vehicleEntity.value) {
    viewer.value.entities.remove(vehicleEntity.value)
  }

  const { modelUrl, modelScale, modelMinPixelSize } = getModelConfig()

  vehicleEntity.value = viewer.value.entities.add({
    position: createPositionCallback(),
    orientation: createOrientationCallback(),
    model: new ModelGraphics({
      uri: modelUrl,
      scale: modelScale,
      minimumPixelSize: modelMinPixelSize,
      maximumScale: 1000,
      runAnimations: false,
      heightReference: HeightReference.RELATIVE_TO_GROUND
    })
  })
  
  // Set the entity to be tracked by the camera
  viewer.value.trackedEntity = vehicleEntity.value
  
  // Configure the tracking behavior
  viewer.value.scene.camera.percentageChanged = 0.01
}

// Cleanup on unmount
onBeforeUnmount(() => {
  if (viewer.value) {
    viewer.value.destroy()
  }
})
</script>

<style>
.page-base {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map {
  position: absolute;
  z-index: 0;
  height: 100%;
  width: 100%;
}

.cesium-viewer-bottom {
  display: none;
}

.cesium-widget-credits {
  display: none !important;
}
</style>