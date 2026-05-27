import { useDebounceFn } from '@vueuse/core'
import L from 'leaflet'
import { type Ref, type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useMissionPathSignal } from '@/composables/baseStation/useMissionPathSignal'
import { buildMissionPathDisplaySegments, MISSION_COVERAGE_RISK_COLORS } from '@/libs/baseStation/missionPathSignal'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

/** A path to be redrawn in risk colors, keeping the styling that identifies it on the map. */
type ColoredPath = {
  /** Vertices of the path being colored. */
  coordinates: WaypointCoordinates[]
  /** Leaflet style the colored segments inherit, minus the color. */
  style: L.PolylineOptions
}

const flattenPolylineCoordinates = (polyline: L.Polyline): WaypointCoordinates[] => {
  const latlngs = polyline.getLatLngs()
  if (!latlngs.length) return []
  const flat = latlngs[0] instanceof L.LatLng ? (latlngs as L.LatLng[]) : (latlngs as L.LatLng[][]).flat()
  return flat.map((latlng) => [latlng.lat, latlng.lng] as WaypointCoordinates)
}

/**
 * Reactive Leaflet overlay that recolors the planned mission (or survey) path by the expected comms
 * quality at each segment, keeping the map/mission leaflet specifics out of the view.
 */
export interface MissionPathSignalOverlayApi {
  /**
   * Redraw (debounced) the colored path overlay from the current mission and base-station state.
   */
  renderMissionPathSignal: () => void
  /**
   * Remove the colored overlay layer and restore the base path styles.
   */
  removeMissionPathSignalLayer: () => void
}

/**
 * Drives the mission-path signal-coloring overlay for the planning map.
 * @param {ShallowRef<L.Map | undefined>} planningMap The planning Leaflet map instance.
 * @param {ShallowRef<L.Polyline | null>} surveyPathLayer The active survey path polyline, when in survey mode.
 * @param {ShallowRef<L.Polyline | null>} missionWaypointsPolyline The plain mission waypoints polyline.
 * @param {Ref<L.Polyline[]>} surveyExtraPathLayers The survey legs drawn apart from the main path
 * (crosshatch pass and turnarounds), colored alongside it so no flown leg is left uncolored.
 * @returns {MissionPathSignalOverlayApi} Render and teardown handlers for the overlay.
 */
export const useMissionPathSignalOverlay = (
  planningMap: ShallowRef<L.Map | undefined>,
  surveyPathLayer: ShallowRef<L.Polyline | null>,
  missionWaypointsPolyline: ShallowRef<L.Polyline | null>,
  surveyExtraPathLayers: Ref<L.Polyline[]>
): MissionPathSignalOverlayApi => {
  const missionStore = useMissionStore()
  const baseStationStore = useBaseStation()
  const { isPathSignalAvailable, mobileCoverageCircles } = useMissionPathSignal()

  const missionPathSignalLayer = shallowRef<L.LayerGroup | null>(null)

  const getMissionCoveragePathCoordinates = (): WaypointCoordinates[] => {
    if (surveyPathLayer.value) {
      return flattenPolylineCoordinates(surveyPathLayer.value)
    }
    return missionStore.currentPlanningWaypoints.map((waypoint) => waypoint.coordinates)
  }

  // Leaflet's live `options` are the only record of how the view styled each path, and hiding one
  // overwrites them, so the original is snapshotted the first time the layer is seen.
  const basePathStyles = new WeakMap<L.Polyline, L.PolylineOptions>()
  const basePathStyle = (layer: L.Polyline): L.PolylineOptions => {
    const known = basePathStyles.get(layer)
    if (known) return known
    const { color, weight, opacity, className } = layer.options
    const style: L.PolylineOptions = { color, weight, opacity, className }
    basePathStyles.set(layer, style)
    return style
  }

  const restoreMissionPathLineStyles = (): void => {
    if (missionWaypointsPolyline.value) {
      missionWaypointsPolyline.value.setStyle(basePathStyle(missionWaypointsPolyline.value))
    }
    if (surveyPathLayer.value) {
      surveyPathLayer.value.setStyle(basePathStyle(surveyPathLayer.value))
    }
    surveyExtraPathLayers.value.forEach((layer) => layer.setStyle(basePathStyle(layer)))
  }

  const removeMissionPathSignalLayer = (): void => {
    if (!missionPathSignalLayer.value) return
    missionPathSignalLayer.value.clearLayers()
    planningMap.value?.removeLayer(missionPathSignalLayer.value)
    missionPathSignalLayer.value = null
  }

  const renderMissionPathSignalImmediate = (): void => {
    if (!planningMap.value) return
    removeMissionPathSignalLayer()

    if (!missionStore.showMissionPathSignalStrength || !isPathSignalAvailable.value) {
      restoreMissionPathLineStyles()
      return
    }

    const pathCoordinates = getMissionCoveragePathCoordinates()
    if (pathCoordinates.length < 2) {
      restoreMissionPathLineStyles()
      return
    }

    // Both main lines are snapshotted before either is hidden, so the one that is not driving the
    // coloring this round still has its real style on record when it takes over later.
    const mainPathLayer = surveyPathLayer.value ?? missionWaypointsPolyline.value
    if (missionWaypointsPolyline.value) {
      basePathStyle(missionWaypointsPolyline.value)
      missionWaypointsPolyline.value.setStyle({ opacity: 0 })
    }
    if (surveyPathLayer.value) {
      basePathStyle(surveyPathLayer.value)
      surveyPathLayer.value.setStyle({ opacity: 0 })
    }

    const coloredPaths: ColoredPath[] = [
      { coordinates: pathCoordinates, style: mainPathLayer ? basePathStyle(mainPathLayer) : {} },
    ]
    // Each extra leg keeps its own weight and class so the crosshatch and the turnarounds stay
    // distinguishable from the main lines once the risk color replaces their identifying color.
    surveyExtraPathLayers.value.forEach((layer) => {
      const coordinates = flattenPolylineCoordinates(layer)
      const style = basePathStyle(layer)
      layer.setStyle({ opacity: 0 })
      if (coordinates.length >= 2) coloredPaths.push({ coordinates, style })
    })

    missionPathSignalLayer.value = L.layerGroup()
    for (const coloredPath of coloredPaths) {
      const displaySegments = buildMissionPathDisplaySegments(
        baseStationStore.config,
        coloredPath.coordinates,
        mobileCoverageCircles.value
      )
      for (const segment of displaySegments) {
        const polyline = L.polyline(segment.points, {
          ...coloredPath.style,
          color: MISSION_COVERAGE_RISK_COLORS[segment.risk],
          interactive: false,
        })
        polyline.addTo(missionPathSignalLayer.value)
      }
    }
    missionPathSignalLayer.value.addTo(planningMap.value)
  }

  // Coalesces redraws caused by survey edits, waypoint drags, and config changes within the
  // same animation frame; long enough to flatten typed-input bursts, short enough to feel live.
  const renderMissionPathSignal = useDebounceFn(renderMissionPathSignalImmediate, 100)

  // Every field feeding classifyCoverageAtPoint: the toggle, the availability/circles computeds, the
  // radio range inputs, and the position. Keep in sync when the classifier gains a new input.
  watch(
    () => [
      isPathSignalAvailable.value,
      mobileCoverageCircles.value,
      missionStore.showMissionPathSignalStrength,
      baseStationStore.config.enabled,
      baseStationStore.config.position,
      baseStationStore.config.commsType,
      baseStationStore.config.antenna.range,
      baseStationStore.config.antenna.bearing,
      baseStationStore.config.antenna.beamwidth,
      baseStationStore.config.baseStationAntennaHeightMeters,
      baseStationStore.config.vehicleHasBlueBoatAntennaMast,
      baseStationStore.config.mobileCoverage.provider,
      baseStationStore.config.mobileCoverage.openCellIdOperator,
      baseStationStore.config.mobileCoverage.osmOperator,
    ],
    () => {
      renderMissionPathSignal()
    }
  )

  onBeforeUnmount(removeMissionPathSignalLayer)

  return { renderMissionPathSignal, removeMissionPathSignalLayer }
}
