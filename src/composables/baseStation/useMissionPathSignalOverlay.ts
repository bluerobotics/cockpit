import { useDebounceFn } from '@vueuse/core'
import L from 'leaflet'
import { type ShallowRef, onBeforeUnmount, shallowRef, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useMissionPathSignal } from '@/composables/baseStation/useMissionPathSignal'
import { buildMissionPathDisplaySegments, MISSION_COVERAGE_RISK_COLORS } from '@/libs/baseStation/missionPathSignal'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

const waypointPolylineBaseStyle: L.PolylineOptions = { opacity: 1, color: '#3388ff', weight: 3 }
const surveyPathLayerBaseStyle: L.PolylineOptions = { color: '#2563EB', weight: 3, opacity: 0.8 }

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
 * @returns {MissionPathSignalOverlayApi} Render and teardown handlers for the overlay.
 */
export const useMissionPathSignalOverlay = (
  planningMap: ShallowRef<L.Map | undefined>,
  surveyPathLayer: ShallowRef<L.Polyline | null>,
  missionWaypointsPolyline: ShallowRef<L.Polyline | null>
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

  const restoreMissionPathLineStyles = (): void => {
    if (missionWaypointsPolyline.value) {
      missionWaypointsPolyline.value.setStyle(waypointPolylineBaseStyle)
    }
    if (surveyPathLayer.value) {
      surveyPathLayer.value.setStyle(surveyPathLayerBaseStyle)
    }
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

    const isSurveyPath = !!surveyPathLayer.value
    const displaySegments = buildMissionPathDisplaySegments(
      baseStationStore.config,
      pathCoordinates,
      mobileCoverageCircles.value
    )

    if (missionWaypointsPolyline.value) {
      missionWaypointsPolyline.value.setStyle({ opacity: 0 })
    }
    if (surveyPathLayer.value) {
      surveyPathLayer.value.setStyle({ opacity: 0 })
    }

    missionPathSignalLayer.value = L.layerGroup()
    for (const segment of displaySegments) {
      const polyline = L.polyline(segment.points, {
        color: MISSION_COVERAGE_RISK_COLORS[segment.risk],
        weight: 3,
        opacity: isSurveyPath ? 0.8 : 1,
        interactive: false,
        ...(isSurveyPath ? { className: 'survey-path' } : {}),
      })
      polyline.addTo(missionPathSignalLayer.value)
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
      baseStationStore.config.antenna,
      baseStationStore.config.baseStationAntennaHeightMeters,
      baseStationStore.config.vehicleHasBlueBoatAntennaMast,
      baseStationStore.config.mobileCoverage.provider,
      baseStationStore.config.mobileCoverage.openCellIdOperator,
      baseStationStore.config.mobileCoverage.osmOperator,
    ],
    () => {
      renderMissionPathSignal()
    },
    { deep: true }
  )

  onBeforeUnmount(removeMissionPathSignalLayer)

  return { renderMissionPathSignal, removeMissionPathSignalLayer }
}
