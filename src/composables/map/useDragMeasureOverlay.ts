import L, { type Map as LeafletMap } from 'leaflet'

import { affectedAngleTriples } from '@/libs/map/utils-map'
import { bearingBetween, formatBearing, formatMetersShort } from '@/libs/mission/general-estimates'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

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

  let mapRef: LeafletMap | undefined
  let overlayEl: HTMLDivElement | null = null
  let pillEls: HTMLDivElement[] = []

  const initDragMeasureOverlay = (map: LeafletMap): void => {
    mapRef = map
  }

  const ensureOverlay = (map: LeafletMap): void => {
    if (overlayEl) return
    overlayEl = document.createElement('div')
    overlayEl.className = 'measure-overlay'
    overlayEl.style.pointerEvents = 'none'
    overlayEl.style.position = 'absolute'
    overlayEl.style.inset = '0'
    overlayEl.style.zIndex = '640'
    map.getContainer().appendChild(overlayEl)
  }

  const destroyDragMeasureOverlay = (): void => {
    overlayEl?.remove()
    overlayEl = null
    pillEls = []
    angleOverlay.clearVertexAngles()
  }

  const renderDragMeasurePills = (waypointId: string): void => {
    if (!mapRef) return
    const map = mapRef
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

    ensureOverlay(map)
    while (pillEls.length < segments.length) {
      const pill = document.createElement('div')
      pill.className = 'live-measure-pill'
      pill.style.position = 'absolute'
      pill.style.transform = 'translate(-50%, -50%)'
      overlayEl!.appendChild(pill)
      pillEls.push(pill)
    }

    segments.forEach(([from, to], i) => {
      const fromLatLng = L.latLng(from[0], from[1])
      const toLatLng = L.latLng(to[0], to[1])
      const a = map.latLngToContainerPoint(fromLatLng)
      const b = map.latLngToContainerPoint(toLatLng)
      const dist = fromLatLng.distanceTo(toLatLng)
      const bearing = bearingBetween(from, to)
      const pill = pillEls[i]
      pill.textContent = `${formatMetersShort(dist)} · ${formatBearing(bearing)}`
      pill.style.left = `${(a.x + b.x) / 2}px`
      pill.style.top = `${(a.y + b.y) / 2}px`
      pill.style.display = dist < 1 ? 'none' : 'block'
    })
    for (let i = segments.length; i < pillEls.length; i++) {
      pillEls[i].style.display = 'none'
    }

    const triples = affectedAngleTriples(wps, index)
    if (triples.length > 0) {
      angleOverlay.renderVertexAngles(triples)
    } else {
      angleOverlay.clearVertexAngles()
    }
  }

  return { initDragMeasureOverlay, renderDragMeasurePills, destroyDragMeasureOverlay }
}
