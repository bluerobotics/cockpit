import type L from 'leaflet'
import { type Ref, computed } from 'vue'

import { useGeoFenceEditorDraft } from '@/composables/useGeoFenceEditorDraft'
import { useGeoFenceStore } from '@/stores/geoFence'

/**
 * Options for `useFenceMapInteraction`.
 */
export interface UseFenceMapInteractionOptions {
  /**
   * Reactive planning mode from the planning view. Fence input is
   * only routed while the view is in `'geofence'` mode; the composable
   * silently short-circuits otherwise.
   */
  planningMode: Ref<'mission' | 'geofence'>
  /**
   * Fence-drawing composable action that appends a new latitude/longitude
   * vertex to the polygon currently being drawn.
   */
  addFencePolygonPoint: (latlng: L.LatLng) => void
  /**
   * Fence-drawing composable action that seeds the center of a
   * to-be-drawn circle fence at the given latitude/longitude.
   */
  setPendingFenceCircleCenter: (latlng: L.LatLng) => void
  /**
   * Planning view callback that clears the ephemeral measure preview
   * so a fresh vertex or circle center does not leave a stale line
   * dangling from the previous pointer position.
   */
  clearLiveMeasure: () => void
}

/**
 * Bridges keyboard shortcuts and map clicks into the geofence drawing
 * state machine when the planning view is in geofence mode. The
 * planning view keeps its existing key/click listeners; this composable
 * only exposes handlers that the view delegates to so the fence code
 * paths live in one place.
 */
export interface UseFenceMapInteractionReturn {
  /**
   * Handles the fence-relevant subset of the planning view's global
   * keydown handler (Escape cancels the current polygon or circle
   * draw, Enter finishes it when valid). Safe to call for every key
   * event since it no-ops outside fence mode.
   */
  handleFenceKeyDown: (event: KeyboardEvent) => void
  /**
   * Handles a Leaflet map click while a fence shape is being drawn.
   * Returns `true` when the click was consumed by fence handling so
   * the planning view knows to skip its mission/survey click paths.
   * @returns `true` if fence handling consumed the click, `false`
   * otherwise so the caller can fall through to its own logic.
   */
  onFenceMapClick: (e: L.LeafletMouseEvent) => boolean
}

/**
 * Encapsulate the fence-mode keyboard and map-click branching that
 * used to live inline in the planning view. Keeps the planning view
 * agnostic of fence store internals.
 * @param {UseFenceMapInteractionOptions} options Wiring to the planning
 * view's planning mode, the fence drawing composable actions and the
 * planning view's live-measure clearing callback.
 * @returns {UseFenceMapInteractionReturn} Delegates for keydown and
 * map-click events.
 */
export const useFenceMapInteraction = (options: UseFenceMapInteractionOptions): UseFenceMapInteractionReturn => {
  const fenceStore = useGeoFenceStore()
  const fenceDraft = useGeoFenceEditorDraft()
  const inFenceMode = computed(() => options.planningMode.value === 'geofence')

  const handleFenceKeyDown = (event: KeyboardEvent): void => {
    if (!inFenceMode.value) return
    if (event.key === 'Escape') {
      if (fenceDraft.isDrawingPolygon) fenceDraft.cancelDrawingPolygon()
      if (fenceDraft.isDrawingCircle) fenceDraft.cancelDrawingCircle()
      return
    }
    if (event.key === 'Enter') {
      if (fenceDraft.isDrawingPolygon) {
        fenceStore.finishDrawingPolygon()
      } else if (fenceDraft.isDrawingCircle && fenceDraft.pendingCircleCenter && fenceDraft.pendingCircleRadius >= 1) {
        fenceStore.finishDrawingCircle()
      }
    }
  }

  const onFenceMapClick = (e: L.LeafletMouseEvent): boolean => {
    if (!inFenceMode.value) return false
    if (fenceDraft.isDrawingPolygon) {
      options.addFencePolygonPoint(e.latlng)
      options.clearLiveMeasure()
      return true
    }
    if (fenceDraft.isDrawingCircle) {
      if (!fenceDraft.pendingCircleCenter) {
        options.setPendingFenceCircleCenter(e.latlng)
      } else if (fenceDraft.pendingCircleRadius >= 1) {
        fenceStore.finishDrawingCircle()
      }
      return true
    }
    return false
  }

  return { handleFenceKeyDown, onFenceMapClick }
}
