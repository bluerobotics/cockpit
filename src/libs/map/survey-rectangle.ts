import { localFrame } from '@/libs/map/local-frame'
import { degrees } from '@/libs/utils'
import type { WaypointCoordinates } from '@/types/mission'

// A quad counts as a rectangle while every corner is within this many degrees of square and opposite sides
// match within this fraction of their length, which absorbs coordinate rounding without accepting a polygon
// the user has visibly dragged out of shape.
const squareCornerToleranceDeg = 0.1
const oppositeSideTolerance = 0.001

/**
 * Whether a polygon is a rectangle, which is what decides if reshaping it has to keep its corners square.
 * @param {WaypointCoordinates[]} corners - The polygon's vertices, as an open ring.
 * @returns {boolean} True when the polygon has four corners, square within tolerance, with matching opposite sides.
 */
export const isRectangle = (corners: WaypointCoordinates[]): boolean => {
  if (corners.length !== 4) return false

  const { toLocal } = localFrame(corners[0])
  const points = corners.map(toLocal)
  const edges = points.map((point, index) => ({
    x: points[(index + 1) % 4].x - point.x,
    y: points[(index + 1) % 4].y - point.y,
  }))
  const lengths = edges.map((edge) => Math.hypot(edge.x, edge.y))
  if (lengths.some((length) => length === 0)) return false

  const opposedSidesMatch = [
    [lengths[0], lengths[2]],
    [lengths[1], lengths[3]],
  ].every(([first, second]) => Math.abs(first - second) <= oppositeSideTolerance * Math.max(first, second))
  if (!opposedSidesMatch) return false

  return edges.every((edge, index) => {
    const next = edges[(index + 1) % 4]
    const cosine = (edge.x * next.x + edge.y * next.y) / (lengths[index] * lengths[(index + 1) % 4])
    return Math.abs(degrees(Math.acos(Math.min(1, Math.max(-1, cosine)))) - 90) <= squareCornerToleranceDeg
  })
}
