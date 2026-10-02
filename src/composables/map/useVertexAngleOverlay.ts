import type { Map as MapLibreMap, Marker } from 'maplibre-gl'

import {
  divIconMarker,
  fromMapLibreZoom,
  lineFeature,
  removeLayersAndSource,
  setLineLayer,
  slottedLayerId,
  toLngLat,
} from '@/libs/map/maplibre'
import { computeVertexAngle } from '@/libs/map/utils-map'
import type { WaypointCoordinates } from '@/types/mission'

const angleArcsId = slottedLayerId('measure', 'vertex-angle-arcs')
// Above the waypoint-number tooltips (650) so angle tags always sit on top.
const angleTagZIndex = '660'

/** A `[prev, curr, next]` vertex triple whose interior angle at `curr` should be drawn. */
export type VertexAngleTriple = [WaypointCoordinates, WaypointCoordinates, WaypointCoordinates]

/**
 * Return type of {@link useVertexAngleOverlay}.
 */
export interface UseVertexAngleOverlayReturn {
  /** Binds the overlay to a map. */
  initAngleOverlay: (map: MapLibreMap) => void
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
 * Draws interior-angle arcs with degree labels at path vertices on a map, recycling markers across ticks
 * so it stays cheap on pointer-frequency updates. Shared by the live measure while drawing and by the
 * drag-measure overlay, and reusable by any map surface that needs to visualize turn angles.
 * @returns {UseVertexAngleOverlayReturn} Methods to initialize, render, clear, and tear down the angle overlay.
 */
export const useVertexAngleOverlay = (): UseVertexAngleOverlayReturn => {
  let mapRef: MapLibreMap | undefined
  let tagLayers: Marker[] = []
  let tagPillEls: (HTMLElement | null)[] = []

  const initAngleOverlay = (map: MapLibreMap): void => {
    mapRef = map
  }

  const renderVertexAngles = (triples: VertexAngleTriple[]): void => {
    if (!mapRef) return
    const map = mapRef
    const mapZoom = fromMapLibreZoom(map.getZoom())
    const angles = triples
      .map(([prev, curr, next]) => computeVertexAngle(prev, curr, next, mapZoom))
      .filter((angle) => angle.labelAt !== null)

    while (tagLayers.length > angles.length) {
      tagLayers.pop()?.remove()
      tagPillEls.pop()
    }

    setLineLayer(
      map,
      angleArcsId,
      'measure',
      { type: 'FeatureCollection', features: angles.map((angle) => lineFeature(angle.arc)) },
      { color: '#2563eb', width: 2, opacity: 0.9 }
    )

    angles.forEach((angle, i) => {
      const labelAt = angle.labelAt!
      const label = `${angle.angleDeg.toFixed(1)}°`
      if (tagLayers[i]) {
        tagLayers[i].setLngLat(toLngLat(labelAt))
        const pill = tagPillEls[i]
        if (pill) pill.textContent = label
      } else {
        const tag = divIconMarker({
          className: 'measure-angle-tag',
          html: `<div class="measure-angle-pill">${label}</div>`,
          size: [0, 0],
          anchor: [0, 0],
        })
        Object.assign(tag.getElement().style, { pointerEvents: 'none', zIndex: angleTagZIndex })
        tag.setLngLat(toLngLat(labelAt)).addTo(map)
        tagLayers[i] = tag
        tagPillEls[i] = tag.getElement().querySelector('.measure-angle-pill')
      }
    })
  }

  const renderVertexAngle = (prev: WaypointCoordinates, curr: WaypointCoordinates, next: WaypointCoordinates): void => {
    renderVertexAngles([[prev, curr, next]])
  }

  const clearVertexAngles = (): void => {
    removeLayersAndSource(mapRef, [angleArcsId], angleArcsId)
    tagLayers.forEach((layer) => layer.remove())
    tagLayers = []
    tagPillEls = []
  }

  const destroyAngleOverlay = (): void => {
    clearVertexAngles()
    mapRef = undefined
  }

  return { initAngleOverlay, renderVertexAngles, renderVertexAngle, clearVertexAngles, destroyAngleOverlay }
}
