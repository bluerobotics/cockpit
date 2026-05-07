import type { WaypointCoordinates } from '@/types/mission'

/**
 * Geographical coordinates in the format [latitude, longitude].
 */
export type FenceLatLng = WaypointCoordinates

/**
 * A polygon-shaped geofence. May be inclusion (vehicle must stay inside)
 * or exclusion (vehicle must stay outside).
 */
export interface FencePolygon {
  /**
   * Unique identification for the polygon.
   */
  id: string
  /**
   * If true, the vehicle is restricted to the inside of the polygon.
   * If false, the vehicle is restricted to the outside of the polygon.
   */
  inclusion: boolean
  /**
   * Ordered list of polygon vertices. Polygons are 2D — altitude limits are
   * enforced via vehicle parameters (FENCE_ALT_MAX/MIN, GF_MAX_VER_DIST).
   */
  vertices: FenceLatLng[]
}

/**
 * A circle-shaped geofence. May be inclusion (vehicle must stay inside)
 * or exclusion (vehicle must stay outside).
 */
export interface FenceCircle {
  /**
   * Unique identification for the circle.
   */
  id: string
  /**
   * If true, the vehicle is restricted to the inside of the circle.
   * If false, the vehicle is restricted to the outside of the circle.
   */
  inclusion: boolean
  /**
   * Geographical coordinates of the circle center.
   */
  center: FenceLatLng
  /**
   * Radius of the circle in meters.
   */
  radius: number
}

/**
 * Optional point the vehicle should return to when the geofence is breached.
 * Stored separately from polygons/circles. On ArduPilot Plane this can be
 * overridden by rally points when FENCE_RET_RALLY = 1. Not honored by PX4.
 */
export interface BreachReturnPoint {
  /**
   * Geographical coordinates of the breach return point.
   */
  coordinates: FenceLatLng
  /**
   * Altitude (meters, relative to home) the vehicle should fly to.
   */
  altitude: number
}

/**
 * Complete geofence plan as used at runtime in Cockpit. Schema mirrors the
 * de-facto MAVLink-ecosystem `.plan` `geoFence` block (version 2) so files
 * can round-trip with other ground stations. Polygons store vertices as
 * `[lat, lon]`; circles store `{ center: [lat, lon], radius }`;
 * `breachReturn` is the structured `BreachReturnPoint` (separate
 * `coordinates` and `altitude`).
 */
export interface GeoFencePlan {
  /**
   * Schema version. Matches the `.plan` `geoFence.version` field.
   */
  version: 2
  /**
   * Inclusion and exclusion polygons.
   */
  polygons: FencePolygon[]
  /**
   * Inclusion and exclusion circles.
   */
  circles: FenceCircle[]
  /**
   * Optional breach return point.
   */
  breachReturn?: BreachReturnPoint
}

/**
 * Validates that a parsed object conforms to the `GeoFencePlan` shape.
 * @param { unknown } maybePlan The parsed JSON to inspect.
 * @returns { boolean } True if the object is a valid `GeoFencePlan`.
 */
export const instanceOfGeoFencePlan = (maybePlan: unknown): maybePlan is GeoFencePlan => {
  if (!maybePlan || typeof maybePlan !== 'object') return false
  const p = maybePlan as Partial<GeoFencePlan>
  if (p.version !== 2) return false
  if (!Array.isArray(p.polygons)) return false
  if (!Array.isArray(p.circles)) return false
  return true
}
