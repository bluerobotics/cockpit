import * as turf from '@turf/turf'

import { FINE_SIMPLIFY_TOLERANCE_DEG, simplifyPath } from '@/libs/map/path-simplify'
import type { FenceCircle, FenceLatLng, FencePolygon, GeoFencePlan } from '@/types/geofence'

export const CIRCLE_MAX_RADIUS_M = 1500

/** Bytes one polygon vertex takes in ArduPilot's fence storage. */
export const FENCE_VERTEX_BYTES = 8

/** ArduPilot keeps a polygon's vertex count in a single byte. */
export const MAX_POLYGON_VERTICES = 255

// Doubling from the finest tolerance, this many rounds reach several degrees, past which no fence survives.
const MAX_COARSEN_ROUNDS = 24

// Halving the tolerance's doubling step this many times lands within a fraction of a percent of the finest fit.
const REFINE_STEPS = 12

let selfChecked = false

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
 * Number of items a plan takes on the vehicle: one per polygon vertex, circle and breach return point.
 * @param { GeoFencePlan } plan Plan to count.
 * @returns { number } Items the upload sends, polygons too small to send left out.
 */
export const fenceItemCount = (plan: GeoFencePlan): number =>
  plan.polygons.reduce((total, polygon) => total + (polygon.vertices.length >= 3 ? polygon.vertices.length : 0), 0) +
  plan.circles.length +
  (plan.breachReturn ? 1 : 0)

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
 * Simplifies every polygon of a plan with the same Ramer-Douglas-Peucker pass the vehicle history path uses.
 * @param { GeoFencePlan } plan Plan to simplify.
 * @param { number } toleranceDeg Largest distance, in degrees, a dropped vertex may lie from the new outline.
 * @returns { GeoFencePlan } A copy of the plan with simplified polygons.
 */
export const simplifyFencePolygons = (
  plan: GeoFencePlan,
  toleranceDeg = FINE_SIMPLIFY_TOLERANCE_DEG
): GeoFencePlan => ({
  ...plan,
  polygons: plan.polygons.map((polygon) => ({
    ...polygon,
    vertices: simplifyPath(polygon.vertices, toleranceDeg, true),
  })),
})

/**
 * Simplifies a plan the vehicle had no room for into the most detailed one that fits the vehicle's
 * room or, when it already fits that and was refused anyway, half its own size. All polygons share
 * one tolerance, so detail is lost evenly rather than from one shape.
 * @param { GeoFencePlan } plan Plan to coarsen.
 * @param { number } capacityBytes Fence storage the vehicle has room for, in bytes.
 * @returns { GeoFencePlan | undefined } The coarser plan, or `undefined` when its polygons cannot shrink that far.
 */
export const coarsenFencePlan = (plan: GeoFencePlan, capacityBytes: number): GeoFencePlan | undefined => {
  runSelfCheckOnce()
  const bytes = fenceStorageBytes(plan)
  // Halving is only for a plan that broke neither limit, which the vehicle refused for a reason
  // Cockpit cannot see; one that is merely over the per-polygon limit still has all its room.
  const overALimit = bytes > capacityBytes || exceedsPolygonVertexLimit(plan)
  const budget = overALimit ? capacityBytes : bytes / 2
  const fits = (candidate: GeoFencePlan): boolean =>
    fenceStorageBytes(candidate) <= budget && !exceedsPolygonVertexLimit(candidate)

  let tooFine = FINE_SIMPLIFY_TOLERANCE_DEG
  let coarse = tooFine
  let fitting: GeoFencePlan | undefined
  for (let round = 0; round < MAX_COARSEN_ROUNDS && !fitting; round++) {
    coarse *= 2
    const candidate = simplifyFencePolygons(plan, coarse)
    if (fits(candidate)) fitting = candidate
    else tooFine = coarse
  }
  if (!fitting) return undefined

  // Doubling overshoots the room, so the tolerance is narrowed back to the finest one that still fits.
  for (let step = 0; step < REFINE_STEPS; step++) {
    const middle = Math.sqrt(tooFine * coarse)
    const candidate = simplifyFencePolygons(plan, middle)
    if (fits(candidate)) {
      fitting = candidate
      coarse = middle
    } else {
      tooFine = middle
    }
  }
  return fitting
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

// Runs once, on the first coarsening of a development session, after bootstrap has installed `assert`.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  const square: FencePolygon = {
    id: 'self-check',
    inclusion: true,
    vertices: [
      [0, 0],
      [0, 0.005],
      [0, 0.01],
      [0.01, 0.01],
      [0.01, 0],
    ],
  }
  const fine = simplifyFencePolygons({ version: 2, polygons: [square], circles: [] })
  assert(fenceItemCount(fine) === 4, 'The fine pass must drop a vertex lying on a straight edge')
  const mixed: GeoFencePlan = {
    version: 2,
    polygons: fine.polygons,
    circles: [{ id: 'self-check', inclusion: false, center: [0, 0], radius: 10 }],
    breachReturn: { coordinates: [0, 0], altitude: 10 },
  }
  assert(fenceStorageBytes(mixed) === 5 + 34 + 13 + 9, 'Storage bytes must match ArduPilot fence encoding')

  const circle: FencePolygon = {
    id: 'self-check',
    inclusion: false,
    vertices: turf
      .circle([0, 0], 1, { units: 'kilometers', steps: 256 })
      .geometry.coordinates[0].slice(0, -1)
      .map(([lng, lat]) => [lat, lng]),
  }
  const plan: GeoFencePlan = { version: 2, polygons: [circle], circles: [] }
  const capacity = 200 * FENCE_VERTEX_BYTES
  const coarser = coarsenFencePlan(plan, capacity)
  assert(coarser !== undefined, 'A dense circle must coarsen into a plan')
  const bytes = fenceStorageBytes(coarser as GeoFencePlan)
  const fitsRoom = bytes <= capacity && fenceItemCount(coarser as GeoFencePlan) >= 3
  assert(fitsRoom, 'A coarsened plan must fit the room and stay a polygon')
  const again = coarsenFencePlan(coarser as GeoFencePlan, capacity)
  assert(again !== undefined && fenceStorageBytes(again) <= bytes / 2, 'A plan that already fits must halve')
  const huge = coarsenFencePlan(plan, 0xffff)
  const cappedNotHalved =
    huge !== undefined && !exceedsPolygonVertexLimit(huge) && fenceItemCount(huge) > fenceItemCount(plan) / 3
  assert(cappedNotHalved, 'A roomy vehicle caps vertices per polygon without halving the fence')

  // A coastline-like outline, whose vertices each stand out by a different amount.
  const jagged: FencePolygon = {
    id: 'self-check',
    inclusion: false,
    vertices: Array.from({ length: 120 }, (_, index) => {
      const angle = (index / 120) * 2 * Math.PI
      const radius = 0.01 * (1 + 0.15 * Math.sin(7 * angle) + 0.05 * Math.sin(23 * angle + 1))
      return [radius * Math.sin(angle), radius * Math.cos(angle)] as FenceLatLng
    }),
  }
  const snug = coarsenFencePlan({ version: 2, polygons: [jagged], circles: [] }, 84 * FENCE_VERTEX_BYTES)
  assert(snug !== undefined && fenceItemCount(snug) >= 80, 'A coarsened plan must keep nearly as many points as fit')
}
