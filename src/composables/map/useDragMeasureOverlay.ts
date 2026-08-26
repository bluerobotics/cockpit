import L, { type Map as LeafletMap } from 'leaflet'

import { affectedAngleTriples } from '@/libs/map/utils-map'
import { bearingBetween, formatBearing, formatMetersShort } from '@/libs/mission/general-estimates'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

import { useMeasurePillOverlay } from './useMeasurePillOverlay'
import type { UseVertexAngleOverlayReturn } from './useVertexAngleOverlay'

/**
 * Return type of {@link useDragMeasureOverlay}.
 */
export interface UseDragMeasureOverlayReturn {
  /** Binds the overlay to a Leaflet map. */
  initDragMeasureOverlay: (map: LeafletMap) => void
  /** Renders distance/heading pills on the segments touching the dragged waypoint, plus the affected vertex angles. */
  renderDragMeasurePills: (waypointId: string) => void
  /** Removes the drag pills and the vertex angles it drew. */
  destroyDragMeasureOverlay: () => void
}

/**
 * While a waypoint is dragged, shows a distance/heading pill on each path segment touching it and, through the
 * shared angle overlay, the interior angle at the dragged vertex and its immediate neighbors.
 * @param {UseVertexAngleOverlayReturn} angleOverlay - Shared vertex-angle overlay used to draw the affected angles.
 * @returns {UseDragMeasureOverlayReturn} Methods to initialize, render, and tear down the drag-measure overlay.
 */
export const useDragMeasureOverlay = (angleOverlay: UseVertexAngleOverlayReturn): UseDragMeasureOverlayReturn => {
  const missionStore = useMissionStore()
  const { initMeasurePillOverlay, renderMeasurePills, destroyMeasurePillOverlay } = useMeasurePillOverlay()

  const initDragMeasureOverlay = (map: LeafletMap): void => {
    initMeasurePillOverlay(map)
  }

  const destroyDragMeasureOverlay = (): void => {
    destroyMeasurePillOverlay()
    angleOverlay.clearVertexAngles()
  }

  const renderDragMeasurePills = (waypointId: string): void => {
    const wps = missionStore.currentPlanningWaypoints
    const index = wps.findIndex((w) => w.id === waypointId)
    if (index < 0) {
      destroyDragMeasureOverlay()
      return
    }

    const segments: [WaypointCoordinates, WaypointCoordinates][] = []
    if (index > 0) segments.push([wps[index - 1].coordinates, wps[index].coordinates])
    if (index < wps.length - 1) segments.push([wps[index].coordinates, wps[index + 1].coordinates])
    if (segments.length === 0) {
      destroyDragMeasureOverlay()
      return
    }

    renderMeasurePills(
      segments.map(([from, to]) => {
        const fromLatLng = L.latLng(from[0], from[1])
        const toLatLng = L.latLng(to[0], to[1])
        const distance = fromLatLng.distanceTo(toLatLng)
        const bearing = bearingBetween(from, to)
        return {
          from: fromLatLng,
          to: toLatLng,
          text: distance < 1 ? null : `${formatMetersShort(distance)} · ${formatBearing(bearing)}`,
        }
      })
    )

    const triples = affectedAngleTriples(wps, index)
    if (triples.length > 0) {
      angleOverlay.renderVertexAngles(triples)
    } else {
      angleOverlay.clearVertexAngles()
    }
  }

  return { initDragMeasureOverlay, renderDragMeasurePills, destroyDragMeasureOverlay }
}
