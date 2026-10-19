import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import { type Ref, ref, shallowRef, toRaw } from 'vue'

import { useGeoFenceEditorDraft } from '@/composables/useGeoFenceEditorDraft'
import { asFenceMarker, fenceLayerId } from '@/libs/map/fence-layers'
import {
  beforeIdForSlot,
  divIconMarker,
  fromLngLat,
  linePaint,
  meterCircle,
  polygonFeature,
  removeLayersAndSource,
  toLngLat,
  upsertGeoJsonSource,
} from '@/libs/map/maplibre'
import { centroidLatLng, polygonAreaSquareMeters } from '@/libs/mission/general-estimates'
import { useGeoFenceStore } from '@/stores/geoFence'
import type { WaypointCoordinates } from '@/types/mission'

const FENCE_DRAW_COLOR = '#FF8800'
const polygonDraftId = fenceLayerId('polygon-draft')
const circleDraftId = fenceLayerId('circle-draft')

// Draws a dashed, lightly filled draft shape, or replaces the one already drawn.
const setDraftShape = (map: MapLibreMap, id: string, data: GeoJSON.Feature): void => {
  upsertGeoJsonSource(map, id, data)
  if (map.getLayer(`${id}-fill`)) return
  const beforeId = beforeIdForSlot(map, 'fence')
  map.addLayer(
    { id: `${id}-fill`, type: 'fill', source: id, paint: { 'fill-color': FENCE_DRAW_COLOR, 'fill-opacity': 0.15 } },
    beforeId
  )
  map.addLayer(
    {
      id: `${id}-line`,
      type: 'line',
      source: id,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: linePaint({ color: FENCE_DRAW_COLOR, width: 2, dashPattern: [4, 4] }) as never,
    },
    beforeId
  )
}

const removeDraftShape = (map: MapLibreMap | undefined, id: string): void =>
  removeLayersAndSource(map, [`${id}-fill`, `${id}-line`], id)

/**
 * Dependencies the planning view injects into {@link useFenceDrawing} —
 * everything that is owned by the view (the map instance, the measure
 * overlay plumbing, area-label formatting) but is needed by the drawing
 * primitives. Keeping these out of the composable lets the planning view stay
 * the single owner of the map and measure-pane lifecycle.
 */
export interface UseFenceDrawingDeps {
  /**
   * Reactive reference to the planning map instance. The composable
   * reads it on demand so it transparently picks up late-mounted maps.
   */
  map: Ref<MapLibreMap | undefined>
  /**
   * Formats a square-meter area into the human-readable label used inside
   * the live area pill (delegated so the view can stay the single source of
   * unit/locale formatting).
   */
  formatArea: (squareMeters: number) => string
  /**
   * Builds the marker that renders the area pill at the polygon centroid.
   * The view owns this because it shares the marker with the survey flow and
   * wants identical styling across both flows.
   */
  makeAreaMarker: (at: WaypointCoordinates, text: string) => Marker
  /**
   * Adds a measure-overlay marker (area pills, distance labels) to the
   * shared measure overlay owned by the view.
   */
  addAreaToMeasureLayer: (marker: Marker) => void
}

/**
 * Public surface of the fence drawing composable. The view consumes
 * `polygonVertexesPositions` for template guards and confirm-button
 * placement, and calls the action functions from the map click handlers,
 * the confirm button, and the cleanup paths in the planning lifecycle.
 */
export interface UseFenceDrawingApi {
  /**
   * Reactive list of vertex coordinates of the polygon currently being
   * drawn. Mirrors the vertex markers and is kept in sync with
   * the fence editor draft's `pendingPolygonVertices` on every mutation.
   */
  polygonVertexesPositions: Ref<WaypointCoordinates[]>
  /**
   * Adds a new vertex to the in-progress polygon at the end of the chain
   * or, when `edgeIndex` is provided, between the vertex at `edgeIndex`
   * and the next one (used when the user clicks a "+" marker on an edge).
   */
  addPolygonPoint: (latlng: WaypointCoordinates, edgeIndex?: number) => void
  /**
   * Commits the in-progress polygon to the store, transitioning the editor
   * out of the drawing state. No-op when fewer than 3 vertexes exist.
   */
  finishPolygonDrawing: () => void
  /**
   * Removes every map artifact created during polygon drawing
   * (vertexes, edge "+" markers, the dashed polygon, the area pill) and
   * resets the internal state. Used when the user cancels the draw or
   * switches planning modes mid-draw.
   */
  clearPolygonDrawingArtifacts: () => void
  /**
   * Sets (or moves) the center marker for the in-progress circle and
   * stores it on the geofence store so subsequent mouse-moves can compute
   * the radius preview.
   */
  setPendingCircleCenter: (latlng: WaypointCoordinates) => void
  /**
   * Refreshes the dashed circle preview from the geofence store's
   * pending center and radius. Called on each mouse-move while drawing.
   */
  updatePendingCircleLayer: () => void
  /**
   * Removes both the pending-circle dashed layer and its center marker.
   * Used when committing the circle or cancelling mid-draw.
   */
  clearPendingCircleArtifacts: () => void
}

/**
 * Encapsulates the in-progress fence drawing state for the planning map:
 * polygon vertex markers, edge "+"-markers, the dashed live polygon, the
 * area pill at the centroid, and the two-click circle drawing primitives.
 *
 * Mirrors the survey-polygon UX (crosshair, draggable vertices, hover-delete,
 * "+"-markers on edges) but in the orange fence palette. The view owns the
 * map, the area-label/measure-layer plumbing, and the confirm-button
 * positioning logic — all injected through {@link UseFenceDrawingDeps}.
 *
 * The composable does not call any view-side UI helper itself; instead, the
 * exposed `polygonVertexesPositions` ref triggers the view's existing watch
 * so confirm-button repositioning happens through the same path the survey
 * flow already uses.
 * @param {UseFenceDrawingDeps} deps Map and measure-layer plumbing owned by the planning view.
 * @returns {UseFenceDrawingApi} Fence drawing state and action functions for the view.
 */
export const useFenceDrawing = (deps: UseFenceDrawingDeps): UseFenceDrawingApi => {
  const fenceStore = useGeoFenceStore()
  const fenceDraft = useGeoFenceEditorDraft()

  const polygonVertexesPositions = ref<WaypointCoordinates[]>([])
  const polygonVertexesMarkers = shallowRef<Marker[]>([])
  let polygonDrawn = false
  const edgeAddMarkers: Marker[] = []
  const livePolygonAreaMarker = shallowRef<Marker | null>(null)

  const pendingCircleCenterMarker = shallowRef<Marker | null>(null)
  let pendingCircleDrawn = false

  const syncVerticesToStore = (): void => {
    fenceDraft.pendingPolygonVertices.splice(
      0,
      fenceDraft.pendingPolygonVertices.length,
      ...polygonVertexesPositions.value.map(([lat, lng]) => [lat, lng] as [number, number])
    )
  }

  const updateLivePolygonAreaLabel = (coords: WaypointCoordinates[]): void => {
    if (coords.length < 3) {
      livePolygonAreaMarker.value?.remove()
      livePolygonAreaMarker.value = null
      return
    }

    const m2 = polygonAreaSquareMeters(coords)
    const label = deps.formatArea(m2)
    const centerTuple = centroidLatLng(coords)
    if (!Number.isFinite(centerTuple[0]) || !Number.isFinite(centerTuple[1])) return

    if (!livePolygonAreaMarker.value) {
      livePolygonAreaMarker.value = deps.makeAreaMarker(centerTuple, label)
      deps.addAreaToMeasureLayer(livePolygonAreaMarker.value)
    } else {
      livePolygonAreaMarker.value.setLngLat(toLngLat(centerTuple))
      const pill = livePolygonAreaMarker.value.getElement().querySelector('.measure-area-pill')
      if (pill) pill.textContent = label
    }
  }

  const updatePolygonLayer = (): void => {
    const map = toRaw(deps.map.value)
    if (!map) return
    polygonVertexesPositions.value = polygonVertexesMarkers.value.map((marker) => fromLngLat(marker.getLngLat()))

    if (polygonDrawn || polygonVertexesPositions.value.length >= 3) {
      setDraftShape(map, polygonDraftId, polygonFeature(polygonVertexesPositions.value))
      polygonDrawn = true
    }

    if (polygonDrawn && polygonVertexesPositions.value.length >= 3) {
      updateLivePolygonAreaLabel(polygonVertexesPositions.value)
    } else if (polygonVertexesPositions.value.length < 3 && polygonDrawn) {
      removeDraftShape(map, polygonDraftId)
      polygonDrawn = false
      updateLivePolygonAreaLabel([])
    }

    syncVerticesToStore()
  }

  const updateEdgeAddMarkers = (): void => {
    const map = toRaw(deps.map.value)
    if (!map) return
    edgeAddMarkers.forEach((marker) => marker.remove())
    edgeAddMarkers.length = 0

    if (polygonVertexesPositions.value.length < 3) return

    for (let i = 0; i < polygonVertexesPositions.value.length; i++) {
      const start = polygonVertexesPositions.value[i]
      const end = polygonVertexesPositions.value[(i + 1) % polygonVertexesPositions.value.length]
      const middle: WaypointCoordinates = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]

      const edgeAddMarker = asFenceMarker(
        divIconMarker({
          html: `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <circle cx="10" cy="10" r="9" fill="white" stroke="${FENCE_DRAW_COLOR}" stroke-width="2"/>
              <path d="M10 5V15M5 10H15" stroke="${FENCE_DRAW_COLOR}" stroke-width="2"/>
            </svg>
          `,
          className: 'fence-edge-marker',
          size: [24, 24],
        })
      )

      // The new vertex lands on the "+", where a click on a marker always placed it.
      edgeAddMarker.getElement().addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation()
        addPolygonPoint(middle, i)
      })
      edgeAddMarker.setLngLat(toLngLat(middle)).addTo(map)
      edgeAddMarkers.push(edgeAddMarker)
    }
  }

  const createVertexMarker = (
    latlng: WaypointCoordinates,
    onClick: (marker: Marker) => void,
    onDrag: () => void
  ): Marker => {
    let justCreated = true
    let justDragged = false

    const marker = asFenceMarker(
      divIconMarker({
        html: `
          <div class="fence-vertex-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="5" fill="${FENCE_DRAW_COLOR}" stroke="white" stroke-width="2"/>
            </svg>
            <div class="delete-popup" style="display: none;">
              <button class="delete-button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4h12M4 4v10a2 2 0 002 2h4a2 2 0 002-2V4M6 4V2h4v2"
                        stroke="white" stroke-width="1.5"
                        stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
            </div>
          </div>
        `,
        className: 'fence-vertex-div-icon',
        size: [24, 24],
        draggable: true,
      })
    ).setLngLat(toLngLat(latlng))

    // A drag ends with a click on the vertex, which must not delete it.
    marker.on('drag', () => {
      justDragged = true
      onDrag()
    })
    marker.on('dragend', () => setTimeout(() => (justDragged = false), 0))

    const element = marker.getElement()
    const popup = element.querySelector('.delete-popup') as HTMLDivElement | null
    element.addEventListener('mouseenter', () => {
      if (justCreated) {
        justCreated = false
        return
      }
      if (popup) popup.style.display = 'block'
    })
    element.addEventListener('mouseleave', () => {
      if (popup) popup.style.display = 'none'
    })
    element.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation()
      if (!justDragged) onClick(marker)
    })
    return marker
  }

  const removePolygonVertex = (index: number): void => {
    const marker = polygonVertexesMarkers.value[index]
    if (!marker) return
    polygonVertexesPositions.value.splice(index, 1)
    polygonVertexesMarkers.value = polygonVertexesMarkers.value.filter((_, i) => i !== index)
    marker.remove()
    updatePolygonLayer()
    updateEdgeAddMarkers()
  }

  const addPolygonPoint = (latlng: WaypointCoordinates, edgeIndex: number | undefined = undefined): void => {
    if (!fenceDraft.isDrawingPolygon) return
    const map = toRaw(deps.map.value)
    if (!map) return

    if (edgeIndex === undefined) {
      polygonVertexesPositions.value.push(latlng)
    } else {
      polygonVertexesPositions.value.splice(edgeIndex + 1, 0, latlng)
    }

    const newMarker = createVertexMarker(
      latlng,
      (marker) => {
        const idx = polygonVertexesMarkers.value.indexOf(marker)
        if (idx !== -1) removePolygonVertex(idx)
      },
      () => {
        updatePolygonLayer()
        updateEdgeAddMarkers()
      }
    ).addTo(map)

    const markers = [...polygonVertexesMarkers.value]
    markers.splice(edgeIndex === undefined ? markers.length : edgeIndex + 1, 0, newMarker)
    polygonVertexesMarkers.value = markers

    updatePolygonLayer()
    updateEdgeAddMarkers()
  }

  const finishPolygonDrawing = (): void => {
    if (polygonVertexesPositions.value.length < 3) return
    syncVerticesToStore()
    fenceStore.finishDrawingPolygon()
  }

  const clearPolygonDrawingArtifacts = (): void => {
    removeDraftShape(toRaw(deps.map.value), polygonDraftId)
    polygonDrawn = false
    livePolygonAreaMarker.value?.remove()
    livePolygonAreaMarker.value = null
    polygonVertexesMarkers.value.forEach((marker) => marker.remove())
    edgeAddMarkers.forEach((marker) => marker.remove())
    edgeAddMarkers.length = 0
    polygonVertexesMarkers.value = []
    polygonVertexesPositions.value = []
  }

  const setPendingCircleCenter = (latlng: WaypointCoordinates): void => {
    if (!fenceDraft.isDrawingCircle) return
    const map = toRaw(deps.map.value)
    if (!map) return
    fenceDraft.setPendingCircleCenter([latlng[0], latlng[1]])

    if (pendingCircleCenterMarker.value) {
      pendingCircleCenterMarker.value.setLngLat(toLngLat(latlng))
    } else {
      const marker = asFenceMarker(
        divIconMarker({
          html: `
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="5" fill="${FENCE_DRAW_COLOR}" stroke="white" stroke-width="2"/>
            </svg>
          `,
          className: 'fence-vertex-div-icon',
          size: [14, 14],
        })
      )
      marker.getElement().style.pointerEvents = 'none'
      pendingCircleCenterMarker.value = marker.setLngLat(toLngLat(latlng)).addTo(map)
    }
  }

  const updatePendingCircleLayer = (): void => {
    const map = toRaw(deps.map.value)
    if (!map) return
    const center = fenceDraft.pendingCircleCenter
    const radius = fenceDraft.pendingCircleRadius
    if (!center || radius < 1) {
      if (pendingCircleDrawn) removeDraftShape(map, circleDraftId)
      pendingCircleDrawn = false
      return
    }

    setDraftShape(map, circleDraftId, meterCircle(center, radius))
    pendingCircleDrawn = true
  }

  const clearPendingCircleArtifacts = (): void => {
    removeDraftShape(toRaw(deps.map.value), circleDraftId)
    pendingCircleDrawn = false
    pendingCircleCenterMarker.value?.remove()
    pendingCircleCenterMarker.value = null
  }

  return {
    polygonVertexesPositions,
    addPolygonPoint,
    finishPolygonDrawing,
    clearPolygonDrawingArtifacts,
    setPendingCircleCenter,
    updatePendingCircleLayer,
    clearPendingCircleArtifacts,
  }
}
