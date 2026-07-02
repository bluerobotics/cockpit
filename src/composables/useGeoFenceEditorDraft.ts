import { reactive } from 'vue'

import { CIRCLE_MAX_RADIUS_M } from '@/libs/geo-fence'
import type { FenceLatLng } from '@/types/geofence'

/**
 * Transient, non-persisted editor interaction state for the geofence editor:
 * which shape is currently selected and the in-progress polygon/circle draw
 * buffers. Kept out of the `geo-fence` store (which owns the persisted plan
 * and vehicle sync) because this is ephemeral UI state shared between the
 * editor panel and the map layer, not app data. Exposed as a single module
 * singleton so every consumer mutates and observes the same draft.
 */
export interface GeoFenceEditorDraft {
  /**
   * Id of the shape currently in edit mode, or `undefined` when none is selected.
   */
  interactiveShapeId: string | undefined
  /**
   * True while the click-to-draw polygon flow is active.
   */
  isDrawingPolygon: boolean
  /**
   * Whether the polygon being drawn is an inclusion fence.
   */
  pendingPolygonInclusion: boolean
  /**
   * Vertices accumulated for the polygon currently being drawn.
   */
  pendingPolygonVertices: FenceLatLng[]
  /**
   * True while the click-to-draw circle flow is active.
   */
  isDrawingCircle: boolean
  /**
   * Whether the circle being drawn is an inclusion fence.
   */
  pendingCircleInclusion: boolean
  /**
   * Center of the circle currently being drawn, or `undefined` before the first click.
   */
  pendingCircleCenter: FenceLatLng | undefined
  /**
   * Live radius (meters) of the circle currently being drawn.
   */
  pendingCircleRadius: number
  /**
   * Selects the shape with the given id as the interactive one.
   * @param { string | undefined } id Shape id to select, or `undefined` to clear.
   */
  setInteractive: (id: string | undefined) => void
  /**
   * Enters the click-to-draw polygon flow, clearing any pending vertices.
   * @param { boolean } inclusion Whether the polygon being drawn is an inclusion fence.
   */
  startDrawingPolygon: (inclusion: boolean) => void
  /**
   * Appends a vertex to the polygon currently being drawn. No-op outside drawing mode.
   * @param { FenceLatLng } vertex The vertex to append, in `[lat, lng]`.
   */
  addPendingPolygonVertex: (vertex: FenceLatLng) => void
  /**
   * Removes the last vertex appended to the polygon currently being drawn.
   */
  popPendingPolygonVertex: () => void
  /**
   * Aborts the polygon currently being drawn, discarding pending vertices.
   */
  cancelDrawingPolygon: () => void
  /**
   * Enters the click-to-draw circle flow, clearing any pending center/radius.
   * @param { boolean } inclusion Whether the circle being drawn is an inclusion fence.
   */
  startDrawingCircle: (inclusion: boolean) => void
  /**
   * Sets the center of the circle currently being drawn (first click). No-op outside drawing mode.
   * @param { FenceLatLng } center The center coordinates, in `[lat, lng]`.
   */
  setPendingCircleCenter: (center: FenceLatLng) => void
  /**
   * Updates the radius (meters) of the circle currently being drawn, clamped to `[1, CIRCLE_MAX_RADIUS_M]`.
   * @param { number } radius The new radius in meters.
   */
  setPendingCircleRadius: (radius: number) => void
  /**
   * Aborts the circle currently being drawn, discarding pending data.
   */
  cancelDrawingCircle: () => void
}

const draft = reactive<GeoFenceEditorDraft>({
  interactiveShapeId: undefined,
  isDrawingPolygon: false,
  pendingPolygonInclusion: true,
  pendingPolygonVertices: [],
  isDrawingCircle: false,
  pendingCircleInclusion: true,
  pendingCircleCenter: undefined,
  pendingCircleRadius: 0,
  setInteractive(id) {
    draft.interactiveShapeId = id
  },
  startDrawingPolygon(inclusion) {
    draft.pendingPolygonInclusion = inclusion
    draft.pendingPolygonVertices.splice(0)
    draft.isDrawingPolygon = true
    draft.interactiveShapeId = undefined
  },
  addPendingPolygonVertex(vertex) {
    if (!draft.isDrawingPolygon) return
    draft.pendingPolygonVertices.push([vertex[0], vertex[1]])
  },
  popPendingPolygonVertex() {
    if (!draft.isDrawingPolygon) return
    draft.pendingPolygonVertices.pop()
  },
  cancelDrawingPolygon() {
    draft.pendingPolygonVertices.splice(0)
    draft.isDrawingPolygon = false
  },
  startDrawingCircle(inclusion) {
    draft.pendingCircleInclusion = inclusion
    draft.pendingCircleCenter = undefined
    draft.pendingCircleRadius = 0
    draft.isDrawingCircle = true
    draft.interactiveShapeId = undefined
  },
  setPendingCircleCenter(center) {
    if (!draft.isDrawingCircle) return
    draft.pendingCircleCenter = [center[0], center[1]]
    draft.pendingCircleRadius = 0
  },
  setPendingCircleRadius(radius) {
    if (!draft.isDrawingCircle || !draft.pendingCircleCenter) return
    draft.pendingCircleRadius = Math.max(1, Math.min(CIRCLE_MAX_RADIUS_M, radius))
  },
  cancelDrawingCircle() {
    draft.pendingCircleCenter = undefined
    draft.pendingCircleRadius = 0
    draft.isDrawingCircle = false
  },
})

/**
 * Access the shared geofence editor draft (interaction + in-progress draw state).
 * @returns { GeoFenceEditorDraft } The module-singleton draft state and its mutators.
 */
export const useGeoFenceEditorDraft = (): GeoFenceEditorDraft => draft
