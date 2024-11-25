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
import { type Ref, computed, onBeforeMount, onBeforeUnmount, onMounted, ref, toRefs, watch } from 'vue'
import { 
  Viewer, 
  createWorldTerrainAsync, 
  Cartesian3, 
  Entity, 
  HeightReference,
  ModelGraphics,
  CallbackProperty,
  HeadingPitchRoll,
  Math as CesiumMath,
  Transforms,
  Quaternion,
  JulianDate
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

interface Position {
  lat: number;
  lon: number;
  alt: number;
  timestamp: number;
}

interface Attitude {
  yaw: number;
  pitch: number;
  roll: number;
  timestamp: number;
}

const prevPosition = ref<Position | null>(null)
const currentPosition = ref<Position | null>(null)
const prevAttitude = ref<Attitude | null>(null)
const currentAttitude = ref<Attitude | null>(null)

// Track update rates
const updateIntervals = ref<number[]>([])
const maxIntervalSamples = 10
const getAverageUpdateInterval = () => {
  if (updateIntervals.value.length === 0) return 200 // Default fallback
  const sum = updateIntervals.value.reduce((a, b) => a + b, 0)
  return sum / updateIntervals.value.length
}

// Watch for position and attitude changes
watch(() => vehicleStore.coordinates, (newCoords) => {
  if (newCoords.latitude && newCoords.longitude) {
    const now = Date.now()
    
    if (currentPosition.value) {
      // Update our interval tracking
      const interval = now - currentPosition.value.timestamp
      updateIntervals.value.push(interval)
      if (updateIntervals.value.length > maxIntervalSamples) {
        updateIntervals.value.shift()
      }
      
      prevPosition.value = currentPosition.value
    }
    
    currentPosition.value = {
      lat: newCoords.latitude,
      lon: newCoords.longitude,
      alt: newCoords.altitude,
      timestamp: now
    }
  }
}, { deep: true })

watch(() => vehicleStore.attitude, (newAttitude) => {
  const now = Date.now()
  
  if (currentAttitude.value) {
    prevAttitude.value = currentAttitude.value
  }
  
  currentAttitude.value = {
    yaw: newAttitude.yaw,
    pitch: newAttitude.pitch,
    roll: newAttitude.roll,
    timestamp: now
  }
}, { deep: true })

const lerp = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor
}

const lerpAngle = (start: number, end: number, factor: number) => {
  let diff = end - start
  if (diff > globalThis.Math.PI) diff -= globalThis.Math.PI * 2
  if (diff < -globalThis.Math.PI) diff += globalThis.Math.PI * 2
  return start + diff * factor
}

// Create position callback property
const createPositionCallback = () => {
  return new CallbackProperty((time, result) => {
    if (!currentPosition.value || !prevPosition.value) {
      return currentPosition.value ? 
        Cartesian3.fromDegrees(
          currentPosition.value.lon,
          currentPosition.value.lat,
          currentPosition.value.alt
        ) : undefined
    }
    
    const now = Date.now()
    const updateInterval = getAverageUpdateInterval()
    const elapsed = now - currentPosition.value.timestamp
    const expectedInterval = updateInterval * 1 // Add some buffer for jitter
    
    // Calculate interpolation factor based on elapsed time relative to expected interval
    const interpolationFactor = globalThis.Math.min(elapsed / expectedInterval, 1)
    
    // If we're at or past the expected next update, just use current position
    if (interpolationFactor >= 1) {
      return Cartesian3.fromDegrees(
        currentPosition.value.lon,
        currentPosition.value.lat,
        currentPosition.value.alt
      )
    }

    // Apply smoothstep interpolation for more natural motion
    const smoothFactor = interpolationFactor * interpolationFactor * (3 - 2 * interpolationFactor)
    
    // Interpolate between previous and current position
    const lat = lerp(prevPosition.value.lat, currentPosition.value.lat, smoothFactor)
    const lon = lerp(prevPosition.value.lon, currentPosition.value.lon, smoothFactor)
    const alt = lerp(prevPosition.value.alt, currentPosition.value.alt, smoothFactor)

    return Cartesian3.fromDegrees(lon, lat, alt)
  }, false)
}

// Create orientation callback property
const createOrientationCallback = () => {
  return new CallbackProperty((time, result) => {
    if (!currentAttitude.value || !currentPosition.value) {
      return undefined
    }
    
    if (!prevAttitude.value) {
      const hpr = new HeadingPitchRoll(
        currentAttitude.value.yaw - CesiumMath.PI_OVER_TWO,
        currentAttitude.value.pitch,
        currentAttitude.value.roll
      )
      
      const position = Cartesian3.fromDegrees(
        currentPosition.value.lon,
        currentPosition.value.lat,
        currentPosition.value.alt
      )

      result = result || new Quaternion()
      return Transforms.headingPitchRollQuaternion(position, hpr)
    }
    
    const now = Date.now()
    const updateInterval = getAverageUpdateInterval()
    const elapsed = now - currentAttitude.value.timestamp
    const expectedInterval = updateInterval * 1.5 // Add some buffer for jitter
    
    // Calculate interpolation factor based on elapsed time relative to expected interval
    const interpolationFactor = globalThis.Math.min(elapsed / expectedInterval, 1)
    
    // Apply smoothstep interpolation
    const smoothFactor = interpolationFactor * interpolationFactor * (3 - 2 * interpolationFactor)
    
    // Interpolate angles
    const yaw = lerpAngle(prevAttitude.value.yaw, currentAttitude.value.yaw, smoothFactor)
    const pitch = lerpAngle(prevAttitude.value.pitch, currentAttitude.value.pitch, smoothFactor)
    const roll = lerpAngle(prevAttitude.value.roll, currentAttitude.value.roll, smoothFactor)
    
    const hpr = new HeadingPitchRoll(
      yaw - CesiumMath.PI_OVER_TWO,
      pitch,
      roll
    )
    
    const position = Cartesian3.fromDegrees(
      currentPosition.value.lon,
      currentPosition.value.lat,
      currentPosition.value.alt
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