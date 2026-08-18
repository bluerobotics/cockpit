import * as turf from '@turf/turf'

import type { FenceCircle, FenceLatLng, FencePolygon, GeoFencePlan } from '@/types/geofence'

export const POLYGON_DEFAULT_HALF_SIDE_M = 100
export const POLYGON_MAX_HALF_SIDE_M = 1500
export const CIRCLE_DEFAULT_RADIUS_M = 100
export const CIRCLE_MAX_RADIUS_M = 1500

const EARTH_RADIUS_M = 6378137

/**
 * Minimal shape required by `detectMissionBreaches`. Accepts both Cockpit's
 * `Waypoint` and any caller-supplied object that exposes `[lat, lng]`
 * coordinates, so the breach check stays decoupled from the mission types.
 */
export type WaypointLike = {
  /**
   * Geographic location of the waypoint as `[latitude, longitude]` in degrees.
   */
  coordinates: [number, number]
}

/**
 * Result of a `detectMissionBreaches` call.
 */
export type MissionBreachReport = {
  /**
   * True when at least one waypoint breaches the active fence.
   */
  hasBreaches: boolean
  /**
   * Indices (within the input waypoint list) of every breaching waypoint.
   */
  breachedIndices: number[]
  /**
   * Total number of waypoints inspected.
   */
  totalChecked: number
  /**
   * False when no fence plan was available to check against; callers can use
   * this to differentiate "no breaches" from "no fence to check".
   */
  hadPlan: boolean
}

/**
 * Deep-copies a vertex ring so mutations on the copy don't alias the source.
 * @param { FenceLatLng[] } vertices Vertices to clone.
 * @returns { FenceLatLng[] } A fresh array of fresh `[lat, lng]` tuples.
 */
export const cloneVertices = (vertices: FenceLatLng[]): FenceLatLng[] => vertices.map(([lat, lng]) => [lat, lng])

/**
 * Deep-copies a geofence plan via JSON round-trip.
 * @param { GeoFencePlan } plan Plan to clone.
 * @returns { GeoFencePlan } A structurally independent copy.
 */
export const clonePlan = (plan: GeoFencePlan): GeoFencePlan => JSON.parse(JSON.stringify(plan)) as GeoFencePlan

/**
 * Creates an empty geofence plan.
 * @returns { GeoFencePlan } An empty plan with no polygons, circles, or breach return.
 */
export const emptyGeoFencePlan = (): GeoFencePlan => ({ version: 2, polygons: [], circles: [] })

/**
 * Computes the offset (in degrees) needed to move a point on the WGS84
 * spheroid by `dxMeters` east and `dyMeters` north. Used to seed default
 * polygon and circle sizes around a given anchor.
 * @param { FenceLatLng } anchor The anchor point `[lat, lng]`.
 * @param { number } dxMeters Offset east in meters.
 * @param { number } dyMeters Offset north in meters.
 * @returns { FenceLatLng } The offset coordinates.
 */
export const offsetCoordinates = (anchor: FenceLatLng, dxMeters: number, dyMeters: number): FenceLatLng => {
  const [lat, lng] = anchor
  const dLat = (dyMeters / EARTH_RADIUS_M) * (180 / Math.PI)
  const dLng = ((dxMeters / EARTH_RADIUS_M) * (180 / Math.PI)) / Math.cos((lat * Math.PI) / 180)
  return [lat + dLat, lng + dLng]
}

/**
 * Tests whether a `[lat, lng]` point lies inside the polygon defined by the
 * given vertex ring. Vertices are given in `[lat, lng]` order, the ring is
 * implicitly closed, and the check uses turf's well-tested
 * `booleanPointInPolygon` (ray casting).
 * @param { FenceLatLng } point The `[lat, lng]` point to test.
 * @param { FenceLatLng[] } vertices Polygon vertices `[lat, lng]`, open ring.
 * @returns { boolean } True if the point is inside the polygon.
 */
export const isPointInsidePolygon = (point: FenceLatLng, vertices: FenceLatLng[]): boolean => {
  if (vertices.length < 3) return false
  const closed = [...vertices, vertices[0]]
  const turfPoly = turf.polygon([closed.map(([lat, lng]) => [lng, lat])])
  const turfPoint = turf.point([point[1], point[0]])
  return turf.booleanPointInPolygon(turfPoint, turfPoly)
}

/**
 * Great-circle distance in meters between two `[lat, lng]` points using
 * turf's haversine implementation.
 * @param { FenceLatLng } a First `[lat, lng]` point.
 * @param { FenceLatLng } b Second `[lat, lng]` point.
 * @returns { number } Distance between the two points in meters.
 */
export const distanceMeters = (a: FenceLatLng, b: FenceLatLng): number => {
  return turf.distance(turf.point([a[1], a[0]]), turf.point([b[1], b[0]]), { units: 'meters' })
}

/**
 * Checks a list of waypoints against a set of fence shapes. A waypoint is
 * flagged when it sits outside every inclusion shape (and at least one
 * inclusion shape exists) or inside any exclusion shape.
 * @param { WaypointLike[] } waypoints Waypoints to test.
 * @param { FencePolygon[] } polygons Polygons to test against.
 * @param { FenceCircle[] } circles Circles to test against.
 * @returns { MissionBreachReport } Breach summary with offending indices.
 */
export const detectMissionBreaches = (
  waypoints: WaypointLike[],
  polygons: FencePolygon[],
  circles: FenceCircle[]
): MissionBreachReport => {
  if (polygons.length === 0 && circles.length === 0) {
    return { hasBreaches: false, breachedIndices: [], totalChecked: waypoints.length, hadPlan: false }
  }

  const inclusionPolygons = polygons.filter((p) => p.inclusion)
  const exclusionPolygons = polygons.filter((p) => !p.inclusion)
  const inclusionCircles = circles.filter((c) => c.inclusion)
  const exclusionCircles = circles.filter((c) => !c.inclusion)
  const hasInclusion = inclusionPolygons.length > 0 || inclusionCircles.length > 0

  const breachedIndices: number[] = []
  waypoints.forEach((wp, index) => {
    const point: FenceLatLng = [wp.coordinates[0], wp.coordinates[1]]
    const insideAnyInclusion =
      !hasInclusion ||
      inclusionPolygons.some((p) => isPointInsidePolygon(point, p.vertices)) ||
      inclusionCircles.some((c) => distanceMeters(point, c.center) <= c.radius)
    const insideAnyExclusion =
      exclusionPolygons.some((p) => isPointInsidePolygon(point, p.vertices)) ||
      exclusionCircles.some((c) => distanceMeters(point, c.center) <= c.radius)
    if (!insideAnyInclusion || insideAnyExclusion) breachedIndices.push(index)
  })

  return {
    hasBreaches: breachedIndices.length > 0,
    breachedIndices,
    totalChecked: waypoints.length,
    hadPlan: true,
  }
}
