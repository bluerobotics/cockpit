import { localFrame } from '@/libs/map/local-frame'
import { degrees, norm360 } from '@/libs/utils'
import type { WaypointCoordinates } from '@/types/mission'

/** A rectangle described by the edge the user drew plus its extent perpendicular to that edge. */
export interface SurveyRectangleSpec {
  /** Corner the drawn baseline starts at. */
  origin: WaypointCoordinates
  /** Bearing of the baseline, in degrees clockwise from north. */
  bearing: number
  /** Extent along the baseline, in meters. */
  length: number
  /** Extent perpendicular to the baseline, in meters. */
  width: number
}

// A quad counts as a rectangle while every corner is within this many degrees of square and opposite sides
// match within this fraction of their length, which absorbs coordinate rounding without accepting a polygon
// the user has visibly dragged out of shape.
const squareCornerToleranceDeg = 0.1
const oppositeSideTolerance = 0.001

/**
 * Recovers the spec of a rectangular polygon, so a rectangle's dimensions can be read back from its corners
 * instead of being stored alongside them.
 * @param {WaypointCoordinates[]} corners - The polygon's vertices, as an open ring.
 * @returns {SurveyRectangleSpec | null} The spec, or null when the polygon is not a rectangle.
 */
export const rectangleSpec = (corners: WaypointCoordinates[]): SurveyRectangleSpec | null => {
  if (corners.length !== 4) return null

  const { toLocal } = localFrame(corners[0])
  const points = corners.map(toLocal)
  const edges = points.map((point, index) => ({
    x: points[(index + 1) % 4].x - point.x,
    y: points[(index + 1) % 4].y - point.y,
  }))
  const lengths = edges.map((edge) => Math.hypot(edge.x, edge.y))
  if (lengths.some((length) => length === 0)) return null

  const opposedSidesMatch = [
    [lengths[0], lengths[2]],
    [lengths[1], lengths[3]],
  ].every(([first, second]) => Math.abs(first - second) <= oppositeSideTolerance * Math.max(first, second))
  if (!opposedSidesMatch) return null

  const cornersAreSquare = edges.every((edge, index) => {
    const next = edges[(index + 1) % 4]
    const cosine = (edge.x * next.x + edge.y * next.y) / (lengths[index] * lengths[(index + 1) % 4])
    return Math.abs(degrees(Math.acos(Math.min(1, Math.max(-1, cosine)))) - 90) <= squareCornerToleranceDeg
  })
  if (!cornersAreSquare) return null

  return {
    origin: corners[0],
    bearing: norm360(degrees(Math.atan2(edges[0].x, edges[0].y))),
    length: lengths[0],
    width: lengths[1],
  }
}
