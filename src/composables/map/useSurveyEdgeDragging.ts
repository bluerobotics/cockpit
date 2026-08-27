import L, { type Map as LeafletMap } from 'leaflet'
import { type Ref, onBeforeUnmount, ref } from 'vue'

import {
  closestPolygonEdge,
  draggedEdgeEndpoints,
  edgeResizeCursor,
  isOverEdgeAddMarker,
  isOverSurveyHandle,
} from '@/libs/map/survey-polygon-edges'
import { rectangleSpec } from '@/libs/map/survey-rectangle'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * Options for {@link useSurveyEdgeDragging}.
 */
export interface UseSurveyEdgeDraggingOptions {
  /** The draft polygon's vertices, in the order they are drawn. */
  vertices: Ref<L.LatLng[]>
  /** Whether the polygon can be edited right now. */
  isEditable: () => boolean
  /** Called once per drag, before the first move, so the polygon can be snapshotted for undo. */
  onDragStart: () => void
  /** Called on every move, with the polygon's vertices as the dragged edge has left them. */
  onEdgeMoved: (vertices: WaypointCoordinates[]) => void
  /** Called when the press is released, saying whether the edge ended up moving. */
  onDragEnd: (moved: boolean) => void
}

/**
 * Return type of {@link useSurveyEdgeDragging}.
 */
export interface UseSurveyEdgeDraggingReturn {
  /** Whether a press landed on an edge, so handlers on the polygon itself can stand down. */
  isEdgePressed: Ref<boolean>
  /** Whether an edge is being dragged. */
  isDraggingEdge: Ref<boolean>
  /** Binds the edge handling to a Leaflet map. */
  initEdgeDragging: (map: LeafletMap) => void
  /** Unbinds everything and gives the cursor back. */
  destroyEdgeDragging: () => void
}

// The band around an edge that grabs it, wide enough for a fingertip without reaching the vertex handles.
const grabToleranceInPixels = 10
// A press has to travel this far before it counts as a drag, so a click near an edge still reaches the map and
// adds a vertex while the polygon is being drawn.
const dragThresholdInPixels = 4

/**
 * Lets the survey polygon be reshaped by its edges: hovering one offers a resize cursor along the axis it moves
 * on, and pressing and dragging it carries the edge with the pointer. A rectangle's edge is held to its own
 * normal, since its dimensions are read back from its corners and only survive while they stay square.
 *
 * Pointer events drive this rather than Leaflet's mouse events because a touch drag never produces a
 * `mousemove`, which is what limits the polygon's own drag to a mouse.
 * @param {UseSurveyEdgeDraggingOptions} options - The polygon to edit and the callbacks to report edits through.
 * @returns {UseSurveyEdgeDraggingReturn} Drag state plus the methods to bind and unbind the map.
 */
export const useSurveyEdgeDragging = (options: UseSurveyEdgeDraggingOptions): UseSurveyEdgeDraggingReturn => {
  const { vertices, isEditable, onDragStart, onEdgeMoved, onDragEnd } = options

  const isEdgePressed = ref(false)
  const isDraggingEdge = ref(false)

  let mapRef: LeafletMap | undefined
  let pressedEdge: number | null = null
  let pressOrigin: L.Point | null = null
  let pressedEdgeEndpoints: [WaypointCoordinates, WaypointCoordinates] | null = null
  let dragOrigin: WaypointCoordinates | null = null
  let holdEdgeSquare = false
  let panningWasEnabled = false
  let cursorBeforeHover: string | null = null

  const asCoordinates = (latLng: L.LatLng): WaypointCoordinates => [latLng.lat, latLng.lng]

  const setCursor = (cursor: string | null): void => {
    const container = mapRef?.getContainer()
    if (!container) return

    if (cursor === null) {
      if (cursorBeforeHover === null) return
      container.style.cursor = cursorBeforeHover
      cursorBeforeHover = null
      return
    }
    // Compared against the element rather than a cached value, so the cursor is also reclaimed after the view's
    // own mousedown handler has swapped in its grabbing cursor.
    if (container.style.cursor === cursor) return
    if (cursorBeforeHover === null) cursorBeforeHover = container.style.cursor
    container.style.cursor = cursor
  }

  const edgeAt = (event: PointerEvent): number | null => {
    if (!mapRef || !isEditable()) return null
    // A finger has no hover to find an edge with, so the "+" standing on the edge's midpoint doubles as its grab
    // handle: a tap on it still adds a vertex there, and a drag carries the edge.
    const grabsByAddMarker = event.pointerType !== 'mouse' && isOverEdgeAddMarker(event.target)
    if (isOverSurveyHandle(event.target) && !grabsByAddMarker) return null

    const points = vertices.value.map((latLng) => mapRef!.latLngToContainerPoint(latLng))
    return closestPolygonEdge(points, mapRef.mouseEventToContainerPoint(event), grabToleranceInPixels)
  }

  const cursorForEdge = (edgeIndex: number): string => {
    const points = vertices.value
    const start = mapRef!.latLngToContainerPoint(points[edgeIndex])
    const end = mapRef!.latLngToContainerPoint(points[(edgeIndex + 1) % points.length])
    return edgeResizeCursor(start, end)
  }

  const releasePress = (): void => {
    if (pressedEdge === null) return

    if (panningWasEnabled) mapRef?.dragging.enable()
    pressedEdge = null
    pressOrigin = null
    pressedEdgeEndpoints = null
    dragOrigin = null
    isEdgePressed.value = false
    isDraggingEdge.value = false
  }

  const onPointerDown = (event: PointerEvent): void => {
    const isSecondaryPress = !event.isPrimary || pressedEdge !== null
    if (!mapRef || isSecondaryPress || (event.pointerType === 'mouse' && event.button !== 0)) return

    const edgeIndex = edgeAt(event)
    if (edgeIndex === null) return

    const points = vertices.value
    pressedEdge = edgeIndex
    pressOrigin = mapRef.mouseEventToContainerPoint(event)
    pressedEdgeEndpoints = [asCoordinates(points[edgeIndex]), asCoordinates(points[(edgeIndex + 1) % points.length])]
    dragOrigin = asCoordinates(mapRef.containerPointToLatLng(mapRef.mouseEventToContainerPoint(event)))
    // Decided once per drag, so a free-form polygon dragged through squareness does not suddenly lock up.
    holdEdgeSquare = rectangleSpec(points.map(asCoordinates)) !== null
    isEdgePressed.value = true

    // Panning must not follow the same press, and on touch there is nothing else keeping the map still.
    panningWasEnabled = mapRef.dragging.enabled()
    if (panningWasEnabled) mapRef.dragging.disable()
    mapRef.getContainer().setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (pressedEdge === null) {
      const edgeIndex = edgeAt(event)
      setCursor(edgeIndex === null ? null : cursorForEdge(edgeIndex))
      return
    }
    if (!mapRef || !pressOrigin || !pressedEdgeEndpoints || !dragOrigin) return

    const containerPoint = mapRef.mouseEventToContainerPoint(event)
    if (!isDraggingEdge.value) {
      if (containerPoint.distanceTo(pressOrigin) < dragThresholdInPixels) return
      isDraggingEdge.value = true
      setCursor(cursorForEdge(pressedEdge))
      onDragStart()
      logUserAction('Dragged a survey polygon edge')
    }

    const moved = vertices.value.map(asCoordinates)
    if (moved.length < 3) return

    const pointer = asCoordinates(mapRef.containerPointToLatLng(containerPoint))
    const [start, end] = draggedEdgeEndpoints(pressedEdgeEndpoints, [dragOrigin, pointer], holdEdgeSquare)
    moved[pressedEdge] = start
    moved[(pressedEdge + 1) % moved.length] = end
    onEdgeMoved(moved)
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (pressedEdge === null) return

    const moved = isDraggingEdge.value
    const container = mapRef?.getContainer()
    if (container?.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId)
    releasePress()
    onDragEnd(moved)
  }

  const onPointerLeave = (): void => {
    if (pressedEdge === null) setCursor(null)
  }

  const initEdgeDragging = (map: LeafletMap): void => {
    mapRef = map
    const container = map.getContainer()
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointercancel', onPointerUp)
    container.addEventListener('pointerleave', onPointerLeave)
  }

  const destroyEdgeDragging = (): void => {
    const container = mapRef?.getContainer()
    setCursor(null)
    releasePress()
    if (container) {
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', onPointerUp)
      container.removeEventListener('pointerleave', onPointerLeave)
    }
    mapRef = undefined
  }

  onBeforeUnmount(destroyEdgeDragging)

  return { isEdgePressed, isDraggingEdge, initEdgeDragging, destroyEdgeDragging }
}
