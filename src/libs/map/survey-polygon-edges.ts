import { localFrame } from '@/libs/map/local-frame'
import { degrees, norm360 } from '@/libs/utils'
import type { WaypointCoordinates } from '@/types/mission'

/** A point on screen, in pixels from the top left of the map container. */
export interface ScreenPoint {
  /** Pixels from the container's left edge. */
  x: number
  /** Pixels from the container's top edge. */
  y: number
}

const handleSelector =
  '.custom-div-icon, .edge-marker, .delete-popup, .delete-button, .fence-vertex-div-icon, .fence-edge-marker'

/**
 * Whether an event landed on one of the survey polygon's own handles rather than on the map under it.
 * @param {EventTarget | null} target - The element the event was raised on.
 * @returns {boolean} True when the element is a handle, or sits inside one.
 */
export const isOverSurveyHandle = (target: EventTarget | null): boolean =>
  !!(target as HTMLElement | null)?.closest?.(handleSelector)

/**
 * Whether an event landed on the "+" an edge carries at its midpoint.
 * @param {EventTarget | null} target - The element the event was raised on.
 * @returns {boolean} True when the element is such a marker, or sits inside one.
 */
export const isOverEdgeAddMarker = (target: EventTarget | null): boolean =>
  !!(target as HTMLElement | null)?.closest?.('.edge-marker')

const distanceToSegment = (point: ScreenPoint, start: ScreenPoint, end: ScreenPoint): number => {
  const run = { x: end.x - start.x, y: end.y - start.y }
  const lengthSquared = run.x * run.x + run.y * run.y
  const alongRun = lengthSquared === 0 ? 0 : ((point.x - start.x) * run.x + (point.y - start.y) * run.y) / lengthSquared
  const closest = Math.min(1, Math.max(0, alongRun))
  return Math.hypot(point.x - (start.x + closest * run.x), point.y - (start.y + closest * run.y))
}

/**
 * Index of the polygon edge closest to a point on screen, where edge `i` runs from vertex `i` to the one after it.
 * @param {ScreenPoint[]} vertices - The polygon's vertices, in container pixels.
 * @param {ScreenPoint} point - The point to test, in container pixels.
 * @param {number} toleranceInPixels - How far from an edge still counts as being on it.
 * @returns {number | null} The edge's index, or null when no edge is within the tolerance.
 */
export const closestPolygonEdge = (
  vertices: ScreenPoint[],
  point: ScreenPoint,
  toleranceInPixels: number
): number | null => {
  if (vertices.length < 3) return null

  let closestEdge: number | null = null
  let closestDistance = toleranceInPixels
  for (let index = 0; index < vertices.length; index++) {
    const distance = distanceToSegment(point, vertices[index], vertices[(index + 1) % vertices.length])
    if (distance <= closestDistance) {
      closestDistance = distance
      closestEdge = index
    }
  }
  return closestEdge
}

// Screen y grows downward, so a horizontal edge has a vertical normal and reads as ns-resize.
const resizeCursors = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize']

/**
 * CSS resize cursor whose arrows lie along an edge's normal, which is the axis dragging the edge moves it on.
 * @param {ScreenPoint} start - The edge's first endpoint, in container pixels.
 * @param {ScreenPoint} end - The edge's second endpoint, in container pixels.
 * @returns {string} The cursor keyword to apply to the map container.
 */
export const edgeResizeCursor = (start: ScreenPoint, end: ScreenPoint): string => {
  const normalAngle = norm360(degrees(Math.atan2(end.y - start.y, end.x - start.x)) + 90) % 180
  return resizeCursors[Math.round(normalAngle / 45) % 4]
}

/**
 * Where an edge's endpoints land after a drag: following the pointer for a free-form polygon, and sliding along
 * the edge's own normal when the shape has to keep its right angles.
 * @param {[WaypointCoordinates, WaypointCoordinates]} edge - The edge's endpoints as they were before the drag.
 * @param {[WaypointCoordinates, WaypointCoordinates]} drag - Where the pointer went down, and where it is now.
 * @param {boolean} alongNormalOnly - Whether the edge may only move perpendicular to itself.
 * @returns {[WaypointCoordinates, WaypointCoordinates]} The edge's endpoints after the drag.
 */
export const draggedEdgeEndpoints = (
  edge: [WaypointCoordinates, WaypointCoordinates],
  drag: [WaypointCoordinates, WaypointCoordinates],
  alongNormalOnly: boolean
): [WaypointCoordinates, WaypointCoordinates] => {
  const { toLocal, toCoordinates } = localFrame(edge[0])
  const run = toLocal(edge[1])
  const from = toLocal(drag[0])
  const to = toLocal(drag[1])
  const offset = { x: to.x - from.x, y: to.y - from.y }

  const length = Math.hypot(run.x, run.y)
  if (alongNormalOnly && length > 0) {
    const normal = { x: run.y / length, y: -run.x / length }
    const alongNormal = offset.x * normal.x + offset.y * normal.y
    offset.x = normal.x * alongNormal
    offset.y = normal.y * alongNormal
  }

  return [toCoordinates(offset), toCoordinates({ x: run.x + offset.x, y: run.y + offset.y })]
}
