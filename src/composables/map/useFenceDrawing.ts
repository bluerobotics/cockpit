import L from 'leaflet'
import { type Ref, ref, shallowRef, toRaw } from 'vue'

import { centroidLatLng, polygonAreaSquareMeters } from '@/libs/mission/general-estimates'
import { useGeoFenceStore } from '@/stores/geoFence'
import type { WaypointCoordinates } from '@/types/mission'

const FENCE_DRAW_COLOR = '#FF8800'

/**
 * Dependencies the planning view injects into {@link useFenceDrawing} —
 * everything that is owned by the view (the Leaflet map instance, the measure
 * overlay plumbing, area-label formatting) but is needed by the drawing
 * primitives. Keeping these out of the composable lets the planning view stay
 * the single owner of the map and measure-pane lifecycle.
 */
export interface UseFenceDrawingDeps {
  /**
   * Reactive reference to the planning Leaflet map instance. The composable
   * reads it on demand so it transparently picks up late-mounted maps.
   */
  map: Ref<L.Map | undefined>
  /**
   * Formats a square-meter area into the human-readable label used inside
   * the live area pill (delegated so the view can stay the single source of
   * unit/locale formatting).
   */
  formatArea: (squareMeters: number) => string
  /**
   * Builds the L.Marker that renders the area pill at the polygon centroid.
   * The view owns this because it shares the marker with the survey flow and
   * wants identical styling/pane assignment across both flows.
   */
  makeAreaMarker: (at: L.LatLng, text: string) => L.Marker
  /**
   * Adds a measure-overlay layer (area pills, distance labels) to the
   * shared measure layer-group owned by the view.
   */
  addAreaToMeasureLayer: (layer: L.Layer) => void
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
   * drawn. Mirrors the Leaflet vertex markers and is kept in sync with
   * `geoFenceStore.pendingPolygonVertices` on every mutation.
   */
  polygonVertexesPositions: Ref<L.LatLng[]>
  /**
   * Adds a new vertex to the in-progress polygon at the end of the chain
   * or, when `edgeIndex` is provided, between the vertex at `edgeIndex`
   * and the next one (used when the user clicks a "+" marker on an edge).
   */
  addPolygonPoint: (latlng: L.LatLng, edgeIndex?: number) => void
  /**
   * Commits the in-progress polygon to the store, transitioning the editor
   * out of the drawing state. No-op when fewer than 3 vertexes exist.
   */
  finishPolygonDrawing: () => void
  /**
   * Removes every Leaflet artifact created during polygon drawing
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
  setPendingCircleCenter: (latlng: L.LatLng) => void
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
 * Leaflet map, the area-label/measure-layer plumbing, and the confirm-button
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

  const polygonVertexesPositions = ref<L.LatLng[]>([])
  const polygonVertexesMarkers = ref<L.Marker[]>([])
  const polygonLayer = shallowRef<L.Polygon | null>(null)
  const edgeAddMarkers: L.Marker[] = []
  const livePolygonAreaMarker = shallowRef<L.Marker | null>(null)

  const pendingCircleCenterMarker = shallowRef<L.Marker | null>(null)
  const pendingCircleLayer = shallowRef<L.Circle | null>(null)

  const syncVerticesToStore = (): void => {
    fenceStore.pendingPolygonVertices.splice(
      0,
      fenceStore.pendingPolygonVertices.length,
      ...polygonVertexesPositions.value.map(({ lat, lng }) => [lat, lng] as [number, number])
    )
  }

  const updateLivePolygonAreaLabel = (coords: WaypointCoordinates[]): void => {
    if (coords.length < 3) {
      if (livePolygonAreaMarker.value) {
        deps.map.value?.removeLayer(livePolygonAreaMarker.value)
        livePolygonAreaMarker.value = null
      }
      return
    }

    const m2 = polygonAreaSquareMeters(coords)
    const label = deps.formatArea(m2)
    const centerTuple = centroidLatLng(coords)
    if (!Number.isFinite(centerTuple[0]) || !Number.isFinite(centerTuple[1])) return
    const center = L.latLng(centerTuple[0], centerTuple[1])

    if (!livePolygonAreaMarker.value) {
      livePolygonAreaMarker.value = deps.makeAreaMarker(center, label)
      deps.addAreaToMeasureLayer(livePolygonAreaMarker.value)
    } else {
      livePolygonAreaMarker.value.setLatLng(center)
      const el = livePolygonAreaMarker.value.getElement()
      if (el) el.querySelector('.measure-area-pill')!.textContent = label
    }
  }

  const updatePolygonLayer = (): void => {
    polygonVertexesPositions.value = polygonVertexesMarkers.value.map((marker) => marker.getLatLng())

    if (polygonLayer.value) {
      polygonLayer.value.setLatLngs(polygonVertexesPositions.value)
    } else if (polygonVertexesPositions.value.length >= 3) {
      polygonLayer.value = L.polygon(polygonVertexesPositions.value, {
        color: FENCE_DRAW_COLOR,
        fillColor: FENCE_DRAW_COLOR,
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '4 4',
        className: 'fence-polygon-draft',
      }).addTo(toRaw(deps.map.value)!)
    }

    if (polygonLayer.value && polygonVertexesPositions.value.length >= 3) {
      updateLivePolygonAreaLabel(polygonVertexesPositions.value.map((p) => [p.lat, p.lng] as WaypointCoordinates))
    } else if (polygonVertexesPositions.value.length < 3 && polygonLayer.value) {
      deps.map.value?.removeLayer(polygonLayer.value as unknown as L.Layer)
      polygonLayer.value = null
      updateLivePolygonAreaLabel([])
    }

    syncVerticesToStore()
  }

  const updateEdgeAddMarkers = (): void => {
    edgeAddMarkers.forEach((marker) => marker.remove())
    edgeAddMarkers.length = 0

    if (polygonVertexesPositions.value.length < 3) return

    for (let i = 0; i < polygonVertexesPositions.value.length; i++) {
      const start = polygonVertexesPositions.value[i]
      const end = polygonVertexesPositions.value[(i + 1) % polygonVertexesPositions.value.length]
      const middle = L.latLng((start.lat + end.lat) / 2, (start.lng + end.lng) / 2)

      const edgeAddMarker = L.marker(middle, {
        icon: L.divIcon({
          html: `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <circle cx="10" cy="10" r="9" fill="white" stroke="${FENCE_DRAW_COLOR}" stroke-width="2"/>
              <path d="M10 5V15M5 10H15" stroke="${FENCE_DRAW_COLOR}" stroke-width="2"/>
            </svg>
          `,
          className: 'fence-edge-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })

      edgeAddMarker.on('click', (e: L.LeafletMouseEvent) => addPolygonPoint(e.latlng, i))
      edgeAddMarker.addTo(toRaw(deps.map.value)!)
      edgeAddMarkers.push(edgeAddMarker)
    }
  }

  const createVertexMarker = (
    latlng: L.LatLng,
    onClick: (marker: L.Marker, evt: L.LeafletEvent) => void,
    onDrag: () => void
  ): L.Marker => {
    let justCreated = true

    return L.marker(latlng, {
      icon: L.divIcon({
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
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      draggable: true,
    })
      .on('drag', () => {
        onDrag()
      })
      .on('mouseover', (event: L.LeafletEvent) => {
        if (justCreated) {
          justCreated = false
          return
        }
        const target = event.target as L.Marker
        const popup = target.getElement()?.querySelector('.delete-popup') as HTMLDivElement
        if (popup) popup.style.display = 'block'
      })
      .on('mouseout', (event: L.LeafletEvent) => {
        const target = event.target as L.Marker
        const popup = target.getElement()?.querySelector('.delete-popup') as HTMLDivElement
        if (popup) popup.style.display = 'none'
      })
      .on('click', (event: L.LeafletEvent) => {
        const target = event.target as L.Marker
        onClick(target, event)
      })
  }

  const removePolygonVertex = (index: number): void => {
    const marker = polygonVertexesMarkers.value[index]
    if (!marker) return
    polygonVertexesPositions.value.splice(index, 1)
    polygonVertexesMarkers.value.splice(index, 1)
    marker.remove()
    updatePolygonLayer()
    updateEdgeAddMarkers()
  }

  const addPolygonPoint = (latlng: L.LatLng, edgeIndex: number | undefined = undefined): void => {
    if (!fenceStore.isDrawingPolygon) return

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
    ).addTo(toRaw(deps.map.value)!)

    if (edgeIndex === undefined) {
      polygonVertexesMarkers.value.push(newMarker)
    } else {
      polygonVertexesMarkers.value.splice(edgeIndex + 1, 0, newMarker)
    }

    updatePolygonLayer()
    updateEdgeAddMarkers()
  }

  const finishPolygonDrawing = (): void => {
    if (polygonVertexesPositions.value.length < 3) return
    syncVerticesToStore()
    fenceStore.finishDrawingPolygon()
  }

  const clearPolygonDrawingArtifacts = (): void => {
    if (polygonLayer.value) {
      deps.map.value?.removeLayer(polygonLayer.value as unknown as L.Layer)
      polygonLayer.value = null
    }
    if (livePolygonAreaMarker.value) {
      deps.map.value?.removeLayer(livePolygonAreaMarker.value)
      livePolygonAreaMarker.value = null
    }
    polygonVertexesMarkers.value.forEach((marker) => marker.remove())
    edgeAddMarkers.forEach((marker) => marker.remove())
    edgeAddMarkers.length = 0
    polygonVertexesMarkers.value = []
    polygonVertexesPositions.value = []
  }

  const setPendingCircleCenter = (latlng: L.LatLng): void => {
    if (!fenceStore.isDrawingCircle) return
    fenceStore.setPendingCircleCenter([latlng.lat, latlng.lng])

    if (pendingCircleCenterMarker.value) {
      pendingCircleCenterMarker.value.setLatLng(latlng)
    } else {
      pendingCircleCenterMarker.value = L.marker(latlng, {
        icon: L.divIcon({
          html: `
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="5" fill="${FENCE_DRAW_COLOR}" stroke="white" stroke-width="2"/>
            </svg>
          `,
          className: 'fence-vertex-div-icon',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(toRaw(deps.map.value)!)
    }
  }

  const updatePendingCircleLayer = (): void => {
    if (!deps.map.value) return
    const center = fenceStore.pendingCircleCenter
    const radius = fenceStore.pendingCircleRadius
    if (!center || radius < 1) {
      if (pendingCircleLayer.value) {
        deps.map.value.removeLayer(pendingCircleLayer.value as unknown as L.Layer)
        pendingCircleLayer.value = null
      }
      return
    }

    const latlng = L.latLng(center[0], center[1])
    if (pendingCircleLayer.value) {
      pendingCircleLayer.value.setLatLng(latlng)
      pendingCircleLayer.value.setRadius(radius)
    } else {
      pendingCircleLayer.value = L.circle(latlng, {
        radius,
        color: FENCE_DRAW_COLOR,
        fillColor: FENCE_DRAW_COLOR,
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '4 4',
        className: 'fence-circle-draft',
        interactive: false,
      }).addTo(toRaw(deps.map.value)!)
    }
  }

  const clearPendingCircleArtifacts = (): void => {
    if (pendingCircleLayer.value) {
      deps.map.value?.removeLayer(pendingCircleLayer.value as unknown as L.Layer)
      pendingCircleLayer.value = null
    }
    if (pendingCircleCenterMarker.value) {
      deps.map.value?.removeLayer(pendingCircleCenterMarker.value)
      pendingCircleCenterMarker.value = null
    }
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
