<template>
  <v-tooltip location="top center" :text="props.isActive ? 'End Measure Mode' : 'Measure Mode'">
    <template #activator="{ props: tooltipProps }">
      <v-btn
        v-bind="tooltipProps"
        class="absolute m-3 rounded-sm shadow-sm bottom-12 right-[178px] text-[14px]"
        :class="{ 'bg-red-500': props.isActive }"
        :style="
          props.isActive
            ? { ...interfaceStore.globalGlassMenuStyles, backgroundColor: '#ef4444' }
            : interfaceStore.globalGlassMenuStyles
        "
        size="x-small"
        icon="mdi-ruler"
        @click="toggleMeasurement"
      />
    </template>
  </v-tooltip>
  <div v-if="props.isActive" class="measurement-report-container" :style="interfaceStore.globalGlassMenuStyles">
    <div class="measurement-report">
      <div class="measurement-report-header">
        <div class="measurement-report-title">Measuring tool</div>
        <div class="measurement-report-menu-container">
          <button class="measurement-report-menu-button" @click.stop="toggleMenu">
            <v-icon icon="mdi-dots-vertical" size="16" />
          </button>
          <div v-show="menuVisible" class="measurement-report-menu">
            <button class="measurement-report-menu-item" @click="handleMenuAction('options')">Options</button>
            <v-divider class="opacity-5" />
            <button
              class="measurement-report-menu-item"
              :class="{ disabled: !hasMeasurementsOnMap }"
              :disabled="!hasMeasurementsOnMap"
              @click="handleMenuAction('clear')"
            >
              Clear Metrics
            </button>
            <v-divider class="opacity-5" />
            <button
              class="measurement-report-menu-item"
              :class="{ disabled: !hasMeasurementsOnMap }"
              :disabled="!hasMeasurementsOnMap"
              @click="handleMenuAction('export')"
            >
              Export Measurements
            </button>
            <v-divider class="opacity-5" />
            <button class="measurement-report-menu-item" @click="handleMenuAction('import')">
              Import Measurements
            </button>
          </div>
        </div>
      </div>
      <div class="measurement-report-row">
        <span class="measurement-report-label">Total Distance:</span>
        <span class="measurement-report-value">{{ formattedTotalDistance }}</span>
      </div>
      <template v-if="aggregatedArea > 0">
        <div class="measurement-report-row">
          <span class="measurement-report-label">Area (auto-closed):</span>
          <span class="measurement-report-value">{{ formattedArea }}</span>
        </div>
        <div class="measurement-report-row">
          <span class="measurement-report-label">Perimeter (auto-closed):</span>
          <span class="measurement-report-value">{{ formattedPerimeter }}</span>
        </div>
      </template>
      <div class="measurement-report-row">
        <span class="measurement-report-label">Avg Segment length:</span>
        <span class="measurement-report-value">{{ formattedAvgSegment }}</span>
      </div>
      <div class="measurement-report-row">
        <span class="measurement-report-label">Min/Max length:</span>
        <span class="measurement-report-value">{{ formattedMin }} / {{ formattedMax }}</span>
      </div>
      <div class="measurement-report-row">
        <span class="measurement-report-label">Segments:</span>
        <span class="measurement-report-value">{{ aggregatedNumSegments }}</span>
      </div>
      <div class="measurement-report-row">
        <span class="measurement-report-label">Vertexes:</span>
        <span class="measurement-report-value">{{ aggregatedVertexCount }}</span>
      </div>
      <div class="measurement-opacity-row">
        <v-icon icon="mdi-circle-opacity" size="14" class="opacity-icon" />
        <v-slider
          v-model="measurementOpacity"
          :min="0.05"
          :max="1"
          :step="0.05"
          hide-details
          color="white"
          class="measurement-opacity-slider"
        />
      </div>
    </div>
  </div>
  <v-dialog v-model="optionsDialogVisible" persistent max-width="500px">
    <v-card :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-lg text-center font-semibold">Measurement Options</v-card-title>

      <v-icon icon="mdi-close" class="absolute top-3 right-3" @click="optionsDialogVisible = false" />
      <v-card-text>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">Unit System</label>
          <v-select
            v-model="localUnitSystem"
            theme="dark"
            :items="unitSystemItems"
            item-title="title"
            item-value="value"
            density="compact"
            hide-details
            class="w-full border"
          />
          <p class="text-[11px] opacity-70 mt-1">Unit system for displaying distances and areas.</p>
        </div>
        <div class="mb-6">
          <v-checkbox
            v-model="showDistanceTags"
            label="Show Distance Tags"
            theme="dark"
            density="compact"
            hide-details
            class="w-full"
          />
          <v-checkbox
            v-model="showAngleTags"
            label="Show Angle Tags"
            theme="dark"
            density="compact"
            hide-details
            class="w-full"
          />
        </div>
        <div class="mb-2">
          <label class="block text-sm font-medium mb-1">Tag Size: {{ tagSize }}px</label>
          <v-slider v-model="tagSize" min="8" max="20" step="1" density="compact" color="white"></v-slider>
        </div>
        <div class="mb-4">
          <div class="flex flex-row justify-between items-center w-full gap-x-3">
            <v-menu
              :close-on-content-click="false"
              location="top start"
              origin="top start"
              transition="scale-transition"
              class="overflow-hidden"
            >
              <template #activator="{ props: menuProps }">
                <span class="text-sm font-bold text-white text-start">Distance Tag Background</span>
                <div
                  v-bind="menuProps"
                  class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full cursor-pointer"
                  :style="{
                    backgroundColor: rgbaToCss(distanceTagColor),
                  }"
                ></div>
              </template>
              <v-card class="overflow-hidden">
                <v-color-picker v-model="distanceTagColor" mode="rgba" width="400px" theme="dark" />
              </v-card>
            </v-menu>
          </div>
        </div>
        <div class="mb-4">
          <div class="flex flex-row justify-between items-center w-full gap-x-3">
            <v-menu
              :close-on-content-click="false"
              location="top start"
              origin="top start"
              transition="scale-transition"
              class="overflow-hidden"
            >
              <template #activator="{ props: menuProps }">
                <span class="text-sm font-bold text-white text-start">Angle Tag Background</span>
                <div
                  v-bind="menuProps"
                  class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full cursor-pointer"
                  :style="{
                    backgroundColor: rgbaToCss(angleTagColor),
                  }"
                ></div>
              </template>
              <v-card class="overflow-hidden">
                <v-color-picker v-model="angleTagColor" mode="rgba" width="400px" theme="dark" />
              </v-card>
            </v-menu>
          </div>
        </div>
        <div class="mb-4">
          <div class="flex flex-row justify-between items-center w-full gap-x-3">
            <v-menu
              :close-on-content-click="false"
              location="top start"
              origin="top start"
              transition="scale-transition"
              class="overflow-hidden"
            >
              <template #activator="{ props: menuProps }">
                <span class="text-sm font-bold text-white text-start">Line Color</span>
                <div
                  v-bind="menuProps"
                  class="w-[20px] h-[20px] border-2 border-slate-600 rounded-full cursor-pointer"
                  :style="{
                    backgroundColor: rgbaToCss(lineColor),
                  }"
                ></div>
              </template>
              <v-card class="overflow-hidden">
                <v-color-picker v-model="lineColor" mode="rgba" width="400px" theme="dark" />
              </v-card>
            </v-menu>
          </div>
        </div>
      </v-card-text>
      <v-divider class="mx-8" />
      <v-card-actions>
        <div class="flex justify-between items-center w-full pa-1">
          <v-btn size="small" color="white" @click="missionStore.measurementOptions = { ...defaultMeasurementOptions }">
            Reset to Defaults
          </v-btn>
          <v-btn color="white" @click="optionsDialogVisible = false">Close</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import L from 'leaflet'
import { type Ref, computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { defaultMeasurementOptions } from '@/assets/defaults'
import { useMapLayer } from '@/composables/map/useMapLayer'
import {
  bearingBetween,
  calculateHaversineDistance,
  deltaBearing,
  polygonAreaSquareMeters,
} from '@/libs/mission/general-estimates'
import { formatArea, formatDistance, unitSystemItems } from '@/libs/units'
import { rgbaToCss } from '@/libs/utils/ui'
import { bearingToCompassDirection, calculateSnappedPosition } from '@/libs/utils-map'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'
import type { UnitSystem } from '@/types/units'
import type { RgbaColor } from '@/types/user-interface'

/**
 * Props for the MeasurementTool component
 */
interface Props {
  /**
   * The zoom level of the map
   */
  zoom: number
  /**
   * Whether the measurement tool is active
   */
  isActive: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:isActive', value: boolean): void
}>()

const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()

const toggleMeasurement = (): void => {
  emit('update:isActive', !props.isActive)
}

const { mapLayer } = useMapLayer()

const map = computed(() => mapLayer.value ?? null)

const MEASUREMENT_PANE = 'measurementPane'

const ensureMeasurementPane = (mapInstance: L.Map): void => {
  if (!mapInstance.getPane(MEASUREMENT_PANE)) {
    mapInstance.createPane(MEASUREMENT_PANE)
    const pane = mapInstance.getPane(MEASUREMENT_PANE)
    if (pane) pane.style.zIndex = '650'
  }
}

const setNonMeasurementInteractivity = (mapInstance: L.Map, interactive: boolean): void => {
  const container = mapInstance.getContainer()
  if (interactive) {
    container.classList.remove('measurement-mode-active')
  } else {
    container.classList.add('measurement-mode-active')
  }
}

const isAltPressed = ref(false)

const measurementPoints = ref<L.LatLng[]>([])
const measurementPolyline = shallowRef<L.Polyline | null>(null)
const measurementMarkers = shallowRef<L.Marker[]>([])
const measurementDistanceTags = shallowRef<L.Marker[]>([])
const measurementAngleTags = shallowRef<L.Marker[]>([])
const measurementAngleArcs = shallowRef<L.Polyline[]>([])
const measurementLiveLine = shallowRef<L.Polyline | null>(null)
const measurementLiveLineHeading = shallowRef<L.Marker | null>(null)
const measurementDeletePopupVisible = ref<number | null>(null)
const isDraggingVertex = ref(false)

/**
 * Delete popup for completed measurements
 */
const completedMeasurementDeletePopupVisible = ref<{
  /**
   * Index of the completed measurement
   */
  completedIndex: number
  /**
   * Index of the marker
   */
  markerIndex: number
} | null>(null)

/**
 * Completed measurements
 */
interface CompletedMeasurement {
  /**
   * Points of the completed measurement
   */
  points: L.LatLng[]
  /**
   * Polyline of the completed measurement
   */
  polyline: L.Polyline
  /**
   * Markers of the completed measurement
   */
  markers: L.Marker[]
  /**
   * Distance tags of the completed measurement
   */
  distanceTags: L.Marker[]
  /**
   * Angle tags of the completed measurement
   */
  angleTags: L.Marker[]
  /**
   * Angle arcs of the completed measurement
   */
  angleArcs: L.Polyline[]
}

const completedMeasurements = ref([]) as Ref<CompletedMeasurement[]>
const menuVisible = ref<boolean>(false)
const optionsDialogVisible = ref<boolean>(false)

/**
 * Hides all active and completed measurement delete popups
 */
const hideAllDeletePopups = (): void => {
  measurementDeletePopupVisible.value = null
  measurementMarkers.value.forEach((marker) => {
    const popup = marker.getElement()?.querySelector('.measurement-delete-popup') as HTMLDivElement
    if (popup) popup.style.display = 'none'
  })
  completedMeasurementDeletePopupVisible.value = null
  completedMeasurements.value.forEach((completed) => {
    completed.markers.forEach((marker) => {
      const popup = marker.getElement()?.querySelector('.measurement-delete-popup') as HTMLDivElement
      if (popup) popup.style.display = 'none'
    })
  })
}

const MARKER_HIT_THRESHOLD_PX = 10

/**
 * Finds the nearest marker within threshold to a screen point
 * @param {L.Map} mapInstance - The Leaflet map
 * @param {L.Point} screenPoint - The click/cursor position in container pixels
 * @param {L.Marker[]} markers - Markers to search
 * @returns {number} Index of the nearest marker within threshold, or -1
 */
const findNearestMarkerIndex = (mapInstance: L.Map, screenPoint: L.Point, markers: L.Marker[]): number => {
  for (let i = 0; i < markers.length; i++) {
    const markerPoint = mapInstance.latLngToContainerPoint(markers[i].getLatLng())
    if (screenPoint.distanceTo(markerPoint) < MARKER_HIT_THRESHOLD_PX) return i
  }
  return -1
}

// Computed properties for individual options (for v-model binding)
const localUnitSystem = computed({
  get: () => missionStore.measurementOptions.unitSystem,
  set: (value: UnitSystem) => {
    missionStore.measurementOptions = { ...missionStore.measurementOptions, unitSystem: value }
  },
})

const showDistanceTags = computed({
  get: () => missionStore.measurementOptions.showDistanceTags,
  set: (value: boolean) => {
    missionStore.measurementOptions = { ...missionStore.measurementOptions, showDistanceTags: value }
  },
})

const showAngleTags = computed({
  get: () => missionStore.measurementOptions.showAngleTags,
  set: (value: boolean) => {
    missionStore.measurementOptions = { ...missionStore.measurementOptions, showAngleTags: value }
  },
})

const tagSize = computed({
  get: () => missionStore.measurementOptions.tagSize,
  set: (value: number) => {
    missionStore.measurementOptions = { ...missionStore.measurementOptions, tagSize: value }
  },
})

const distanceTagColor = computed({
  get: () => missionStore.measurementOptions.distanceTagColor,
  set: (value: RgbaColor) => {
    missionStore.measurementOptions = { ...missionStore.measurementOptions, distanceTagColor: value }
  },
})

const angleTagColor = computed({
  get: () => missionStore.measurementOptions.angleTagColor,
  set: (value: RgbaColor) => {
    missionStore.measurementOptions = { ...missionStore.measurementOptions, angleTagColor: value }
  },
})

const lineColor = computed({
  get: () => missionStore.measurementOptions.lineColor,
  set: (value: RgbaColor) => {
    missionStore.measurementOptions = { ...missionStore.measurementOptions, lineColor: value }
  },
})

const measurementOpacity = computed({
  get: () => missionStore.measurementOptions.opacity ?? 1,
  set: (value: number) => {
    missionStore.measurementOptions = { ...missionStore.measurementOptions, opacity: value }
  },
})

// Computed properties for report display
const hasEnoughPoints = computed(() => measurementPoints.value.length >= 2)

const hasMeasurementsOnMap = computed(() => hasEnoughPoints.value || completedMeasurements.value.length > 0)

const totalDistance = computed(() => {
  if (!hasEnoughPoints.value) return 0
  let total = 0
  for (let i = 0; i < measurementPoints.value.length - 1; i++) {
    const dist = calculateHaversineDistance(
      [measurementPoints.value[i].lat, measurementPoints.value[i].lng],
      [measurementPoints.value[i + 1].lat, measurementPoints.value[i + 1].lng]
    )
    total += dist
  }
  return total
})

const segmentDistances = computed(() => {
  if (!hasEnoughPoints.value) return []
  const distances: number[] = []
  for (let i = 0; i < measurementPoints.value.length - 1; i++) {
    const dist = calculateHaversineDistance(
      [measurementPoints.value[i].lat, measurementPoints.value[i].lng],
      [measurementPoints.value[i + 1].lat, measurementPoints.value[i + 1].lng]
    )
    distances.push(dist)
  }
  return distances
})

const aggregatedSegmentDistances = computed(() => {
  const all: number[] = [...segmentDistances.value]
  completedMeasurements.value.forEach((completed) => {
    const points = completed.points
    for (let i = 0; i < points.length - 1; i++) {
      all.push(calculateHaversineDistance([points[i].lat, points[i].lng], [points[i + 1].lat, points[i + 1].lng]))
    }
  })
  return all
})

const aggregatedTotalDistance = computed(() => {
  return aggregatedSegmentDistances.value.reduce((sum, d) => sum + d, 0)
})

const aggregatedNumSegments = computed(() => aggregatedSegmentDistances.value.length)

const aggregatedVertexCount = computed(() => {
  let n = measurementPoints.value.length
  completedMeasurements.value.forEach((c) => {
    n += c.points.length
  })
  return n
})

const aggregatedArea = computed(() => {
  let area = 0
  if (measurementPoints.value.length >= 3) {
    area += polygonAreaSquareMeters(measurementPoints.value.map((p) => [p.lat, p.lng] as WaypointCoordinates))
  }
  completedMeasurements.value.forEach((completed) => {
    if (completed.points.length >= 3) {
      area += polygonAreaSquareMeters(completed.points.map((p) => [p.lat, p.lng] as WaypointCoordinates))
    }
  })
  return area
})

const aggregatedPerimeter = computed(() => {
  let perimeter = 0
  if (measurementPoints.value.length >= 3) {
    const first = measurementPoints.value[0]
    const last = measurementPoints.value[measurementPoints.value.length - 1]
    perimeter += totalDistance.value + calculateHaversineDistance([first.lat, first.lng], [last.lat, last.lng])
  }
  completedMeasurements.value.forEach((completed) => {
    const points = completed.points
    if (points.length >= 3) {
      let segSum = 0
      for (let i = 0; i < points.length - 1; i++) {
        segSum += calculateHaversineDistance([points[i].lat, points[i].lng], [points[i + 1].lat, points[i + 1].lng])
      }
      segSum += calculateHaversineDistance(
        [points[0].lat, points[0].lng],
        [points[points.length - 1].lat, points[points.length - 1].lng]
      )
      perimeter += segSum
    }
  })
  return perimeter
})

// Local unit conversion functions using units.ts
const localUnitConversion = computed(() => {
  const unitSystem = localUnitSystem.value
  return {
    convertDistance: (meters: number): string => formatDistance(meters, unitSystem),
    convertArea: (squareMeters: number): string => formatArea(squareMeters, unitSystem),
  }
})

const formattedTotalDistance = computed(() => {
  return hasMeasurementsOnMap.value ? localUnitConversion.value.convertDistance(aggregatedTotalDistance.value) : '—'
})

const formattedAvgSegment = computed(() => {
  return aggregatedNumSegments.value > 0
    ? localUnitConversion.value.convertDistance(aggregatedTotalDistance.value / aggregatedNumSegments.value)
    : '—'
})

const formattedMin = computed(() => {
  return aggregatedSegmentDistances.value.length > 0
    ? localUnitConversion.value.convertDistance(Math.min(...aggregatedSegmentDistances.value))
    : '—'
})

const formattedMax = computed(() => {
  return aggregatedSegmentDistances.value.length > 0
    ? localUnitConversion.value.convertDistance(Math.max(...aggregatedSegmentDistances.value))
    : '—'
})

const formattedArea = computed(() => {
  return aggregatedArea.value > 0 ? localUnitConversion.value.convertArea(aggregatedArea.value) : '—'
})

const formattedPerimeter = computed(() => {
  return aggregatedPerimeter.value > 0 ? localUnitConversion.value.convertDistance(aggregatedPerimeter.value) : '—'
})

const toggleMenu = (): void => {
  menuVisible.value = !menuVisible.value
}

// Close menu when clicking outside
const closeMenuOnOutsideClick = (e: MouseEvent): void => {
  const target = e.target as HTMLElement
  if (!target.closest('.measurement-report-menu-container')) {
    menuVisible.value = false
  }
}

watch(menuVisible, (visible) => {
  if (visible) {
    nextTick(() => {
      document.addEventListener('click', closeMenuOnOutsideClick)
    })
  } else {
    document.removeEventListener('click', closeMenuOnOutsideClick)
  }
})

// Finalize current measurement (make it non-interactive and add to completed)
const finalizeCurrentMeasurement = (): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  // A valid measurement requires at least 2 points (i.e. a polyline).
  // Single lone vertices are discarded so they don't linger on the map.
  if (measurementPoints.value.length >= 2 && measurementPolyline.value) {
    measurementMarkers.value.forEach((marker) => {
      marker.dragging?.disable()
      marker.options.interactive = false
    })

    completedMeasurements.value.push({
      points: [...measurementPoints.value],
      polyline: measurementPolyline.value,
      markers: [...measurementMarkers.value],
      distanceTags: [...measurementDistanceTags.value],
      angleTags: [...measurementAngleTags.value],
      angleArcs: [...measurementAngleArcs.value],
    })
  } else {
    // Remove orphaned markers (lone vertex) from the map
    measurementMarkers.value.forEach((marker) => mapInstance.removeLayer(marker))
    if (measurementPolyline.value) mapInstance.removeLayer(measurementPolyline.value)
    measurementDistanceTags.value.forEach((tag) => tag.remove())
    measurementAngleTags.value.forEach((tag) => tag.remove())
    measurementAngleArcs.value.forEach((arc) => arc.remove())
  }

  // Reset current measurement state
  // Note: polyline is kept on map as part of completed measurement, so we just clear the reference
  measurementPoints.value = []
  measurementPolyline.value = null
  measurementMarkers.value = []
  measurementDistanceTags.value = []
  measurementAngleTags.value = []
  measurementAngleArcs.value = []
  if (measurementLiveLine.value) {
    mapInstance.removeLayer(measurementLiveLine.value)
    measurementLiveLine.value = null
  }
  if (measurementLiveLineHeading.value) {
    mapInstance.removeLayer(measurementLiveLineHeading.value)
    measurementLiveLineHeading.value = null
  }
  measurementDeletePopupVisible.value = null
}

/**
 * Re-attaches drag, click, and delete handlers to a marker that was restored from a completed measurement
 * @param {L.Marker} marker - The Leaflet marker to wire up
 * @param {number} pointIndex - Index of this marker in the active measurementPoints array
 */
const attachActiveMarkerHandlers = (marker: L.Marker, pointIndex: number): void => {
  marker.off('dragstart')
  marker.off('drag')
  marker.off('dragend')
  marker.off('click')
  marker.off('mouseover')
  marker.off('mouseout')

  marker.dragging?.enable()
  marker.options.interactive = true

  marker.on('dragstart', () => {
    isDraggingVertex.value = true
  })

  marker.on('drag', () => {
    const newLatlng = marker.getLatLng()
    const storedPoint = measurementPoints.value[pointIndex]
    storedPoint.lat = newLatlng.lat
    storedPoint.lng = newLatlng.lng
    marker.setLatLng(storedPoint)
    updateMeasurementDisplay()
  })

  marker.on('dragend', () => {
    isDraggingVertex.value = false
    const newLatlng = marker.getLatLng()
    const storedPoint = measurementPoints.value[pointIndex]
    storedPoint.lat = newLatlng.lat
    storedPoint.lng = newLatlng.lng
    marker.setLatLng(storedPoint)
    updateMeasurementDisplay()
  })

  marker.on('mouseover', () => {
    const popup = marker.getElement()?.querySelector('.measurement-delete-popup') as HTMLDivElement
    if (popup) {
      popup.style.display = measurementDeletePopupVisible.value === pointIndex ? 'block' : 'none'
    }
  })

  marker.on('mouseout', () => {
    if (measurementDeletePopupVisible.value !== pointIndex) {
      const popup = marker.getElement()?.querySelector('.measurement-delete-popup') as HTMLDivElement
      if (popup) popup.style.display = 'none'
    }
  })

  marker.on('click', (event: L.LeafletMouseEvent) => {
    if (!props.isActive) return
    L.DomEvent.stopPropagation(event.originalEvent)
    const deleteButton = (event.originalEvent?.target as HTMLElement)?.closest('.measurement-delete-button')
    if (deleteButton) {
      removeMeasurementPoint(pointIndex)
      measurementDeletePopupVisible.value = null
      L.DomEvent.preventDefault(event.originalEvent)
      return
    }
    if (measurementDeletePopupVisible.value === pointIndex) {
      measurementDeletePopupVisible.value = null
    } else {
      measurementDeletePopupVisible.value = pointIndex
    }
    const popup = marker.getElement()?.querySelector('.measurement-delete-popup') as HTMLDivElement
    if (popup) {
      popup.style.display = measurementDeletePopupVisible.value === pointIndex ? 'block' : 'none'
    }
  })
}

/**
 * Resumes drawing from a loose-end vertex of a completed measurement.
 * Extracts the completed measurement back into the active state, reversing
 * if needed so the clicked end becomes the tail for appending new points.
 * @param {number} completedIndex - Index in completedMeasurements array
 * @param {number} markerIndex - Index of the clicked marker (must be 0 or last)
 */
const resumeFromCompletedMeasurement = (completedIndex: number, markerIndex: number): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  const completed = completedMeasurements.value[completedIndex]
  if (!completed) return

  const isLooseEnd = markerIndex === 0 || markerIndex === completed.points.length - 1
  if (!isLooseEnd || measurementPoints.value.length > 0) return

  completedMeasurements.value.splice(completedIndex, 1)

  let points = [...completed.points]
  let markers = [...completed.markers]

  if (markerIndex === 0) {
    points.reverse()
    markers.reverse()
  }

  completed.distanceTags.forEach((tag) => tag.remove())
  completed.angleTags.forEach((tag) => tag.remove())
  completed.angleArcs.forEach((arc) => arc.remove())

  measurementPoints.value = points
  measurementPolyline.value = completed.polyline
  measurementMarkers.value = markers
  measurementDistanceTags.value = []
  measurementAngleTags.value = []
  measurementAngleArcs.value = []

  markers.forEach((marker, idx) => {
    attachActiveMarkerHandlers(marker, idx)
  })

  updateMeasurementDisplay()

  // Re-index remaining completed measurements' handlers
  makeCompletedMeasurementsEditable()
}

// Update a completed measurement's display (polyline, tags, etc.)
const updateCompletedMeasurementDisplay = (completed: CompletedMeasurement): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  // Sync marker positions with points array first (prevents detachment on zoom)
  // Use existing LatLng objects to maintain reference consistency with Leaflet
  for (let i = 0; i < completed.markers.length && i < completed.points.length; i++) {
    const marker = completed.markers[i]
    const point = completed.points[i]
    if (marker && point) {
      // Use the exact point object from array to maintain reference consistency
      // This prevents detachment by keeping Leaflet's internal state in sync
      marker.setLatLng(point)
    }
  }

  // Update polyline
  if (completed.polyline && completed.points.length >= 2) {
    completed.polyline.setLatLngs(completed.points)
    completed.polyline.setStyle({
      color: lineColorCss.value,
      opacity: lineColor.value.a * measurementOpacity.value,
    })
  }

  // Update marker opacity
  completed.markers.forEach((m) => m.setOpacity(measurementOpacity.value))

  // Remove old tags and arcs
  completed.distanceTags.forEach((tag) => tag.remove())
  completed.angleTags.forEach((tag) => tag.remove())
  completed.angleArcs.forEach((arc) => arc.remove())

  // Recreate using shared helpers
  completed.distanceTags = createDistanceTagElements(mapInstance, completed.points)
  const { tags, arcs } = createAngleElements(mapInstance, completed.points)
  completed.angleTags = tags
  completed.angleArcs = arcs
}

// Remove a point from a completed measurement
const removeCompletedMeasurementPoint = (completedIndex: number, markerIndex: number): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  const completed = completedMeasurements.value[completedIndex]
  if (!completed || markerIndex < 0 || markerIndex >= completed.points.length) return

  // If only 2 points left, remove the entire measurement
  if (completed.points.length === 2) {
    if (completed.polyline) mapInstance.removeLayer(completed.polyline)
    completed.markers.forEach((marker) => marker.remove())
    completed.distanceTags.forEach((tag) => tag.remove())
    completed.angleTags.forEach((tag) => tag.remove())
    completed.angleArcs.forEach((arc) => arc.remove())
    completedMeasurements.value.splice(completedIndex, 1)
    completedMeasurementDeletePopupVisible.value = null
    return
  }

  // Remove the marker
  const marker = completed.markers[markerIndex]
  if (marker) {
    mapInstance.removeLayer(marker)
    completed.markers.splice(markerIndex, 1)
  }

  // Remove the point
  completed.points.splice(markerIndex, 1)

  // Update display
  updateCompletedMeasurementDisplay(completed)

  // Re-attach all handlers with corrected indices after deletion
  if (props.isActive) {
    completed.markers.forEach((updatedMarker, idx) => {
      attachCompletedMarkerHandlers(updatedMarker, completed, completedIndex, idx)
    })
  }

  completedMeasurementDeletePopupVisible.value = null
}

// Attach delete button handler to a marker
const attachDeleteButtonHandler = (marker: L.Marker, completedIndex: number, markerIndex: number): void => {
  const markerElement = marker.getElement()
  if (!markerElement) return

  const deleteButton = markerElement.querySelector('.measurement-delete-button') as HTMLElement
  if (!deleteButton) return

  // Remove any existing listeners by cloning
  const newDeleteButton = deleteButton.cloneNode(true) as HTMLElement
  deleteButton.parentNode?.replaceChild(newDeleteButton, deleteButton)

  newDeleteButton.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    removeCompletedMeasurementPoint(completedIndex, markerIndex)
  })
}

/**
 * Attaches interactive handlers to a single completed measurement marker
 * @param {L.Marker} marker - The Leaflet marker to make interactive
 * @param {CompletedMeasurement} completed - The completed measurement this marker belongs to
 * @param {number} completedIndex - Index of the completed measurement in the array
 * @param {number} markerIndex - Index of this marker within the completed measurement
 */
const attachCompletedMarkerHandlers = (
  marker: L.Marker,
  completed: CompletedMeasurement,
  completedIndex: number,
  markerIndex: number
): void => {
  marker.dragging?.enable()
  marker.options.interactive = true

  marker.off('dragstart')
  marker.off('drag')
  marker.off('dragend')
  marker.off('click')
  marker.off('mouseover')
  marker.off('mouseout')

  marker.on('dragstart', () => {
    isDraggingVertex.value = true
  })

  marker.on('drag', () => {
    const newLatlng = marker.getLatLng()
    completed.points[markerIndex] = newLatlng.clone()
    marker.setLatLng(completed.points[markerIndex])
    updateCompletedMeasurementDisplay(completed)
  })

  marker.on('dragend', () => {
    isDraggingVertex.value = false
    const newLatlng = marker.getLatLng()
    completed.points[markerIndex] = newLatlng.clone()
    marker.setLatLng(completed.points[markerIndex])
    updateCompletedMeasurementDisplay(completed)
  })

  attachDeleteButtonHandler(marker, completedIndex, markerIndex)

  const setPopupDisplay = (visible: boolean): void => {
    const popup = marker.getElement()?.querySelector('.measurement-delete-popup') as HTMLDivElement
    if (popup) popup.style.display = visible ? 'block' : 'none'
  }

  marker.on('mouseover', () => {
    const isVisible =
      completedMeasurementDeletePopupVisible.value?.completedIndex === completedIndex &&
      completedMeasurementDeletePopupVisible.value?.markerIndex === markerIndex
    setPopupDisplay(isVisible)
  })

  marker.on('click', (event: L.LeafletMouseEvent) => {
    if (!props.isActive) return

    L.DomEvent.stopPropagation(event.originalEvent)
    const deleteButton = (event.originalEvent?.target as HTMLElement)?.closest('.measurement-delete-button')

    if (deleteButton) {
      removeCompletedMeasurementPoint(completedIndex, markerIndex)
      L.DomEvent.preventDefault(event.originalEvent)
      return
    }

    // Resume drawing from a loose-end vertex when no active measurement exists
    const isLooseEnd = markerIndex === 0 || markerIndex === completed.points.length - 1
    if (isLooseEnd && measurementPoints.value.length === 0) {
      resumeFromCompletedMeasurement(completedIndex, markerIndex)
      return
    }

    const currentPopup = completedMeasurementDeletePopupVisible.value
    if (currentPopup?.completedIndex === completedIndex && currentPopup?.markerIndex === markerIndex) {
      completedMeasurementDeletePopupVisible.value = null
    } else {
      completedMeasurementDeletePopupVisible.value = { completedIndex, markerIndex }
    }

    setPopupDisplay(completedMeasurementDeletePopupVisible.value !== null)

    completedMeasurements.value.forEach((otherCompleted, otherCompletedIndex) => {
      otherCompleted.markers.forEach((otherMarker, otherMarkerIndex) => {
        if (otherCompletedIndex !== completedIndex || otherMarkerIndex !== markerIndex) {
          const otherPopup = otherMarker.getElement()?.querySelector('.measurement-delete-popup') as HTMLDivElement
          if (otherPopup) otherPopup.style.display = 'none'
        }
      })
    })
  })
}

// Make all completed measurements editable
const makeCompletedMeasurementsEditable = (): void => {
  completedMeasurements.value.forEach((completed, completedIndex) => {
    completed.markers.forEach((marker, markerIndex) => {
      attachCompletedMarkerHandlers(marker, completed, completedIndex, markerIndex)
    })
  })
}

watch(
  () => props.isActive,
  (isActive) => {
    const mapInstance = map.value
    if (isActive) {
      if (measurementPoints.value.length > 0) {
        finalizeCurrentMeasurement()
      }
      makeCompletedMeasurementsEditable()
      if (mapInstance) {
        ensureMeasurementPane(mapInstance)
        setNonMeasurementInteractivity(mapInstance, false)
        mapInstance.on('zoom', syncMarkerPositionsImmediate)
        mapInstance.on('zoomstart', syncMarkerPositionsImmediate)
        mapInstance.on('move', syncMarkerPositionsImmediate)
      }
    } else {
      finalizeCurrentMeasurement()
      completedMeasurements.value.forEach((completed) => {
        completed.markers.forEach((marker) => {
          marker.dragging?.disable()
          marker.options.interactive = false
        })
      })
      if (measurementLiveLine.value && mapInstance) {
        mapInstance.removeLayer(measurementLiveLine.value)
      }
      if (measurementLiveLineHeading.value && mapInstance) {
        mapInstance.removeLayer(measurementLiveLineHeading.value)
      }
      if (mapInstance) {
        setNonMeasurementInteractivity(mapInstance, true)
        mapInstance.off('zoom', syncMarkerPositionsImmediate)
        mapInstance.off('zoomstart', syncMarkerPositionsImmediate)
        mapInstance.off('move', syncMarkerPositionsImmediate)
      }
      menuVisible.value = false
      hideAllDeletePopups()
    }
  }
)

// Sync marker positions immediately (called during zoom operations)
const syncMarkerPositionsImmediate = (): void => {
  const mapInstance = map.value
  if (!mapInstance || !props.isActive) return

  // Sync active measurement markers
  for (let i = 0; i < measurementMarkers.value.length && i < measurementPoints.value.length; i++) {
    const marker = measurementMarkers.value[i]
    const point = measurementPoints.value[i]
    if (marker && point) {
      const currentPos = marker.getLatLng()
      // Check if update is needed (avoid unnecessary updates)
      if (Math.abs(currentPos.lat - point.lat) > 1e-9 || Math.abs(currentPos.lng - point.lng) > 1e-9) {
        // Use the exact point object from array (maintain reference consistency)
        marker.setLatLng(point)
        // Force Leaflet to update the marker's position immediately
        // This ensures the marker stays aligned during zoom
        if (typeof (marker as any).update === 'function') {
          ;(marker as any).update()
        }
      }
    }
  }

  // Sync completed measurement markers
  completedMeasurements.value.forEach((completed) => {
    for (let i = 0; i < completed.markers.length && i < completed.points.length; i++) {
      const marker = completed.markers[i]
      const point = completed.points[i]
      if (marker && point) {
        const currentPos = marker.getLatLng()
        // Check if update is needed (avoid unnecessary updates)
        if (Math.abs(currentPos.lat - point.lat) > 1e-9 || Math.abs(currentPos.lng - point.lng) > 1e-9) {
          // Use the exact point object from array (maintain reference consistency)
          marker.setLatLng(point)
          // Force Leaflet to update the marker's position immediately
          if (typeof (marker as any).update === 'function') {
            ;(marker as any).update()
          }
        }
      }
    }
  })
}

// Watch for zoom changes to update display (which now syncs markers)
watch(
  () => props.zoom,
  () => {
    if (props.isActive) {
      // Use nextTick to ensure map has finished zooming
      nextTick(() => {
        updateMeasurementDisplay()
        // Also sync completed measurements
        completedMeasurements.value.forEach((completed) => {
          updateCompletedMeasurementDisplay(completed)
        })
      })
    }
  }
)

// Watch for map instance to attach zoom event listeners
watch(
  () => map.value,
  (mapInstance, oldMapInstance) => {
    // Remove listeners from old map instance
    if (oldMapInstance) {
      oldMapInstance.off('zoom', syncMarkerPositionsImmediate)
      oldMapInstance.off('zoomstart', syncMarkerPositionsImmediate)
      oldMapInstance.off('move', syncMarkerPositionsImmediate)
    }
    // Attach listeners to new map instance if active
    if (mapInstance && props.isActive) {
      // 'zoom' fires continuously during zoom, 'zoomstart' fires at the beginning
      mapInstance.on('zoom', syncMarkerPositionsImmediate)
      mapInstance.on('zoomstart', syncMarkerPositionsImmediate)
      mapInstance.on('move', syncMarkerPositionsImmediate)
    }
  },
  { immediate: true }
)

// Watch for unit system changes
watch(
  () => missionStore.userUnitSystem,
  () => {
    if (props.isActive) {
      updateMeasurementDisplay()
    }
  }
)

const distanceTagColorCss = computed(() => rgbaToCss(distanceTagColor.value))
const angleTagColorCss = computed(() => rgbaToCss(angleTagColor.value))
const lineColorCss = computed(() => rgbaToCss(lineColor.value))

// Proportional padding and border radius for tags
// Base font-size: 12px, base padding: 4px 8px, base border-radius: 12px
const BASE_TAG_SIZE = 10
const tagScale = computed(() => tagSize.value / BASE_TAG_SIZE)

const tagPadding = computed(() => {
  const vertical = Math.round(2 * tagScale.value)
  const horizontal = Math.round(4 * tagScale.value)
  return `${vertical}px ${horizontal}px`
})

const tagBorderRadius = computed(() => {
  return `${Math.round(8 * tagScale.value)}px`
})

// Watch for option changes
watch(
  () => missionStore.measurementOptions,
  () => {
    if (props.isActive) {
      updateMeasurementDisplay()
      completedMeasurements.value.forEach((completed) => {
        updateCompletedMeasurementDisplay(completed)
      })
    }
  },
  { deep: true }
)

const updateMeasurementLiveLine = (cursorLatlng: L.LatLng): void => {
  const mapInstance = map.value
  if (!mapInstance || measurementPoints.value.length === 0) return

  // Hide live line if dragging a vertex
  if (isDraggingVertex.value) {
    if (measurementLiveLine.value && mapInstance.hasLayer(measurementLiveLine.value)) {
      mapInstance.removeLayer(measurementLiveLine.value)
    }
    if (measurementLiveLineHeading.value && mapInstance.hasLayer(measurementLiveLineHeading.value)) {
      mapInstance.removeLayer(measurementLiveLineHeading.value)
    }
    return
  }

  // Check if cursor is hovering over any existing marker (active or completed)
  const cursorPoint = mapInstance.latLngToContainerPoint(cursorLatlng)
  const thresholdInPixels = 10
  let isOverMarker = false

  // Check active measurement markers
  for (let i = 0; i < measurementMarkers.value.length; i++) {
    const marker = measurementMarkers.value[i]
    const markerPoint = mapInstance.latLngToContainerPoint(marker.getLatLng())
    const distance = cursorPoint.distanceTo(markerPoint)
    if (distance < thresholdInPixels) {
      isOverMarker = true
      break
    }
  }

  // Check completed measurement markers
  if (!isOverMarker) {
    for (const completed of completedMeasurements.value) {
      for (const marker of completed.markers) {
        const markerPoint = mapInstance.latLngToContainerPoint(marker.getLatLng())
        const distance = cursorPoint.distanceTo(markerPoint)
        if (distance < thresholdInPixels) {
          isOverMarker = true
          break
        }
      }
      if (isOverMarker) break
    }
  }

  // Hide live line and heading if cursor is over a marker
  if (isOverMarker) {
    if (measurementLiveLine.value && mapInstance.hasLayer(measurementLiveLine.value)) {
      mapInstance.removeLayer(measurementLiveLine.value)
    }
    if (measurementLiveLineHeading.value && mapInstance.hasLayer(measurementLiveLineHeading.value)) {
      mapInstance.removeLayer(measurementLiveLineHeading.value)
    }
    return
  }

  const lastPoint = measurementPoints.value[measurementPoints.value.length - 1]

  // Snap position if Alt is pressed
  const targetLatlng = isAltPressed.value ? calculateSnappedPosition(lastPoint, cursorLatlng) : cursorLatlng

  const liveLineOpacity = lineColor.value.a * 0.4 * measurementOpacity.value
  if (!measurementLiveLine.value) {
    measurementLiveLine.value = L.polyline([lastPoint, targetLatlng], {
      color: lineColorCss.value,
      weight: 1.5,
      opacity: liveLineOpacity,
      interactive: false,
      pane: MEASUREMENT_PANE,
    }).addTo(mapInstance)
  } else {
    if (!mapInstance.hasLayer(measurementLiveLine.value)) {
      measurementLiveLine.value.addTo(mapInstance)
    }
    measurementLiveLine.value.setStyle({
      color: lineColorCss.value,
      opacity: liveLineOpacity,
    })
    measurementLiveLine.value.setLatLngs([lastPoint, targetLatlng])
  }

  // Calculate bearing and display heading with distance
  const bearing = bearingBetween([lastPoint.lat, lastPoint.lng], [targetLatlng.lat, targetLatlng.lng])
  const distanceMeters = calculateHaversineDistance(
    [lastPoint.lat, lastPoint.lng],
    [targetLatlng.lat, targetLatlng.lng]
  )

  // Calculate midpoint for heading label
  const midLat = (lastPoint.lat + targetLatlng.lat) / 2
  const midLng = (lastPoint.lng + targetLatlng.lng) / 2

  // Calculate line length in screen pixels to determine full name vs abbreviation
  const startContainerPoint = mapInstance.latLngToContainerPoint(lastPoint)
  const endContainerPoint = mapInstance.latLngToContainerPoint(targetLatlng)
  const dx = endContainerPoint.x - startContainerPoint.x
  const dy = endContainerPoint.y - startContainerPoint.y
  const lineLengthPixels = Math.sqrt(dx * dx + dy * dy)

  // Hide tag if line is too small
  if (lineLengthPixels < 100) {
    if (measurementLiveLineHeading.value && mapInstance.hasLayer(measurementLiveLineHeading.value)) {
      mapInstance.removeLayer(measurementLiveLineHeading.value)
    }
    return
  }

  // Use full names for lines larger than 250px in screen size, abbreviations for smaller lines
  const useFullName = lineLengthPixels > 250
  const headingText = bearingToCompassDirection(bearing, useFullName)
  const formattedDistance = formatDistance(distanceMeters, missionStore.measurementOptions.unitSystem)
  const bearingFormatted = `${Math.round(bearing)}º`
  const combinedText = `${formattedDistance} - ${bearingFormatted} - ${headingText}`

  // Rotate text to match line direction
  // Convert bearing to CSS rotation:
  // - Bearing 0° = North (up), CSS 0° = right (east)
  // - Bearing 90° = East (right), CSS 90° = down (south)
  // - So CSS rotation = bearing - 90
  // - Flip text 180° in quadrants III and IV (180°-360°) for readability
  let cssRotation = bearing - 90
  if (bearing >= 180 && bearing < 360) {
    cssRotation += 180
  }

  // Create or update heading marker
  const headingStyle =
    `font-size: 10px; color: ${lineColorCss.value}; font-weight: bold; ` +
    `text-shadow: 1px 1px 2px rgba(0,0,0,0.8); white-space: nowrap; pointer-events: none; ` +
    `transform: translate(-50%, -50%) rotate(${cssRotation}deg); transform-origin: center center; ` +
    `background: rgba(0, 0, 0, 0.8); padding: 2px 6px; border-radius: 6px; ` +
    `border: 1px solid rgba(255, 255, 255, 0.3); display: inline-block;`
  const headingHtml = `<div style="${headingStyle}">${combinedText}</div>`

  if (!measurementLiveLineHeading.value) {
    measurementLiveLineHeading.value = L.marker([midLat, midLng], {
      icon: L.divIcon({
        className: 'measurement-live-heading',
        html: headingHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      interactive: false,
      opacity: measurementOpacity.value,
      pane: MEASUREMENT_PANE,
    }).addTo(mapInstance)
  } else {
    if (!mapInstance.hasLayer(measurementLiveLineHeading.value)) {
      measurementLiveLineHeading.value.addTo(mapInstance)
    }
    measurementLiveLineHeading.value.setLatLng([midLat, midLng])
    measurementLiveLineHeading.value.setOpacity(measurementOpacity.value)
    const icon = measurementLiveLineHeading.value.getIcon() as L.DivIcon
    if (icon) {
      icon.options.html = headingHtml
      measurementLiveLineHeading.value.setIcon(icon)
    }
  }
}

const MEASUREMENT_MARKER_HTML = `
  <div class="measurement-point-container">
    <div class="measurement-point"></div>
    <div class="measurement-delete-popup" style="display: none;">
      <button class="measurement-delete-button">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 4h12M4 4v10a2 2 0 002 2h4a2 2 0 002-2V4M6 4V2h4v2"
                stroke="white" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
`

const addMeasurementPoint = (latlng: L.LatLng): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  ensureMeasurementPane(mapInstance)

  const pointIndex = measurementPoints.value.length
  const point = latlng.clone()
  measurementPoints.value.push(point)

  const marker = L.marker(point, {
    draggable: true,
    opacity: measurementOpacity.value,
    pane: MEASUREMENT_PANE,
    icon: L.divIcon({
      className: 'measurement-point-marker',
      html: MEASUREMENT_MARKER_HTML,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    }),
  }).addTo(mapInstance)

  measurementMarkers.value.push(marker)
  attachActiveMarkerHandlers(marker, pointIndex)
  updateMeasurementDisplay()
}

const removeMeasurementPoint = (index: number): void => {
  const mapInstance = map.value
  if (!mapInstance || index < 0 || index >= measurementPoints.value.length) return

  if (measurementPoints.value.length === 2) {
    clearMeasurement()
    return
  }

  const marker = measurementMarkers.value[index]
  if (marker) {
    mapInstance.removeLayer(marker)
    measurementMarkers.value.splice(index, 1)
  }

  measurementPoints.value.splice(index, 1)

  measurementMarkers.value.forEach((m, idx) => {
    attachActiveMarkerHandlers(m, idx)
  })

  updateMeasurementDisplay()
}

const updateMeasurementDisplay = (): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  const points = measurementPoints.value
  if (points.length === 0) {
    return
  }

  // Sync marker positions with points array (critical for zoom operations)
  // Use existing LatLng objects to maintain reference consistency with Leaflet
  for (let i = 0; i < measurementMarkers.value.length && i < points.length; i++) {
    const marker = measurementMarkers.value[i]
    const point = points[i]
    if (marker && point) {
      // Use the exact point object from array to maintain reference consistency
      // This prevents detachment by keeping Leaflet's internal state in sync
      marker.setLatLng(point)
    }
  }

  // Update marker opacity
  measurementMarkers.value.forEach((m) => m.setOpacity(measurementOpacity.value))

  if (points.length >= 2) {
    if (!measurementPolyline.value) {
      measurementPolyline.value = L.polyline([], {
        color: lineColorCss.value,
        weight: 2,
        dashArray: '2, 4',
        opacity: lineColor.value.a * measurementOpacity.value,
        pane: MEASUREMENT_PANE,
      }).addTo(mapInstance)
    }
    measurementPolyline.value.setStyle({
      color: lineColorCss.value,
      opacity: lineColor.value.a * measurementOpacity.value,
    })
    measurementPolyline.value.setLatLngs(points)

    updateMeasurementDistanceTags()
    updateMeasurementAngles()
  }
}

/**
 * Builds the inline CSS style string for tag pills
 * @param {string} bgColor - CSS color string for the background
 * @returns {string} Inline style string
 */
const buildTagStyle = (bgColor: string): string =>
  `font-size: ${tagSize.value}px; background-color: ${bgColor}; color: #fff; ` +
  `padding: ${tagPadding.value}; border-radius: ${tagBorderRadius.value};`

/**
 * Creates distance tag markers for a set of points, adds them to the map, and returns them
 * @param {L.Map} mapInstance - The Leaflet map instance
 * @param {L.LatLng[]} points - The measurement points (need at least 2)
 * @returns {L.Marker[]} Array of distance tag markers added to the map
 */
const createDistanceTagElements = (mapInstance: L.Map, points: L.LatLng[]): L.Marker[] => {
  if (!showDistanceTags.value || points.length < 2) return []

  const tags: L.Marker[] = []
  const style = buildTagStyle(distanceTagColorCss.value)

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    const distance = calculateHaversineDistance([start.lat, start.lng], [end.lat, end.lng])
    const formatted = localUnitConversion.value.convertDistance(distance)
    const bearing = bearingBetween([start.lat, start.lng], [end.lat, end.lng])
    const tagText = `${formatted} - ${Math.round(bearing)}º`

    const tag = L.marker([(start.lat + end.lat) / 2, (start.lng + end.lng) / 2], {
      icon: L.divIcon({
        className: 'measurement-distance-tag',
        html: `<div class="measurement-distance-pill" style="${style}">${tagText}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      opacity: measurementOpacity.value,
      pane: MEASUREMENT_PANE,
    }).addTo(mapInstance)
    tags.push(tag)
  }

  return tags
}

/**
 * Creates angle tag markers and arc polylines for a set of points, adds them to the map, and returns them
 * @param {L.Map} mapInstance - The Leaflet map instance
 * @param {L.LatLng[]} points - The measurement points (need at least 3)
 * @returns {{ tags: L.Marker[], arcs: L.Polyline[] }} Angle tag markers and arc polylines
 */
const createAngleElements = (
  mapInstance: L.Map,
  points: L.LatLng[]
): {
  /**
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc *
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
   */
  tags: L.Marker[]
  /**
tttttttttttttttttt *
tttttttttttttttttt
   */
  arcs: L.Polyline[]
} => {
  const tags: L.Marker[] = []
  const arcs: L.Polyline[] = []
  if (points.length < 3) return { tags, arcs }

  const style = buildTagStyle(angleTagColorCss.value)

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    const incomingBearing = bearingBetween([prev.lat, prev.lng], [curr.lat, curr.lng])
    const outgoingBearing = bearingBetween([curr.lat, curr.lng], [next.lat, next.lng])
    const reverseIncomingBearing = (incomingBearing + 180) % 360
    const angle = deltaBearing(reverseIncomingBearing, outgoingBearing)

    const { arcCenterPoint, arc } = createAngleArc(mapInstance, prev, curr, next, angle)
    arc.addTo(mapInstance)
    arcs.push(arc)

    if (arcCenterPoint && showAngleTags.value) {
      const tag = L.marker([arcCenterPoint.lat, arcCenterPoint.lng], {
        icon: L.divIcon({
          className: 'measurement-angle-tag',
          html: `<div class="measurement-angle-pill" style="${style}">${angle.toFixed(1)}°</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        opacity: measurementOpacity.value,
        pane: MEASUREMENT_PANE,
      }).addTo(mapInstance)
      tags.push(tag)
    }
  }

  return { tags, arcs }
}

const updateMeasurementDistanceTags = (): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  measurementDistanceTags.value.forEach((tag) => tag.remove())
  measurementDistanceTags.value = createDistanceTagElements(mapInstance, measurementPoints.value)
}

const updateMeasurementAngles = (): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  measurementAngleTags.value.forEach((tag) => tag.remove())
  measurementAngleTags.value = []
  measurementAngleArcs.value.forEach((arc) => arc.remove())
  measurementAngleArcs.value = []

  const { tags, arcs } = createAngleElements(mapInstance, measurementPoints.value)
  measurementAngleTags.value = tags
  measurementAngleArcs.value = arcs
}

/**
 * Creates an angle arc polyline between three points and returns it along with the label anchor point.
 * Does NOT add anything to the map or modify component state - callers are responsible for that.
 * @param {L.Map} mapInstance - The Leaflet map instance (needed for zoom level)
 * @param {L.LatLng} prev - Previous vertex
 * @param {L.LatLng} curr - Current vertex (where the angle is)
 * @param {L.LatLng} next - Next vertex
 * @param {number} angle - The angle in degrees
 * @returns {{ arcCenterPoint: L.LatLng | null, arc: L.Polyline }} The arc polyline and its midpoint for label positioning
 */
const createAngleArc = (
  mapInstance: L.Map,
  prev: L.LatLng,
  curr: L.LatLng,
  next: L.LatLng,
  angle: number
): {
  /** Midpoint of the arc used to position the angle label */
  arcCenterPoint: L.LatLng | null
  /** The arc polyline (not yet added to map) */
  arc: L.Polyline
} => {
  const incomingBearing = bearingBetween([prev.lat, prev.lng], [curr.lat, curr.lng])
  const outgoingBearing = bearingBetween([curr.lat, curr.lng], [next.lat, next.lng])

  const mapZoom = mapInstance.getZoom()
  const radiusMeters = Math.max(15, Math.min(50, 1000 / mapZoom))

  const dist1 = calculateHaversineDistance([prev.lat, prev.lng], [curr.lat, curr.lng])
  const dist2 = calculateHaversineDistance([curr.lat, curr.lng], [next.lat, next.lng])
  const minDist = Math.min(dist1, dist2)
  const arcRadius = Math.min(radiusMeters, minDist * 0.3)

  const reverseIncomingBearing = (incomingBearing + 180) % 360
  const rawDiff = outgoingBearing - reverseIncomingBearing
  const normalizedDiff = ((rawDiff + 540) % 360) - 180

  let startBearing: number
  let endBearing: number

  if (normalizedDiff >= 0) {
    startBearing = reverseIncomingBearing
    endBearing = reverseIncomingBearing + angle
  } else {
    startBearing = reverseIncomingBearing - angle
    endBearing = reverseIncomingBearing
  }

  const arcPoints: L.LatLng[] = []
  const steps = Math.max(8, Math.floor(angle / 2))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    let bearing = startBearing + (endBearing - startBearing) * t
    bearing = ((bearing % 360) + 360) % 360

    const rad = (bearing * Math.PI) / 180
    const latOffset = (arcRadius / 111320) * Math.cos(rad)
    const lngOffset = (arcRadius / (111320 * Math.cos((curr.lat * Math.PI) / 180))) * Math.sin(rad)
    arcPoints.push(L.latLng(curr.lat + latOffset, curr.lng + lngOffset))
  }

  const arcOpacity = lineColor.value.a * 0.3 * measurementOpacity.value
  const arc = L.polyline(arcPoints, {
    color: lineColorCss.value,
    weight: 1,
    opacity: arcOpacity,
    pane: MEASUREMENT_PANE,
  })

  const centerIndex = Math.floor(arcPoints.length / 2)
  const arcCenterPoint = arcPoints[centerIndex] || null

  return { arcCenterPoint, arc }
}

const handleMenuAction = (action: 'options' | 'clear' | 'export' | 'import'): void => {
  menuVisible.value = false
  switch (action) {
    case 'options':
      optionsDialogVisible.value = true
      break
    case 'clear':
      clearMeasurement()
      break
    case 'export':
      exportMeasurements()
      break
    case 'import':
      importMeasurements()
      break
  }
}

/**
 * Exported measurement data for JSON serialization
 */
interface ExportedMeasurement {
  /** Coordinates of each vertex */
  points: Array<{
    /**
     *
     */
    lat: number
    /**
     *
     */
    lng: number
  }>
  /** Total path distance in meters */
  totalDistance: number
  /** Polygon area in square meters (0 if fewer than 3 points) */
  area: number
  /** Individual segment distances in meters */
  segments: number[]
}

const exportMeasurements = (): void => {
  const measurements: ExportedMeasurement[] = []

  if (measurementPoints.value.length >= 2) {
    const points = measurementPoints.value
    let dist = 0
    const segs: number[] = []
    for (let i = 0; i < points.length - 1; i++) {
      const d = calculateHaversineDistance([points[i].lat, points[i].lng], [points[i + 1].lat, points[i + 1].lng])
      dist += d
      segs.push(d)
    }
    measurements.push({
      points: points.map((p) => ({ lat: p.lat, lng: p.lng })),
      totalDistance: dist,
      area: points.length >= 3 ? polygonAreaSquareMeters(points.map((p) => [p.lat, p.lng] as WaypointCoordinates)) : 0,
      segments: segs,
    })
  }

  completedMeasurements.value.forEach((completed) => {
    const points = completed.points
    if (points.length < 2) return
    let dist = 0
    const segs: number[] = []
    for (let i = 0; i < points.length - 1; i++) {
      const d = calculateHaversineDistance([points[i].lat, points[i].lng], [points[i + 1].lat, points[i + 1].lng])
      dist += d
      segs.push(d)
    }
    measurements.push({
      points: points.map((p) => ({ lat: p.lat, lng: p.lng })),
      totalDistance: dist,
      area: points.length >= 3 ? polygonAreaSquareMeters(points.map((p) => [p.lat, p.lng] as WaypointCoordinates)) : 0,
      segments: segs,
    })
  })

  if (measurements.length === 0) return

  const data = {
    measurements,
    timestamp: new Date().toISOString(),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `measurements-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const importMeasurements = (): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  ensureMeasurementPane(mapInstance)

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as {
          /**
           *
           */
          measurements?: ExportedMeasurement[]
        }
        const imported = data.measurements
        if (!Array.isArray(imported) || imported.length === 0) return

        for (const measurement of imported) {
          if (!Array.isArray(measurement.points) || measurement.points.length < 2) continue

          const points = measurement.points.map((p) => L.latLng(p.lat, p.lng))

          const polyline = L.polyline(points, {
            color: lineColorCss.value,
            weight: 2,
            dashArray: '2, 4',
            opacity: lineColor.value.a * measurementOpacity.value,
            pane: MEASUREMENT_PANE,
          }).addTo(mapInstance)

          const markers = points.map((point) => {
            return L.marker(point, {
              draggable: false,
              opacity: measurementOpacity.value,
              pane: MEASUREMENT_PANE,
              icon: L.divIcon({
                className: 'measurement-point-marker',
                html: MEASUREMENT_MARKER_HTML,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              }),
            }).addTo(mapInstance)
          })

          completedMeasurements.value.push({
            points,
            polyline,
            markers,
            distanceTags: [],
            angleTags: [],
            angleArcs: [],
          })
        }

        completedMeasurements.value.forEach((completed) => {
          updateCompletedMeasurementDisplay(completed)
        })

        if (props.isActive) {
          makeCompletedMeasurementsEditable()
        }
      } catch {
        console.error('Failed to parse measurement file')
      }
    }
    reader.readAsText(file)
  })
  input.click()
}

const clearMeasurement = (): void => {
  const mapInstance = map.value
  if (!mapInstance) return

  // Clear current measurement
  measurementPoints.value = []
  if (measurementPolyline.value) {
    mapInstance.removeLayer(measurementPolyline.value)
    measurementPolyline.value = null
  }
  measurementMarkers.value.forEach((marker) => marker.remove())
  measurementMarkers.value = []
  measurementDistanceTags.value.forEach((tag) => tag.remove())
  measurementDistanceTags.value = []
  measurementAngleTags.value.forEach((tag) => tag.remove())
  measurementAngleTags.value = []
  measurementAngleArcs.value.forEach((arc) => arc.remove())
  measurementAngleArcs.value = []
  if (measurementLiveLine.value) {
    mapInstance.removeLayer(measurementLiveLine.value)
    measurementLiveLine.value = null
  }
  if (measurementLiveLineHeading.value) {
    mapInstance.removeLayer(measurementLiveLineHeading.value)
    measurementLiveLineHeading.value = null
  }
  measurementDeletePopupVisible.value = null

  // Clear all completed measurements
  completedMeasurements.value.forEach((completed) => {
    if (completed.polyline) mapInstance.removeLayer(completed.polyline)
    completed.markers.forEach((marker) => marker.remove())
    completed.distanceTags.forEach((tag) => tag.remove())
    completed.angleTags.forEach((tag) => tag.remove())
    completed.angleArcs.forEach((arc) => arc.remove())
  })
  completedMeasurements.value = []
}

// Handle Alt key state for angle snapping
const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.altKey) {
    isAltPressed.value = true
  }
}

const handleKeyUp = (e: KeyboardEvent): void => {
  if (e.key === 'Alt') {
    isAltPressed.value = false
  }
}

const handleWindowBlur = (): void => {
  isAltPressed.value = false
}

// Setup key listeners
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', handleWindowBlur)
})

// Cleanup on unmount
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenuOnOutsideClick)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('blur', handleWindowBlur)
  if (mouseMoveRafId !== null) cancelAnimationFrame(mouseMoveRafId)
  const mapInstance = map.value
  if (mapInstance) {
    mapInstance.off('zoom', syncMarkerPositionsImmediate)
    mapInstance.off('zoomstart', syncMarkerPositionsImmediate)
    mapInstance.off('move', syncMarkerPositionsImmediate)
  }
  clearMeasurement()
})

/**
 * Handles click on an active measurement marker (toggle delete popup or delete)
 * @param {L.LeafletMouseEvent} e - The original Leaflet event
 * @param {number} markerIndex - Index of the clicked marker
 * @returns {boolean} Whether the click was handled
 */
const handleActiveMarkerClick = (e: L.LeafletMouseEvent, markerIndex: number): boolean => {
  const deleteButton = (e.originalEvent?.target as HTMLElement)?.closest('.measurement-delete-button')
  if (deleteButton) {
    removeMeasurementPoint(markerIndex)
    return true
  }

  hideAllDeletePopups()
  measurementDeletePopupVisible.value = measurementDeletePopupVisible.value === markerIndex ? null : markerIndex
  const popup = measurementMarkers.value[markerIndex]
    ?.getElement()
    ?.querySelector('.measurement-delete-popup') as HTMLDivElement
  if (popup) {
    popup.style.display = measurementDeletePopupVisible.value === markerIndex ? 'block' : 'none'
  }
  return true
}

/**
 * Handles click on a completed measurement marker (delete, resume, or toggle popup)
 * @param {L.LeafletMouseEvent} e - The original Leaflet event
 * @param {number} completedIndex - Index of the completed measurement
 * @param {number} markerIndex - Index of the clicked marker
 * @returns {boolean} Whether the click was handled
 */
const handleCompletedMarkerClick = (e: L.LeafletMouseEvent, completedIndex: number, markerIndex: number): boolean => {
  const completed = completedMeasurements.value[completedIndex]

  const deleteButton = (e.originalEvent?.target as HTMLElement)?.closest('.measurement-delete-button')
  if (deleteButton) {
    removeCompletedMeasurementPoint(completedIndex, markerIndex)
    return true
  }

  const isLooseEnd = markerIndex === 0 || markerIndex === completed.points.length - 1
  if (isLooseEnd && measurementPoints.value.length === 0) {
    resumeFromCompletedMeasurement(completedIndex, markerIndex)
    return true
  }

  hideAllDeletePopups()
  const currentPopup = completedMeasurementDeletePopupVisible.value
  if (currentPopup?.completedIndex === completedIndex && currentPopup?.markerIndex === markerIndex) {
    completedMeasurementDeletePopupVisible.value = null
  } else {
    completedMeasurementDeletePopupVisible.value = { completedIndex, markerIndex }
  }

  const popup = completed.markers[markerIndex]
    ?.getElement()
    ?.querySelector('.measurement-delete-popup') as HTMLDivElement
  if (popup) {
    popup.style.display = completedMeasurementDeletePopupVisible.value !== null ? 'block' : 'none'
  }
  return true
}

const handleMapClick = (e: L.LeafletMouseEvent): boolean => {
  const mapInstance = map.value
  if (!props.isActive || !mapInstance) return false

  const clickPoint = mapInstance.latLngToContainerPoint(e.latlng)

  // Check active measurement markers
  const activeIdx = findNearestMarkerIndex(mapInstance, clickPoint, measurementMarkers.value)
  if (activeIdx >= 0) return handleActiveMarkerClick(e, activeIdx)

  // Check completed measurement markers
  for (let ci = 0; ci < completedMeasurements.value.length; ci++) {
    const mi = findNearestMarkerIndex(mapInstance, clickPoint, completedMeasurements.value[ci].markers)
    if (mi >= 0) return handleCompletedMarkerClick(e, ci, mi)
  }

  hideAllDeletePopups()

  if (measurementLiveLine.value) {
    mapInstance.removeLayer(measurementLiveLine.value)
    measurementLiveLine.value = null
  }
  if (measurementLiveLineHeading.value) {
    mapInstance.removeLayer(measurementLiveLineHeading.value)
    measurementLiveLineHeading.value = null
  }

  const targetLatlng =
    isAltPressed.value && measurementPoints.value.length > 0
      ? calculateSnappedPosition(measurementPoints.value[measurementPoints.value.length - 1], e.latlng)
      : e.latlng
  addMeasurementPoint(targetLatlng)
  return true
}

let mouseMoveRafId: number | null = null

const handleMapMouseMove = (e: L.LeafletMouseEvent): boolean => {
  if (!props.isActive || measurementPoints.value.length === 0) return false

  if (mouseMoveRafId !== null) cancelAnimationFrame(mouseMoveRafId)
  mouseMoveRafId = requestAnimationFrame(() => {
    mouseMoveRafId = null
    updateMeasurementLiveLine(e.latlng)
  })
  return true
}

// Expose methods for parent component
defineExpose({
  addMeasurementPoint,
  removeMeasurementPoint,
  clearMeasurement,
  updateMeasurementLiveLine,
  handleMapClick,
  handleMapMouseMove,
})
</script>

<style scoped>
.measurement-report-container {
  position: absolute;
  bottom: 310px;
  right: 16px;
  padding: 6px 15px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 1);
  color: #fff;
  font-size: 14px;
  line-height: 1.6;
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(50px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  pointer-events: auto;
  min-width: 250px;
}

.measurement-report {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.measurement-report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.measurement-report-title {
  font-size: 14px;
  font-weight: 600;
}

.measurement-report-menu-container {
  position: relative;
}

.measurement-report-menu-button {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  margin-right: -5px;
  transition: background-color 0.2s;
}

.measurement-report-menu-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.measurement-report-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;

  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.measurement-report-menu-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.measurement-report-menu-item:hover:not(.disabled) {
  background-color: rgba(255, 255, 255, 0.1);
}

.measurement-report-menu-item.disabled {
  color: rgba(255, 255, 255, 0.4);
  cursor: not-allowed;
  opacity: 0.5;
}

.measurement-report-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.measurement-report-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.measurement-report-value {
  font-weight: 600;
  color: #fff;
  font-size: 13px;
  text-align: right;
}

.measurement-opacity-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding-top: 3px;
  margin-bottom: -3px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.opacity-icon {
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
  margin-left: 1px;
}

.measurement-opacity-slider {
  flex: 1;
  min-width: 0;
  scale: 0.75;
  opacity: 0.7;
  margin-right: -20px;
  margin-left: -5px;
}
</style>

<style>
/* Global styles for measurement elements (added to map container) */
.measurement-point-marker {
  background: none;
  border: none;
}

.measurement-point-container {
  position: relative;
}

.measurement-point-container:hover .measurement-delete-popup {
  cursor: pointer;
}

.measurement-point {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.6);
  border: 2px solid #ffffff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

.measurement-delete-popup {
  position: absolute;
  top: -25px;
  left: -25px;
  background-color: rgba(239, 68, 68, 0.8);
  border-radius: 50%;
  padding: 3px 4px 5px 5px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.measurement-delete-button {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
}

.measurement-distance-tag {
  background: none;
  border: none;
  pointer-events: none;
}

.measurement-distance-pill {
  transform: translate(-50%, -50%);
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(6px);
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.measurement-angle-tag {
  background: none;
  border: none;
  pointer-events: none;
}

.measurement-angle-pill {
  transform: translate(-50%, -50%);
  display: inline-block;
  background: rgba(83, 110, 114, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px);
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/*
 * When measurement mode is active, disable pointer events on ALL non-measurement
 * map panes and their children. The !important is needed to override Leaflet's
 * inline pointer-events on interactive SVG path elements (e.g. vehicle history line).
 */
.measurement-mode-active .leaflet-overlay-pane,
.measurement-mode-active .leaflet-overlay-pane *,
.measurement-mode-active .leaflet-marker-pane,
.measurement-mode-active .leaflet-marker-pane *,
.measurement-mode-active .leaflet-shadow-pane,
.measurement-mode-active .leaflet-shadow-pane *,
.measurement-mode-active .leaflet-tooltip-pane,
.measurement-mode-active .leaflet-tooltip-pane *,
.measurement-mode-active .leaflet-popup-pane,
.measurement-mode-active .leaflet-popup-pane * {
  pointer-events: none !important;
}
</style>
