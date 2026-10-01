import type { Position } from 'geojson'

import type { GeoBbox } from '@/types/general'
import type { HazardArea } from '@/types/hazards'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * Overpass answers a whole-country query as happily as a harbour-sized one, and the result is
 * unusable either way, so requests wider than this are refused before they are sent.
 */
export const MAX_HAZARD_BBOX_DEG = 1

const METERS_PER_LAT_DEGREE = 111320

// Degrees of longitude shrink towards the poles; clamped so a near-polar area does not expand into
// a band that swallows the whole mission.
const lngDegreesFor = (meters: number, lat: number): number =>
  meters / (METERS_PER_LAT_DEGREE * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))

/**
 * Longest edge of a bounding box, in degrees. Longitude is not scaled by latitude, which
 * overestimates the real width away from the equator and therefore errs toward refusing a query.
 * @param {GeoBbox} bbox Box to measure.
 * @returns {number} The larger of the box's latitude and longitude spans, in degrees.
 */
export const bboxMaxSpanDegrees = (bbox: GeoBbox): number => Math.max(bbox.north - bbox.south, bbox.east - bbox.west)

/**
 * Whether a point falls inside a bounding box, edges included.
 * @param {GeoBbox} bbox Box to test against.
 * @param {WaypointCoordinates} point `[latitude, longitude]` to test.
 * @returns {boolean} True when the point is inside the box.
 */
export const bboxContains = (bbox: GeoBbox, [lat, lng]: WaypointCoordinates): boolean =>
  lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east

/**
 * A polygon area's rings as GeoJSON expects them: closed, `[longitude, latitude]`, outline first, then its holes.
 * @param {HazardArea} area Polygon area to convert.
 * @returns {Position[][]} The closed rings.
 */
export const polygonRings = (area: HazardArea): Position[][] =>
  [area.coordinates, ...(area.holes ?? [])].map((ring) => [...ring, ring[0]].map(([lat, lng]) => [lng, lat]))

/**
 * Smallest box enclosing a set of points, grown by a margin on every side.
 * @param {WaypointCoordinates[]} coordinates Points to enclose, at least one.
 * @param {number} marginM Margin added on every side, in meters.
 * @returns {GeoBbox} The padded box.
 */
export const paddedBbox = (coordinates: WaypointCoordinates[], marginM: number): GeoBbox => {
  const lats = coordinates.map(([lat]) => lat)
  const lngs = coordinates.map(([, lng]) => lng)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  const latMargin = marginM / METERS_PER_LAT_DEGREE
  const lngMargin = lngDegreesFor(marginM, Math.max(Math.abs(south), Math.abs(north)))
  return {
    south: south - latMargin,
    north: north + latMargin,
    west: Math.min(...lngs) - lngMargin,
    east: Math.max(...lngs) + lngMargin,
  }
}
