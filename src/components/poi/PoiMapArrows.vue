<template>
  <div>
    <template v-if="mapReady && showPoiArrows">
      <div v-for="arrow in poiEdgeArrows" :key="arrow.poiId" class="poi-edge-arrow" :style="arrow.style">
        <v-tooltip location="top" :text="arrow.tooltipText" content-class="poi-arrow-tooltip">
          <template #activator="{ props: tooltipProps }">
            <div v-bind="tooltipProps" class="poi-arrow-container" @click.stop="centerMapOnPoi(arrow.poiId)">
              <i
                class="mdi mdi-arrow-up-bold poi-arrow-icon"
                :style="{ transform: `rotate(${arrow.angle}deg)`, color: arrow.color }"
              ></i>
            </div>
          </template>
        </v-tooltip>
      </div>
    </template>
    <template v-if="mapReady && showVehicleArrow && vehicleEdgeArrow">
      <div class="poi-edge-arrow" :style="vehicleEdgeArrow.style">
        <v-tooltip location="top" :text="vehicleEdgeArrow.tooltipText" content-class="poi-arrow-tooltip">
          <template #activator="{ props: tooltipProps }">
            <div v-bind="tooltipProps" class="poi-arrow-container" @click.stop="handleVehicleArrowClick">
              <i
                class="mdi mdi-send-variant poi-arrow-icon"
                :style="{ transform: `rotate(${vehicleEdgeArrow.angle}deg)`, color: vehicleEdgeArrow.color }"
              ></i>
            </div>
          </template>
        </v-tooltip>
      </div>
    </template>
    <template v-if="mapReady && showHomeArrow && homeEdgeArrow">
      <div class="poi-edge-arrow" :style="homeEdgeArrow.style">
        <v-tooltip location="top" :text="homeEdgeArrow.tooltipText" content-class="poi-arrow-tooltip">
          <template #activator="{ props: tooltipProps }">
            <div v-bind="tooltipProps" class="poi-arrow-container" @click.stop="handleHomeArrowClick">
              <i
                class="mdi mdi-home poi-arrow-icon"
                :style="{ transform: `rotate(${homeEdgeArrow.angle + 90}deg)`, color: homeEdgeArrow.color }"
              ></i>
            </div>
          </template>
        </v-tooltip>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import L, { type LatLngTuple } from 'leaflet'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { useMapLayer } from '@/composables/map/useMapLayer'
import { calculateHaversineDistance } from '@/libs/mission/general-estimates'
import { TargetFollower, WhoToFollow } from '@/libs/utils-map'
import { useMissionStore } from '@/stores/mission'
import { useWidgetManagerStore } from '@/stores/widgetManager'
import type { Edge, EdgeIntersection, PoiEdgeArrow, TargetEdgeArrow, WaypointCoordinates } from '@/types/mission'
import type { Widget } from '@/types/widgets'

/**
 * Props for PoiMapArrows component
 */
interface Props {
  /**
   * Whether the map is ready
   */
  mapReady: boolean
  /**
   * Whether to show POI arrows
   */
  showPoiArrows: boolean
  /**
   * Whether to show home arrow
   */
  showHomeArrow: boolean
  /**
   * Whether to show vehicle arrow
   */
  showVehicleArrow: boolean
  /**
   * Vehicle position coordinates
   */
  vehiclePosition: WaypointCoordinates | undefined
  /**
   * Home position coordinates
   */
  home: WaypointCoordinates | undefined
  /**
   * Map center coordinates
   */
  mapCenter: WaypointCoordinates
  /**
   * Current zoom level
   */
  zoom: number
  /**
   * Parent widget instance
   */
  widget: Widget
  /**
   * Target follower instance
   */
  targetFollower: TargetFollower
}

const props = defineProps<Props>()

const missionStore = useMissionStore()
const widgetStore = useWidgetManagerStore()

// Get map instance from composable
const { mapLayer } = useMapLayer()
const map = computed(() => mapLayer.value ?? null)

const poiEdgeArrows = ref<PoiEdgeArrow[]>([])
const vehicleEdgeArrow = ref<TargetEdgeArrow | null>(null)
const homeEdgeArrow = ref<TargetEdgeArrow | null>(null)

const calculateMapEdgesIntersections = (
  centerPoint: L.Point,
  distanceX: number,
  distanceY: number,
  width: number,
  height: number,
  topEdgeY: number,
  validYMin: number
): EdgeIntersection[] => {
  const intersections: EdgeIntersection[] = []
  // Top edge
  if (distanceY < 0) {
    const t = (topEdgeY - centerPoint.y) / distanceY
    if (t > 0) {
      const x = centerPoint.x + distanceX * t
      if (x >= -1 && x <= width + 1) {
        intersections.push({ t, edge: 'top', x, y: topEdgeY })
      }
    }
  }
  // Bottom edge
  if (distanceY > 0) {
    const t = (height - centerPoint.y) / distanceY
    if (t > 0) {
      const x = centerPoint.x + distanceX * t
      if (x >= -1 && x <= width + 1) {
        intersections.push({ t, edge: 'bottom', x, y: height })
      }
    }
  }
  // Left edge
  if (distanceX < 0) {
    const t = -centerPoint.x / distanceX
    if (t > 0) {
      const y = centerPoint.y + distanceY * t
      if (y >= validYMin - 1 && y <= height + 1) {
        intersections.push({ t, edge: 'left', x: 0, y })
      }
    }
  }
  // Right edge
  if (distanceX > 0) {
    const t = (width - centerPoint.x) / distanceX
    if (t > 0) {
      const y = centerPoint.y + distanceY * t
      if (y >= validYMin - 1 && y <= height + 1) {
        intersections.push({ t, edge: 'right', x: width, y })
      }
    }
  }
  return intersections
}

// Handle POI Arrow corner cases for smooth edge transitions
const handleMapEdgeCorners = (
  intersections: EdgeIntersection[],
  edgeX: number,
  edgeY: number,
  width: number,
  height: number,
  cornerThreshold: number
): EdgeIntersection | null => {
  const isNearBottomRight = edgeX > width - cornerThreshold && edgeY > height - cornerThreshold - 30
  const isNearBottomLeft = edgeX < cornerThreshold && edgeY > height - cornerThreshold - 30

  if (isNearBottomRight) {
    const right = intersections.find((i) => i.edge === 'right')
    const bottom = intersections.find((i) => i.edge === 'bottom')
    if (right && bottom && right.t <= bottom.t * 1.15) return right
  } else if (isNearBottomLeft) {
    const left = intersections.find((i) => i.edge === 'left')
    const bottom = intersections.find((i) => i.edge === 'bottom')
    if (left && bottom && left.t <= bottom.t * 1.15) return left
  }
  return null
}

// Generate CSS style for POI Arrow based on edge
const getPoiArrowStyle = (
  edge: Edge,
  x: number,
  y: number,
  topEdgeY: number,
  isFullscreen: boolean,
  isVehicleOrHomeArrow = false
): PoiEdgeArrow['style'] => {
  const bottomOffset = isFullscreen ? '22px' : '-25px'
  const topOffset = isFullscreen ? topEdgeY + 4 : topEdgeY + 2
  const baseStyles: Record<Edge, PoiEdgeArrow['style']> = {
    top: { top: `${topOffset}px`, left: `${x}px`, transform: 'translate(-50%, -25%)' },
    bottom: { bottom: bottomOffset, left: `${x}px`, transform: 'translate(-50%, -50%)' },
    left: { left: '5px', top: `${y}px`, transform: 'translate(-25%, -50%)' },
    right: { right: '5px', top: `${y}px`, transform: 'translate(25%, -50%)' },
  }
  const style = baseStyles[edge]
  if (isVehicleOrHomeArrow) {
    return { ...style, margin: '2px' }
  }
  return style
}

// Calculate edge arrow for a generic target (vehicle, home waypoint, or a second vehicle).
const calculateTargetEdgeArrow = (
  targetPosition: WaypointCoordinates | undefined,
  targetName: string,
  targetColor: string
): TargetEdgeArrow | null => {
  if (!props.mapReady || !map.value || !(map.value instanceof L.Map) || !targetPosition) {
    return null
  }

  const container = map.value.getContainer()
  if (!container) {
    return null
  }

  let bounds: L.LatLngBounds
  let containerSize: L.Point
  let center: L.LatLng

  try {
    bounds = map.value.getBounds()
    containerSize = map.value.getSize()
    center = map.value.getCenter()
  } catch {
    return null
  }

  const targetLatLng = L.latLng(targetPosition[0], targetPosition[1])

  const width = containerSize.x
  const height = containerSize.y
  const isFullscreen = widgetStore.isFullScreen(props.widget)
  const topEdgeY = isFullscreen ? widgetStore.currentTopBarHeightPixels : 0
  const bottomEdgeY = isFullscreen ? height - widgetStore.currentBottomBarHeightPixels : height
  const validYMin = topEdgeY
  const validYMax = bottomEdgeY
  const cornerThreshold = 40

  let targetPoint: L.Point
  let centerPoint: L.Point

  try {
    targetPoint = map.value.latLngToContainerPoint(targetLatLng)
    centerPoint = map.value.latLngToContainerPoint(center)
  } catch {
    return null
  }

  // Check if target is visible on the map (within container bounds)
  if (
    targetPoint.x >= 0 &&
    targetPoint.x <= width &&
    targetPoint.y >= validYMin &&
    targetPoint.y <= validYMax &&
    bounds.contains(targetLatLng)
  ) {
    return null
  }

  const distanceMeters = calculateHaversineDistance([center.lat, center.lng], targetPosition)
  const distanceText =
    distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters.toFixed(0)} m`

  const distanceX = targetPoint.x - centerPoint.x
  const distanceY = targetPoint.y - centerPoint.y

  if (Math.abs(distanceX) < 0.001 && Math.abs(distanceY) < 0.001) return null

  const intersections = calculateMapEdgesIntersections(
    centerPoint,
    distanceX,
    distanceY,
    width,
    height,
    topEdgeY,
    validYMin
  )
  if (intersections.length === 0) return null

  const closest = intersections.reduce((min: EdgeIntersection, current: EdgeIntersection) =>
    current.t < min.t ? current : min
  )
  let selectedIntersection = closest

  // Handle corner cases
  const cornerIntersection = handleMapEdgeCorners(intersections, closest.x, closest.y, width, height, cornerThreshold)
  if (cornerIntersection) selectedIntersection = cornerIntersection

  // Clamp positions to contain the arrow within the map container
  let edgeX = Math.max(0, Math.min(width, selectedIntersection.x))
  let edgeY = selectedIntersection.y

  if (selectedIntersection.edge === 'bottom') {
    edgeY = Math.max(0, Math.min(height, edgeY))
  } else if (selectedIntersection.edge === 'left' || selectedIntersection.edge === 'right') {
    edgeY = Math.max(validYMin, Math.min(validYMax - 10, edgeY))
  } else {
    edgeY = Math.max(validYMin, Math.min(validYMax, edgeY))
  }

  const angle = ((Math.atan2(distanceY, distanceX) * 180) / Math.PI + 360) % 360

  return {
    style: getPoiArrowStyle(selectedIntersection.edge, edgeX, edgeY, topEdgeY, isFullscreen, true),
    angle,
    tooltipText: `${targetName} - ${distanceText}`,
    color: targetColor,
  }
}

// Calculate POI arrow angle and position to be placed on the edges of the map
const calculatePoiEdgeArrows = (): void => {
  if (!props.mapReady || !map.value || !(map.value instanceof L.Map)) {
    poiEdgeArrows.value = []
    return
  }

  const container = map.value.getContainer()
  if (!container) {
    poiEdgeArrows.value = []
    return
  }

  let bounds: L.LatLngBounds
  let containerSize: L.Point
  let center: L.LatLng

  try {
    bounds = map.value.getBounds()
    containerSize = map.value.getSize()
    center = map.value.getCenter()
  } catch {
    poiEdgeArrows.value = []
    return
  }

  const width = containerSize.x
  const height = containerSize.y
  const isFullscreen = widgetStore.isFullScreen(props.widget)
  const topEdgeY = isFullscreen ? widgetStore.currentTopBarHeightPixels : 0
  const bottomEdgeY = isFullscreen ? height - widgetStore.currentBottomBarHeightPixels : height
  const validYMin = topEdgeY
  const validYMax = bottomEdgeY
  const cornerThreshold = 40
  const arrows: PoiEdgeArrow[] = []

  missionStore.pointsOfInterest.forEach((poi) => {
    const poiLatLng = L.latLng(poi.coordinates[0], poi.coordinates[1])
    if (!map.value) return

    let poiPoint: L.Point
    let centerPoint: L.Point

    try {
      poiPoint = map.value.latLngToContainerPoint(poiLatLng)
      centerPoint = map.value.latLngToContainerPoint(center)
    } catch {
      return
    }

    // Check if POI is visible on the map (within container bounds)
    if (
      poiPoint.x >= 0 &&
      poiPoint.x <= width &&
      poiPoint.y >= validYMin &&
      poiPoint.y <= validYMax &&
      bounds.contains(poiLatLng)
    ) {
      return
    }

    const distanceMeters = calculateHaversineDistance([center.lat, center.lng], poi.coordinates)
    const distanceText =
      distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters.toFixed(0)} m`

    const distanceX = poiPoint.x - centerPoint.x
    const distanceY = poiPoint.y - centerPoint.y

    if (Math.abs(distanceX) < 0.001 && Math.abs(distanceY) < 0.001) return

    const intersections = calculateMapEdgesIntersections(
      centerPoint,
      distanceX,
      distanceY,
      width,
      height,
      topEdgeY,
      validYMin
    )
    if (intersections.length === 0) return

    const closest = intersections.reduce((min: EdgeIntersection, current: EdgeIntersection) =>
      current.t < min.t ? current : min
    )
    let selectedIntersection = closest

    // Handle corner cases
    const cornerIntersection = handleMapEdgeCorners(intersections, closest.x, closest.y, width, height, cornerThreshold)
    if (cornerIntersection) selectedIntersection = cornerIntersection

    // Clamp positions to contain the arrow within the map container
    let edgeX = Math.max(0, Math.min(width, selectedIntersection.x))
    let edgeY = selectedIntersection.y

    if (selectedIntersection.edge === 'bottom') {
      edgeY = Math.max(0, Math.min(height, edgeY))
    } else if (selectedIntersection.edge === 'left' || selectedIntersection.edge === 'right') {
      edgeY = Math.max(validYMin, Math.min(validYMax - 10, edgeY))
    } else {
      edgeY = Math.max(validYMin, Math.min(validYMax, edgeY))
    }

    const angle = ((Math.atan2(distanceY, distanceX) * 180) / Math.PI + 360) % 360

    arrows.push({
      poiId: poi.id,
      style: getPoiArrowStyle(selectedIntersection.edge, edgeX, edgeY, topEdgeY, isFullscreen),
      angle: angle + 90,
      tooltipText: `${poi.name} - ${distanceText}`,
      color: poi.color,
    })
  })

  poiEdgeArrows.value = arrows
}

const calculateVehicleAndHomeEdgeArrows = (): void => {
  vehicleEdgeArrow.value = calculateTargetEdgeArrow(props.vehiclePosition, 'Vehicle', '#1e498f')
  homeEdgeArrow.value = calculateTargetEdgeArrow(props.home, 'Home', '#1e498f')
}

// Prevent poi arrows calculation from overloading the UI
const debouncedUpdateArrows = useDebounceFn(calculatePoiEdgeArrows, 150)
const throttledUpdateArrows = useThrottleFn(calculatePoiEdgeArrows, 15) // Max 60fps
const debouncedUpdateVehicleAndHomeArrows = useDebounceFn(calculateVehicleAndHomeEdgeArrows, 150)
const throttledUpdateVehicleAndHomeArrows = useThrottleFn(calculateVehicleAndHomeEdgeArrows, 15)

const centerMapOnPoi = (poiId: string): void => {
  if (!map.value) return

  const poi = missionStore.pointsOfInterest.find((p) => p.id === poiId)
  if (!poi) return

  map.value.setView(poi.coordinates as LatLngTuple, map.value.getZoom(), { animate: true })
}

const handleVehicleArrowClick = (): void => {
  props.targetFollower.goToTarget(WhoToFollow.VEHICLE, true)
}

const handleHomeArrowClick = (): void => {
  props.targetFollower.goToTarget(WhoToFollow.HOME, true)
}

watch(
  map,
  (mapInstance) => {
    if (mapInstance && props.mapReady) {
      debouncedUpdateArrows()
      debouncedUpdateVehicleAndHomeArrows()
    }
  },
  { immediate: true }
)

// Watch for map changes and POI changes
watch(
  [() => props.mapCenter, () => props.zoom, () => missionStore.pointsOfInterest],
  () => {
    if (props.mapReady && map.value && map.value instanceof L.Map) {
      debouncedUpdateArrows()
      throttledUpdateVehicleAndHomeArrows()
    }
  },
  { immediate: true }
)

watch(
  () => props.mapReady,
  (ready) => {
    if (ready && map.value && map.value instanceof L.Map) {
      debouncedUpdateArrows()
      debouncedUpdateVehicleAndHomeArrows()
    }
  }
)

// Watch for vehicle and home position changes
watch(
  [() => props.vehiclePosition, () => props.home, () => props.mapCenter, () => props.zoom],
  () => {
    if (props.mapReady && map.value && map.value instanceof L.Map) {
      throttledUpdateVehicleAndHomeArrows()
    }
  },
  { immediate: true }
)

// Listen to map move events to update arrows during drag
let moveHandler: (() => void) | null = null

watch(
  [map, () => props.mapReady],
  ([mapInstance, ready]) => {
    if (moveHandler && map.value) {
      map.value.off('move', moveHandler)
      moveHandler = null
    }

    if (mapInstance && ready && mapInstance instanceof L.Map) {
      moveHandler = (): void => {
        throttledUpdateArrows()
        throttledUpdateVehicleAndHomeArrows()
      }
      mapInstance.on('move', moveHandler)
    }
  },
  { immediate: true }
)

// Cleanup on unmount
onBeforeUnmount(() => {
  if (moveHandler && map.value) {
    map.value.off('move', moveHandler)
  }
})
</script>

<style scoped>
.poi-edge-arrow {
  position: absolute;
  z-index: 1001;
  pointer-events: none;
}

.poi-arrow-container {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: transform 0.2s ease, background-color 0.2s ease;
  pointer-events: all;
  cursor: pointer;
}

.poi-arrow-container:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.3);
}

.poi-arrow-icon {
  font-size: 36px;
  font-weight: 900;
  -webkit-text-stroke: 1px white;
  transition: transform 0.2s ease;
  text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white, 0 -1px 0 white, 0 1px 0 white,
    -1px 0 0 white, 1px 0 0 white;
}

:deep(.poi-arrow-tooltip) {
  background-color: rgba(255, 255, 255) !important;
  color: black !important;
  border: none !important;
  border-radius: 4px !important;
  padding: 5px 8px !important;
}
</style>
