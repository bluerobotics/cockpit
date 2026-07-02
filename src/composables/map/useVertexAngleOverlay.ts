import L, { type Map as LeafletMap } from 'leaflet'

import { computeVertexAngle } from '@/libs/map/utils-map'
import type { WaypointCoordinates } from '@/types/mission'

const ANGLE_PANE = 'measureAnglePane'

/** A `[prev, curr, next]` vertex triple whose interior angle at `curr` should be drawn. */
export type VertexAngleTriple = [WaypointCoordinates, WaypointCoordinates, WaypointCoordinates]

/**
 * Return type of {@link useVertexAngleOverlay}.
 */
export interface UseVertexAngleOverlayReturn {
  /** Binds the overlay to a Leaflet map and creates the dedicated pane. */
  initAngleOverlay: (map: LeafletMap) => void
  /** Draws (or updates) an interior-angle arc and degree tag at each given vertex triple, recycling layers. */
  renderVertexAngles: (triples: VertexAngleTriple[]) => void
  /** Draws (or updates) the interior angle at a single `prev`→`curr`→`next` vertex. */
  renderVertexAngle: (prev: WaypointCoordinates, curr: WaypointCoordinates, next: WaypointCoordinates) => void
  /** Removes every angle arc and tag currently on the map. */
  clearVertexAngles: () => void
  /** Clears the overlay and unbinds the map. */
  destroyAngleOverlay: () => void
}

/**
 * Draws interior-angle arcs with degree labels at path vertices on a Leaflet map, recycling layers across ticks
 * so it stays cheap on pointer-frequency updates. Shared by the live measure while drawing and by the
 * drag-measure overlay, and reusable by any map surface that needs to visualize turn angles.
 * @returns {UseVertexAngleOverlayReturn} Methods to initialize, render, clear, and tear down the angle overlay.
 */
export const useVertexAngleOverlay = (): UseVertexAngleOverlayReturn => {
  let mapRef: LeafletMap | undefined
  let arcLayers: L.Polyline[] = []
  let tagLayers: L.Marker[] = []
  let tagPillEls: (HTMLElement | null)[] = []

  const initAngleOverlay = (map: LeafletMap): void => {
    mapRef = map
    if (map.getPane(ANGLE_PANE)) return
    // Above the tooltip pane (650, where waypoint numbers live) so angle tags always sit on top.
    const pane = map.createPane(ANGLE_PANE)
    pane.style.zIndex = '660'
    pane.style.pointerEvents = 'none'
  }

  const renderVertexAngles = (triples: VertexAngleTriple[]): void => {
    if (!mapRef) return
    const map = mapRef
    const mapZoom = map.getZoom()
    const angles = triples
      .map(([prev, curr, next]) => computeVertexAngle(prev, curr, next, mapZoom))
      .filter((angle) => angle.labelAt !== null)

    while (arcLayers.length > angles.length) {
      arcLayers.pop()?.remove()
      tagLayers.pop()?.remove()
      tagPillEls.pop()
    }

    angles.forEach((angle, i) => {
      const arcLatLngs = angle.arc.map((c) => L.latLng(c[0], c[1]))
      const labelAt = angle.labelAt!
      const label = `${angle.angleDeg.toFixed(1)}°`
      if (arcLayers[i]) {
        arcLayers[i].setLatLngs(arcLatLngs)
        tagLayers[i].setLatLng([labelAt[0], labelAt[1]])
        const pill = tagPillEls[i]
        if (pill) pill.textContent = label
      } else {
        arcLayers[i] = L.polyline(arcLatLngs, {
          color: '#2563eb',
          weight: 2,
          opacity: 0.9,
          interactive: false,
        }).addTo(map)
        const icon = L.divIcon({
          className: 'measure-angle-tag',
          html: `<div class="measure-angle-pill">${label}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })
        const tag = L.marker([labelAt[0], labelAt[1]], { icon, interactive: false, pane: ANGLE_PANE }).addTo(map)
        tagLayers[i] = tag
        tagPillEls[i] = tag.getElement()?.querySelector('.measure-angle-pill') ?? null
      }
    })
  }

  const renderVertexAngle = (prev: WaypointCoordinates, curr: WaypointCoordinates, next: WaypointCoordinates): void => {
    renderVertexAngles([[prev, curr, next]])
  }

  const clearVertexAngles = (): void => {
    arcLayers.forEach((layer) => layer.remove())
    tagLayers.forEach((layer) => layer.remove())
    arcLayers = []
    tagLayers = []
    tagPillEls = []
  }

  const destroyAngleOverlay = (): void => {
    clearVertexAngles()
    mapRef = undefined
  }

  return { initAngleOverlay, renderVertexAngles, renderVertexAngle, clearVertexAngles, destroyAngleOverlay }
}
