import { localFrame } from '@/libs/map/local-frame'
import { calculateHaversineDistance } from '@/libs/mission/general-estimates'
import { degrees, norm360, radians } from '@/libs/utils'
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
 * Corners of the rectangle a spec describes, walking the baseline and then the perpendicular extent.
 * @param {SurveyRectangleSpec} spec - The baseline and the extents to build the rectangle from.
 * @returns {WaypointCoordinates[]} The four corners, starting at the spec's origin.
 */
export const rectangleCorners = (spec: SurveyRectangleSpec): WaypointCoordinates[] => {
  const { origin, bearing, length, width } = spec
  const { toCoordinates } = localFrame(origin)

  const along = { x: Math.sin(radians(bearing)), y: Math.cos(radians(bearing)) }
  const across = { x: along.y, y: -along.x }

  return [
    origin,
    toCoordinates({ x: along.x * length, y: along.y * length }),
    toCoordinates({ x: along.x * length + across.x * width, y: along.y * length + across.y * width }),
    toCoordinates({ x: across.x * width, y: across.y * width }),
  ]
}

/**
 * Builds the rectangle a drawn baseline and a cursor position describe. The cursor's perpendicular offset from
 * the baseline sets the width, and the baseline is walked in whichever direction puts the rectangle on the
 * cursor's side of it.
 * @param {WaypointCoordinates} start - Where the baseline was started.
 * @param {WaypointCoordinates} end - Where the baseline was ended.
 * @param {WaypointCoordinates} cursor - The position choosing the side and the width.
 * @returns {SurveyRectangleSpec} The rectangle spanning the baseline and reaching the cursor.
 */
export const rectangleFromBaselineAndCursor = (
  start: WaypointCoordinates,
  end: WaypointCoordinates,
  cursor: WaypointCoordinates
): SurveyRectangleSpec => {
  const { toLocal } = localFrame(start)
  const baseline = toLocal(end)
  const toCursor = toLocal(cursor)

  const length = Math.hypot(baseline.x, baseline.y)
  if (length === 0) return { origin: start, bearing: 0, length: 0, width: 0 }

  // Positive when the cursor sits to the right of the baseline, which is the side rectangleCorners extends to,
  // so a cursor on the left is served by walking the baseline the other way round.
  const signedOffset = (toCursor.x * baseline.y - toCursor.y * baseline.x) / length

  return signedOffset >= 0
    ? { origin: start, bearing: norm360(degrees(Math.atan2(baseline.x, baseline.y))), length, width: signedOffset }
    : { origin: end, bearing: norm360(degrees(Math.atan2(-baseline.x, -baseline.y))), length, width: -signedOffset }
}

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

/**
 * Scan angle that runs the survey lines along a rectangle's longer axis, which is the direction that needs the
 * fewest turnarounds to cover it.
 *
 * The angle is measured in the raw lon/lat plane the survey generator sweeps its lines in, not as a geodesic
 * bearing, because the two only agree on the meridians and the equator: away from them a geodesic bearing fed
 * to the generator would tilt the lines off the axis by the plane's `cos(latitude)` skew.
 * @param {WaypointCoordinates[]} corners - The rectangle's corners, as returned by {@link rectangleCorners}.
 * @returns {number} The scan angle to hand the survey generator, in degrees from 0 to 359.
 */
export const rectangleLinesAngle = (corners: WaypointCoordinates[]): number => {
  if (corners.length < 3) return 0

  const lengthAxis: [WaypointCoordinates, WaypointCoordinates] = [corners[0], corners[1]]
  const widthAxis: [WaypointCoordinates, WaypointCoordinates] = [corners[1], corners[2]]
  const longerAxis =
    calculateHaversineDistance(...widthAxis) > calculateHaversineDistance(...lengthAxis) ? widthAxis : lengthAxis

  const [from, to] = longerAxis
  return norm360(degrees(Math.atan2(to[1] - from[1], to[0] - from[0])))
}
