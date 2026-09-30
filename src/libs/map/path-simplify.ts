import * as turf from '@turf/turf'
import type { Position } from 'geojson'

import type { WaypointCoordinates } from '@/types/mission'

/** Tolerance, in degrees (about 10 cm), under which a vertex adds nothing visible to a path. */
export const FINE_SIMPLIFY_TOLERANCE_DEG = 0.000001

const toPosition = ([lat, lng]: WaypointCoordinates): Position => [lng, lat]

const toLatLng = ([lng, lat]: Position): WaypointCoordinates => [lat, lng]

/**
 * Drops the vertices of a path that stray less than the tolerance from the line through their
 * neighbors (Ramer-Douglas-Peucker).
 * @param {WaypointCoordinates[]} points Path to simplify, as `[lat, lng]`.
 * @param {number} toleranceDeg Largest deviation, in degrees, a dropped vertex may have.
 * @param {boolean} closed Whether the path is a ring whose closing vertex is left implicit.
 * @returns {WaypointCoordinates[]} The kept vertices, at least three for a ring.
 */
export const simplifyPath = (
  points: WaypointCoordinates[],
  toleranceDeg = FINE_SIMPLIFY_TOLERANCE_DEG,
  closed = false
): WaypointCoordinates[] => {
  const options = { tolerance: toleranceDeg, highQuality: true }
  if (!closed) {
    if (points.length < 3) return points
    return turf.simplify(turf.lineString(points.map(toPosition)), options).geometry.coordinates.map(toLatLng)
  }
  if (points.length < 4) return points
  const ring = [...points, points[0]].map(toPosition)
  return turf
    .simplify(turf.polygon([ring]), options)
    .geometry.coordinates[0].slice(0, -1)
    .map(toLatLng)
}
