<template>
  <div class="main">
    <canvas ref="canvasRef" :width="canvasSize.width" :height="canvasSize.height" />
    <!-- POI icons container -->
    <div v-if="widget.options.poi?.showPoiOnHUD" ref="poiIconsContainer">
      <div
        v-for="poiMarker in poiMarkers"
        :key="poiMarker.poiId"
        class="poi-icon-marker"
        :style="poiMarker.style"
        @click="handlePoiClick(poiMarker.poiId)"
      >
        <div
          :class="['mdi', poiMarker.icon, { 'poi-marker-reached': poiMarker.isReached }]"
          :style="{ backgroundColor: poiMarker.color, fontSize: poiMarker.size + 'px' }"
        ></div>
        <div
          v-if="shouldShowDistanceTag(poiMarker.poiId)"
          class="poi-distance-label"
          :style="{
            fontSize: poiMarker.distanceFontSize + 'px',
            ...(poiMarker.distanceLabelOpacity !== undefined && { opacity: poiMarker.distanceLabelOpacity }),
            ...(poiMarker.distanceLabelZIndex !== undefined && { zIndex: poiMarker.distanceLabelZIndex }),
          }"
        >
          {{ poiMarker.distanceText }}
        </div>
      </div>
      <!-- POI distance box for onHudSide mode -->
      <div
        v-if="
          widget.options.poi?.showPoiOnHUD && widget.options.poi?.showDistances === 'onHudSide' && highlightedPoiMarker
        "
        ref="poiSideDistanceBox"
        class="poi-side-distance-box"
        :style="interfaceStore.globalGlassMenuStyles"
      >
        <div class="poi-side-distance-name">{{ highlightedPoiMarker.name }}</div>
        <div class="poi-side-distance-label" :class="{ 'poi-reached-blink': highlightedPoiMarker.isReached }">
          {{ highlightedPoiMarker.distanceText }}
        </div>
      </div>
    </div>
  </div>
  <v-dialog v-model="widgetStore.widgetManagerVars(widget.hash).configMenuOpen" min-width="400" max-width="35%">
    <v-card class="px-8 pb-2 pt-2" :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-center">HUD Compass widget config</v-card-title>
      <v-btn
        class="absolute top-3 right-0 text-lg rounded-full"
        variant="text"
        size="small"
        @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false"
      >
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-card-text>
        <div class="flex w-full justify-between">
          <v-switch
            class="ma-1"
            label="Show yaw value"
            :color="widget.options.showYawValue ? 'white' : undefined"
            :model-value="widget.options.showYawValue"
            hide-details
            @change="widget.options.showYawValue = !widget.options.showYawValue"
          />
          <v-switch
            class="ma-1"
            label="Use -180/+180 range"
            :color="widget.options.useNegativeRange ? 'white' : undefined"
            :model-value="widget.options.useNegativeRange"
            hide-details
            @change="widget.options.useNegativeRange = !widget.options.useNegativeRange"
          />
        </div>
        <v-divider class="mb-3 opacity-5" />
        <div class="flex w-full justify-between">
          <v-switch
            class="ma-1 w-[220px]"
            label="Show POIs on HUD"
            :color="widget.options.poi?.showPoiOnHUD ? 'white' : undefined"
            :model-value="widget.options.poi?.showPoiOnHUD ?? true"
            hide-details
            @change="
              widget.options.poi = { ...widget.options.poi, showPoiOnHUD: !(widget.options.poi?.showPoiOnHUD ?? true) }
            "
          />
          <v-select
            v-if="widget.options.poi?.showPoiOnHUD"
            v-model="widget.options.poi.showDistances"
            :items="[
              { title: 'All markers', value: 'all' },
              { title: 'Highlighted marker only', value: 'highlightedMarker' },
              { title: 'Box on HUD side', value: 'onHudSide' },
              { title: 'No distance tags', value: 'none' },
            ]"
            label="Show distance tags"
            class="mt-2 max-w-[280px]"
            density="compact"
            hide-details
          />
        </div>
        <v-divider class="mt-3 opacity-5" />
        <v-expansion-panels theme="dark" class="mt-3">
          <v-expansion-panel class="bg-[#FFFFFF11] text-white mt-2">
            <v-expansion-panel-title>Color</v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-color-picker
                v-model="widget.options.hudColor"
                theme="dark"
                class="ma-1 bg-[#FFFFFF11] text-white"
                :swatches="colorSwatches"
                width="100%"
                show-swatches
              />
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
      <div class="flex justify-center w-full">
        <v-divider class="opacity-20 border-[#fafafa]"></v-divider>
      </div>
      <v-card-actions>
        <div class="flex w-full h-full justify-end items-center pt-1">
          <v-btn class="-mr-4" @click="widgetStore.widgetManagerVars(widget.hash).configMenuOpen = false">Close</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useDebounceFn, useElementVisibility, useWindowSize } from '@vueuse/core'
import { colord } from 'colord'
import gsap from 'gsap'
import { computed, onBeforeMount, onBeforeUnmount, onMounted, reactive, ref, toRefs, watch } from 'vue'

import { calculateHaversineDistance } from '@/libs/mission/general-estimates'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { degrees, radians, resetCanvas } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { HighlightedPoiMarker, HighlightedPoiMarkerDisplay, PoiMarker, ReachedPoiMarker } from '@/types/mission'
import type { Widget } from '@/types/widgets'

const widgetStore = useWidgetManagerStore()
const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()

datalogger.registerUsage(DatalogVariable.heading)
const store = useMainVehicleStore()
const props = defineProps<{
  /**
   * Widget reference
   */
  widget: Widget
}>()
const widget = toRefs(props).widget

// Pre-defined HUD colors
const colorSwatches = ref([['#FFFFFF'], ['#FF2D2D'], ['#0ADB0ACC']])

// prettier-ignore
const angleRender = (angle: number): string => {
  switch (angle) {
    case -180: return 'S'
    case -135: return 'SW'
    case -90: return 'W'
    case -45: return 'NW'
    case 0: return 'N'
    case 45: return 'NE'
    case 90: return 'E'
    case 135: return 'SE'
    case 180: return 'S'
    case 225: return 'SW'
    case 270: return 'W'
    case 315: return 'NW'
    case 360: return 'N'
    default:
      return `${angle}°`
  }
}

type RenderVariables = {
  /**
   * Object that stores the current state of the variables used on rendering
   * It acts like a buffer between the system state variables and the rendering process
   * Without it the state variables would be synced with rendering, which would
   * make the rendering aliased. With this buffer we use GSAP to control the transisioning smoothing process.
   */
  yawLinesX: { [angle: string]: number }
}
const renderVars = reactive<RenderVariables>({ yawLinesX: {} })

// Yaw angles for which vertical indication lines are rendered.
const yawAngles: number[] = []
let i = -180
while (i < 181) {
  yawAngles.push(i)
  i += 3
}

onBeforeMount(() => {
  // Set initial widget options if they don't exist
  if (Object.keys(widget.value.options).length === 0) {
    widget.value.options = {
      showYawValue: true,
      hudColor: colorSwatches.value[0][0],
      useNegativeRange: false,
      poi: {
        showPoiOnHUD: true,
        showDistances: 'onHudSide',
      },
    }
  }
  // Initialize POI options if they don't exist
  if (!widget.value.options.poi) {
    widget.value.options.poi = {
      showPoiOnHUD: true,
      showDistances: 'onHudSide',
    }
  }
})
onMounted(() => {
  yawAngles.forEach((angle: number) => (renderVars.yawLinesX[angle] = angleX(angle)))
  renderCanvas()
  // Start animation loop if widget is visible
  if (widgetStore.isWidgetVisible(widget.value)) {
    startAnimationLoop()
  }
})

// Make canvas size follows window resizing
const { width: windowWidth } = useWindowSize()
const canvasSize = computed(() => ({
  width: widget.value.size.width * windowWidth.value,
  height: 64,
}))

// The implementation below makes sure we don't update the Yaw value in the widget whenever
// the system Yaw (from vehicle) updates, preventing unnecessary performance bottlenecks.
const yaw = ref(0)
let oldYaw: number | undefined = undefined
watch(store.attitude, (attitude) => {
  const yawDiff = Math.abs(degrees(attitude.yaw - (oldYaw || 0)))
  if (yawDiff > 0.1) {
    oldYaw = attitude.yaw
    yaw.value = degrees(store.attitude.yaw)
  }
})

// Returns the projected X position of the yaw line for a given angle
const angleX = (angle: number): number => {
  const diff = angle - yaw.value || 0
  let x = -diff
  if (x < -180) {
    x += 360
  } else if (x > 180) {
    x -= 360
  }
  return -x
}

// Calculate bearing from vehicle position to POI
const calculateBearing = (vehicleLat: number, vehicleLng: number, poiLat: number, poiLng: number): number => {
  const lat1 = radians(vehicleLat)
  const lat2 = radians(poiLat)
  const dLng = radians(poiLng - vehicleLng)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  let bearing = degrees(Math.atan2(y, x))
  bearing = (bearing + 360) % 360
  return bearing
}

// Get POI data with bearing and distance relative to vehicle
const poiData = computed(() => {
  if (!store.coordinates.latitude || !store.coordinates.longitude) return []

  return missionStore.pointsOfInterest.map((poi) => {
    const distance = calculateHaversineDistance(
      [store.coordinates.latitude!, store.coordinates.longitude!],
      poi.coordinates
    )
    const bearing = calculateBearing(
      store.coordinates.latitude!,
      store.coordinates.longitude!,
      poi.coordinates[0],
      poi.coordinates[1]
    )

    return {
      poi,
      distance,
      bearing,
    }
  })
})

const canvasRef = ref<HTMLCanvasElement | undefined>()
const canvasContext = ref()
const poiMarkers = ref<PoiMarker[]>([])
const highlightedMarkers = ref<Map<string, HighlightedPoiMarker>>(new Map())
const highlightedPoiMarker = ref<HighlightedPoiMarkerDisplay | null>(null)
const markersOnHeading = ref<Set<string>>(new Set())
const reachedMarkers = ref<Map<string, ReachedPoiMarker>>(new Map())

// Check if a POI is on the heading of the vehicle, within 3 degrees
const isMarkerOnHeading = (bearing: number, currentYaw: number): boolean => {
  let relativeBearing = bearing - currentYaw
  if (relativeBearing < -180) relativeBearing += 360
  if (relativeBearing > 180) relativeBearing -= 360
  return Math.abs(relativeBearing) <= 3
}

const handlePoiClick = (poiId: string): void => {
  const marker = poiMarkers.value.find((m) => m.poiId === poiId)
  if (!marker) return
  // How long to highlight the marker after a click on it (20 seconds)
  const now = Date.now()
  highlightedMarkers.value.set(poiId, {
    poiId,
    highlightedAt: now,
    expiresAt: now + 20000,
  })

  if (widget.value.options.poi?.showDistances === 'onHudSide') {
    highlightedPoiMarker.value = {
      name: marker.name,
      distanceText: marker.distanceText,
      isReached: marker.isReached,
    }
  }
}

const cleanupExpired = (): void => {
  const now = Date.now()
  for (const [poiId, highlight] of highlightedMarkers.value.entries()) {
    if (highlight.expiresAt < now) highlightedMarkers.value.delete(poiId)
  }
  for (const [poiId, reached] of reachedMarkers.value.entries()) {
    if (reached.expiresAt < now) reachedMarkers.value.delete(poiId)
  }
}

const shouldShowDistanceTag = (poiId: string): boolean => {
  const mode = widget.value.options.poi?.showDistances ?? 'all'
  if (mode === 'none' || mode === 'onHudSide') return false
  if (mode === 'all') return true
  return markersOnHeading.value.has(poiId) || highlightedMarkers.value.has(poiId)
}

const renderCanvas = (): void => {
  if (canvasRef.value === undefined || canvasRef.value === null) return
  if (canvasContext.value === undefined) {
    console.debug('Canvas context undefined!')
    canvasContext.value = canvasRef.value.getContext('2d')
    return
  }
  const ctx = canvasContext.value
  resetCanvas(ctx)

  const halfCanvasWidth = 0.5 * canvasSize.value.width
  const halfCanvasHeight = 0.5 * canvasSize.value.height
  const linesFontSize = 12
  const refFontSize = 16
  const refTriangleSize = 10
  const stdPad = 2
  const minorLinesGap = 7

  // Set canvas general properties
  ctx.textAlign = 'center'
  ctx.strokeStyle = 'white'
  ctx.font = `bold ${linesFontSize}px Arial`
  ctx.fillStyle = 'white'

  // Draw line for each angle
  for (const [angle, x] of Object.entries(renderVars.yawLinesX)) {
    if (x < -90 || x > 90) continue
    const angleOffsetX = ((2 * halfCanvasWidth) / Math.PI) * Math.sin(radians(x))
    const anglePositionX = halfCanvasWidth + angleOffsetX
    ctx.beginPath()
    ctx.moveTo(anglePositionX, refFontSize + stdPad + refTriangleSize + stdPad)
    ctx.lineTo(anglePositionX, halfCanvasHeight * 2 - linesFontSize - stdPad - minorLinesGap)
    ctx.lineWidth = '1'

    // For angles that are multiple of 15 degrees, use a bolder line and write angle down
    if (Number(angle) % 15 === 0) {
      ctx.lineWidth = '2'
      ctx.lineTo(anglePositionX, halfCanvasHeight * 2 - linesFontSize - stdPad)
      let finalAngle = Number(angle)
      if (!widget.value.options.useNegativeRange) {
        finalAngle = finalAngle < 0 ? finalAngle + 360 : finalAngle
      }
      ctx.fillText(angleRender(Number(finalAngle)), anglePositionX, halfCanvasHeight * 2 - stdPad)
    }
    ctx.stroke()
  }

  // Draw reference text
  if (widget.value.options.showYawValue) {
    ctx.font = `bold ${refFontSize}px Arial`

    let finalAngle = Number(yaw.value)
    if (!widget.value.options.useNegativeRange) {
      finalAngle = finalAngle < 0 ? finalAngle + 360 : finalAngle
    }
    ctx.fillText(`${finalAngle.toFixed(1)}°`, halfCanvasWidth, refFontSize)
  }

  // Draw reference triangle
  ctx.beginPath()
  ctx.moveTo(halfCanvasWidth, refFontSize + stdPad + refTriangleSize)
  ctx.lineTo(halfCanvasWidth - 0.5 * refTriangleSize, stdPad + refFontSize + stdPad)
  ctx.lineTo(halfCanvasWidth + 0.5 * refTriangleSize, stdPad + refFontSize + stdPad)
  ctx.lineTo(halfCanvasWidth, refFontSize + stdPad + refTriangleSize)
  ctx.closePath()
  ctx.fill()

  // Add transparent mask over widget borders
  ctx.globalCompositeOperation = 'source-in'
  const grH = ctx.createLinearGradient(0, halfCanvasHeight, canvasSize.value.width, halfCanvasHeight)
  grH.addColorStop(0.18, colord(widget.value.options.hudColor).alpha(0).toRgbString())
  grH.addColorStop(0.3, colord(widget.value.options.hudColor).alpha(1).toRgbString())
  grH.addColorStop(0.7, colord(widget.value.options.hudColor).alpha(1).toRgbString())
  grH.addColorStop(0.82, colord(widget.value.options.hudColor).alpha(0).toRgbString())
  ctx.fillStyle = grH
  ctx.fillRect(0, 0, canvasSize.value.width, halfCanvasHeight * 2)
}

const updatePoiMarkers = (): void => {
  if (!widget.value.options.poi?.showPoiOnHUD || !store.coordinates.latitude || !store.coordinates.longitude) {
    poiMarkers.value = []
    return
  }

  const width = canvasSize.value.width
  const halfWidth = width * 0.5
  const now = Date.now()
  const markers: PoiMarker[] = []
  const onHeading = new Set<string>()

  poiData.value.forEach(({ poi, distance, bearing }) => {
    let relativeBearing = bearing - yaw.value
    if (relativeBearing < -180) relativeBearing += 360
    if (relativeBearing > 180) relativeBearing -= 360

    if (Math.abs(relativeBearing) > 90) return

    if (isMarkerOnHeading(bearing, yaw.value)) {
      onHeading.add(poi.id)
    }

    const x = halfWidth + ((2 * halfWidth) / Math.PI) * Math.sin(radians(relativeBearing))
    const isReachedNow = distance <= 1
    // How long the POI will stay marked as reached (blinking animation)
    if (isReachedNow) {
      reachedMarkers.value.set(poi.id, {
        poiId: poi.id,
        reachedAt: now,
        expiresAt: now + 20000,
      })
    }

    const reachedData = reachedMarkers.value.get(poi.id)
    const isReached = isReachedNow || (reachedData !== undefined && now < reachedData.expiresAt)
    // How far from a POI to mark as reached (2 meters)
    const distanceText = isReached
      ? 'Reached'
      : distance >= 2000
      ? `${(distance / 1000).toFixed(1)}km`
      : `${Math.round(distance)}m`

    const mode = widget.value.options.poi?.showDistances
    const isHighlighted = highlightedMarkers.value.has(poi.id)
    const isOnHeadingNow = onHeading.has(poi.id)
    let distanceLabelOpacity: string | undefined
    let distanceLabelZIndex: string | undefined
    let zIndex: string | undefined

    if (mode === 'highlightedMarker') {
      const angularDist = Math.abs(relativeBearing)
      const opacity = angularDist <= 60 ? (1.0 - (angularDist / 60) * 0.6).toFixed(2) : '0.4'
      distanceLabelOpacity = isHighlighted || isOnHeadingNow ? '1.0' : opacity
    }

    markers.push({
      poiId: poi.id,
      name: poi.name,
      icon: poi.icon,
      color: poi.color || '#FF0000',
      size: 10,
      distanceText,
      distanceFontSize: 9,
      ...(distanceLabelOpacity && { distanceLabelOpacity }),
      ...(distanceLabelZIndex && { distanceLabelZIndex }),
      ...(isReached && { isReached: true }),
      style: {
        left: `${x}px`,
        top: '38%',
        transform: 'translate(-50%, -50%)',
        ...(zIndex && { zIndex }),
      },
    })
  })

  markersOnHeading.value = onHeading
  // How long to highlight the marker for after it is on heading
  for (const poiId of onHeading) {
    if (!highlightedMarkers.value.has(poiId)) {
      highlightedMarkers.value.set(poiId, {
        poiId,
        highlightedAt: now,
        expiresAt: now + 5000,
      })
    }
  }

  cleanupExpired()

  if (widget.value.options.poi?.showDistances === 'onHudSide') {
    const onHeadingArray = Array.from(onHeading)
    let selectedId: string | null = null

    if (onHeadingArray.length > 0) {
      const highlights = Array.from(highlightedMarkers.value.values())
        .filter((h) => onHeadingArray.includes(h.poiId))
        .sort((a, b) => b.highlightedAt - a.highlightedAt)
      selectedId = highlights[0]?.poiId ?? onHeadingArray[0]
    } else {
      const lastHighlighted = Array.from(highlightedMarkers.value.values()).sort(
        (a, b) => b.highlightedAt - a.highlightedAt
      )[0]
      selectedId = lastHighlighted?.poiId ?? null
    }

    if (selectedId) {
      const marker = markers.find((m) => m.poiId === selectedId) ?? poiMarkers.value.find((m) => m.poiId === selectedId)
      if (marker) {
        highlightedPoiMarker.value = {
          name: marker.name,
          distanceText: marker.distanceText,
          isReached: marker.isReached,
        }
      } else {
        const poi = missionStore.pointsOfInterest.find((p) => p.id === selectedId)
        if (poi && store.coordinates.latitude && store.coordinates.longitude) {
          const distance = calculateHaversineDistance(
            [store.coordinates.latitude, store.coordinates.longitude],
            poi.coordinates
          )
          // How far from a POI to mark as reached
          highlightedPoiMarker.value = {
            name: poi.name,
            distanceText:
              distance <= 1
                ? 'Reached'
                : distance >= 2000
                ? `${(distance / 1000).toFixed(1)}km`
                : `${Math.round(distance)}m`,
            isReached: distance <= 1,
          }
        } else {
          highlightedPoiMarker.value = null
        }
      }
    } else {
      highlightedPoiMarker.value = null
    }
  } else {
    highlightedPoiMarker.value = null
  }

  poiMarkers.value = markers
}

// Update the X position of each line in the render variables with GSAP to smooth the transition
watch(yaw, () => {
  yawAngles.forEach((angle: number) => {
    const position = angleX(angle)
    // Only interpolate angle render with GSAP when the angle is not changing
    // sides, so it doesn't cross across the screen.
    if (Math.abs(renderVars.yawLinesX[angle] - position) > 90) {
      renderVars.yawLinesX[angle] = position
    } else {
      gsap.to(renderVars.yawLinesX, { duration: 2.5, ease: 'elastic.out(1.2, 0.5)', [angle]: position })
    }
  })
})

// Update canvas and POI markers whenever reference variables changes
let animationFrameId: number | null = null
let isAnimating = false

const animationLoop = (): void => {
  if (widgetStore.isWidgetVisible(widget.value)) {
    renderCanvas()
  }
  if (isAnimating) {
    animationFrameId = requestAnimationFrame(animationLoop)
  }
}

const startAnimationLoop = (): void => {
  if (!isAnimating) {
    isAnimating = true
    animationFrameId = requestAnimationFrame(animationLoop)
  }
}

const stopAnimationLoop = (): void => {
  if (isAnimating) {
    isAnimating = false
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }
}

const debouncedUpdatePoiMarkers = useDebounceFn(updatePoiMarkers, 16)
watch([poiData, store.coordinates, canvasSize, yaw], debouncedUpdatePoiMarkers)

// Start both canvas and POI markers animation loop when widget becomes visible or data changes
watch([renderVars, canvasSize, widget.value.options], () => {
  if (widgetStore.isWidgetVisible(widget.value)) {
    startAnimationLoop()
  }
})

const canvasVisible = useElementVisibility(canvasRef)
watch(canvasVisible, (isVisible, wasVisible) => {
  if (isVisible && !wasVisible) {
    renderCanvas()
    startAnimationLoop()
  } else if (!isVisible && wasVisible) {
    stopAnimationLoop()
  }
})

onBeforeUnmount(() => {
  stopAnimationLoop()
})
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
  min-width: 200px;
  min-height: 60px;
}

.poi-icons-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.poi-icon-marker {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
  margin-top: 12px;
}

.poi-icon-marker .mdi {
  line-height: 1;
  border: 1px solid white;
  border-radius: 50%;
  color: white;
  padding: 4px;
}

.poi-distance-label {
  color: black;
  font-weight: bold;
  font-family: Arial, sans-serif;
  text-align: center;
  white-space: nowrap;
  margin-top: -4px;
  background-color: #ffffff;
  padding-inline: 2px;
  border-radius: 4px;
  border: 1px solid black;
}

.poi-side-distance-box {
  display: flex;
  flex-direction: column;
  border-color: #ffffff44 !important;
  border-radius: 4px;
  padding: 4px 12px;
  padding-top: 6px;
  margin: 0 auto;
  margin-left: 850px;
  margin-top: -60px;
  z-index: 10;
  max-width: 200px;
  gap: 4px;
}

.poi-side-distance-name {
  font-weight: bold;
  font-family: Arial, sans-serif;
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.poi-side-distance-label {
  font-weight: bold;
  font-family: Arial, sans-serif;
  font-size: 18px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.poi-marker-reached {
  animation: poi-blink 1s ease-in-out infinite;
}

.poi-reached-blink {
  animation: poi-blink 1s ease-in-out infinite;
}

@keyframes poi-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
