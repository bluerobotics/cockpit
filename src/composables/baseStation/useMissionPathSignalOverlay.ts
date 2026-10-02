import { useDebounceFn } from '@vueuse/core'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { type Ref, type ShallowRef, onBeforeUnmount, watch } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { useMissionPathSignal } from '@/composables/baseStation/useMissionPathSignal'
import { buildMissionPathDisplaySegments, MISSION_COVERAGE_RISK_COLORS } from '@/libs/baseStation/missionPathSignal'
import {
  type DrawnLine,
  type LineStyle,
  lineFeature,
  removeLayersAndSource,
  setLineLayer,
  slottedLayerId,
} from '@/libs/map/maplibre'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

/** Risk segments sharing one stroke, drawn as one line layer colored from each segment. */
type RiskStroke = {
  /** The stroke the segments share. */
  style: LineStyle
  /** The segments, each carrying its risk color. */
  features: GeoJSON.Feature[]
}

/** A path to be redrawn in risk colors, keeping the styling that identifies it on the map. */
type ColoredPath = {
  /** Vertices of the path being colored. */
  coordinates: WaypointCoordinates[]
  /** Style the colored segments inherit, minus the color. */
  style: LineStyle
}

/**
 * Reactive overlay that recolors the planned mission (or survey) path by the expected comms
 * quality at each segment, keeping the map/mission specifics out of the view.
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

const signalLayerPrefix = 'mission-path-signal'

/**
 * Drives the mission-path signal-coloring overlay for the planning map.
 * @param {ShallowRef<MapLibreMap | undefined>} planningMap The planning map instance.
 * @param {ShallowRef<DrawnLine | null>} surveyPathLayer The active survey path line, when in survey mode.
 * @param {ShallowRef<DrawnLine | null>} missionWaypointsPolyline The plain mission waypoints line.
 * @param {Ref<DrawnLine[]>} surveyExtraPathLayers The survey legs drawn apart from the main path
 * (crosshatch pass and turnarounds), colored alongside it so no flown leg is left uncolored.
 * @returns {MissionPathSignalOverlayApi} Render and teardown handlers for the overlay.
 */
export const useMissionPathSignalOverlay = (
  planningMap: ShallowRef<MapLibreMap | undefined>,
  surveyPathLayer: ShallowRef<DrawnLine | null>,
  missionWaypointsPolyline: ShallowRef<DrawnLine | null>,
  surveyExtraPathLayers: Ref<DrawnLine[]>
): MissionPathSignalOverlayApi => {
  const missionStore = useMissionStore()
  const baseStationStore = useBaseStation()
  const { isPathSignalAvailable, mobileCoverageCircles } = useMissionPathSignal()

  // The colored segments are drawn one layer per distinct stroke, since a dash pattern cannot vary within a layer.
  let signalLayerIds: string[] = []

  const getMissionCoveragePathCoordinates = (): WaypointCoordinates[] => {
    if (surveyPathLayer.value) {
      return surveyPathLayer.value.coordinates()
    }
    return missionStore.currentPlanningWaypoints.map((waypoint) => waypoint.coordinates)
  }

  // Hiding a line only zeroes its opacity, so the style it was drawn with is still on record to restore.
  const setLineHidden = (line: DrawnLine, hidden: boolean): void => {
    const map = planningMap.value
    if (!map?.getLayer(line.layerId)) return
    map.setPaintProperty(line.layerId, 'line-opacity', hidden ? 0 : line.style.opacity ?? 1)
  }

  const restoreMissionPathLineStyles = (): void => {
    if (missionWaypointsPolyline.value) setLineHidden(missionWaypointsPolyline.value, false)
    if (surveyPathLayer.value) setLineHidden(surveyPathLayer.value, false)
    surveyExtraPathLayers.value.forEach((layer) => setLineHidden(layer, false))
  }

  const removeMissionPathSignalLayer = (): void => {
    signalLayerIds.forEach((id) => removeLayersAndSource(planningMap.value, [id], id))
    signalLayerIds = []
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

    const mainPathLayer = surveyPathLayer.value ?? missionWaypointsPolyline.value
    if (missionWaypointsPolyline.value) setLineHidden(missionWaypointsPolyline.value, true)
    if (surveyPathLayer.value) setLineHidden(surveyPathLayer.value, true)

    const coloredPaths: ColoredPath[] = [
      { coordinates: pathCoordinates, style: mainPathLayer?.style ?? { color: '#000000' } },
    ]
    // Each extra leg keeps its own width and dashes so the crosshatch and the turnarounds stay
    // distinguishable from the main lines once the risk color replaces their identifying color.
    surveyExtraPathLayers.value.forEach((layer) => {
      const coordinates = layer.coordinates()
      setLineHidden(layer, true)
      if (coordinates.length >= 2) coloredPaths.push({ coordinates, style: layer.style })
    })

    const strokes = new Map<string, RiskStroke>()
    for (const coloredPath of coloredPaths) {
      const strokeKey = JSON.stringify({ ...coloredPath.style, color: undefined })
      const stroke = strokes.get(strokeKey) ?? { style: coloredPath.style, features: [] }
      strokes.set(strokeKey, stroke)
      const displaySegments = buildMissionPathDisplaySegments(
        baseStationStore.config,
        coloredPath.coordinates,
        mobileCoverageCircles.value
      )
      for (const segment of displaySegments) {
        stroke.features.push(lineFeature(segment.points, { color: MISSION_COVERAGE_RISK_COLORS[segment.risk] }))
      }
    }
    const map = planningMap.value
    ;[...strokes.values()].forEach((stroke, index) => {
      const id = slottedLayerId('survey', `${signalLayerPrefix}-${index}`)
      setLineLayer(map, id, 'survey', { type: 'FeatureCollection', features: stroke.features }, stroke.style)
      map.setPaintProperty(id, 'line-color', ['get', 'color'])
      signalLayerIds.push(id)
    })
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
