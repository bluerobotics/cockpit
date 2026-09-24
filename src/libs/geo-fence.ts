import * as turf from '@turf/turf'

import type { FenceCircle, FenceLatLng, FencePolygon, GeoFencePlan } from '@/types/geofence'

export const CIRCLE_MAX_RADIUS_M = 1500

/** Bytes one polygon vertex takes in ArduPilot's fence storage. */
export const FENCE_VERTEX_BYTES = 8

/** ArduPilot keeps a polygon's vertex count in a single byte. */
export const MAX_POLYGON_VERTICES = 255

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
 * Whether a plan carries fence geometry. A breach return point on its own is
 * somewhere to go when a fence is breached, not a fence, so it does not count.
 * @param { GeoFencePlan | null | undefined } plan Plan to inspect.
 * @returns { boolean } True when the plan holds at least one polygon or circle.
 */
export const planHasShapes = (plan: GeoFencePlan | null | undefined): plan is GeoFencePlan =>
  !!plan && (plan.polygons.length > 0 || plan.circles.length > 0)

/**
 * Bytes a plan takes in ArduPilot's fence storage: a format header and an end marker, then a type and a vertex
 * count per polygon, a type and a radius per circle, a type per breach return point, and 8 bytes per location.
 * @param { GeoFencePlan } plan Plan to measure.
 * @returns { number } Storage bytes the plan needs, polygons too small to send left out.
 */
export const fenceStorageBytes = (plan: GeoFencePlan): number =>
  5 +
  plan.polygons.reduce(
    (total, polygon) => total + (polygon.vertices.length >= 3 ? 2 + polygon.vertices.length * FENCE_VERTEX_BYTES : 0),
    0
  ) +
  plan.circles.length * (5 + FENCE_VERTEX_BYTES) +
  (plan.breachReturn ? 1 + FENCE_VERTEX_BYTES : 0)

/**
 * Whether a plan has a polygon with more vertices than ArduPilot can store for one polygon.
 * @param { GeoFencePlan } plan Plan to check.
 * @returns { boolean } True when a polygon has more than `MAX_POLYGON_VERTICES` vertices.
 */
export const exceedsPolygonVertexLimit = (plan: GeoFencePlan): boolean =>
  plan.polygons.some((polygon) => polygon.vertices.length > MAX_POLYGON_VERTICES)

/**
 * Rough number of fence points a storage size holds, leaving out the few bytes each shape adds.
 * @param { number } capacityBytes Fence storage, in bytes.
 * @returns { number } Points that storage holds.
 */
export const fencePointCapacity = (capacityBytes: number): number => Math.floor(capacityBytes / FENCE_VERTEX_BYTES)

/**
 * Tests whether a `[lat, lng]` point lies inside the polygon defined by the
 * given vertex ring. Vertices are given in `[lat, lng]` order, the ring is
 * implicitly closed, and the check uses turf's well-tested
 * `booleanPointInPolygon` (ray casting).
 * @param { FenceLatLng } point The `[lat, lng]` point to test.
 * @param { FenceLatLng[] } vertices Polygon vertices `[lat, lng]`, open ring.
 * @returns { boolean } True if the point is inside the polygon.
 */
const isPointInsidePolygon = (point: FenceLatLng, vertices: FenceLatLng[]): boolean => {
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
const distanceMeters = (a: FenceLatLng, b: FenceLatLng): number => {
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
    return { hasBreaches: false, breachedIndices: [], totalChecked: waypoints.length }
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
  }
}
