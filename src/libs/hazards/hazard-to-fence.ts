import * as turf from '@turf/turf'
import type { Feature, LineString, Polygon, Position } from 'geojson'

import type { FenceLatLng } from '@/types/geofence'
import type { HazardArea } from '@/types/hazards'

// Escalating tolerance, in degrees. Starts below a metre so a small area keeps its shape, and
// doubles until the ring fits; twenty doublings reach a whole degree, past which nothing survives.
const FIRST_SIMPLIFY_TOLERANCE_DEG = 0.000005
const MAX_SIMPLIFY_ROUNDS = 20

/** The autopilot needs a triangle at the very least, so a budget below this cannot be honored. */
export const MIN_EXCLUSION_VERTICES = 3

const toPosition = ([lat, lng]: FenceLatLng): Position => [lng, lat]

const toFenceLatLng = ([lng, lat]: Position): FenceLatLng => [lat, lng]

// A GeoJSON ring repeats its first position at the end; a fence polygon leaves it implicit.
const closeRing = (positions: Position[]): Position[] =>
  positions.length > 0 ? [...positions, positions[0]] : positions

const openRing = (positions: Position[]): Position[] => positions.slice(0, -1)

const toleranceMeters = (toleranceDeg: number): number =>
  turf.radiansToLength(turf.degreesToRadians(toleranceDeg), 'meters')

const bufferedRing = (source: Feature<Polygon | LineString>, distanceMeters: number): Position[] | undefined => {
  const buffered = turf.buffer(source, distanceMeters, { units: 'meters' }) as Feature<Polygon> | undefined
  const ring = buffered?.geometry?.coordinates?.[0]
  return ring && ring.length >= MIN_EXCLUSION_VERTICES + 1 ? ring : undefined
}

// High quality is plain Douglas-Peucker; the fast variant's radial-distance pre-pass drops vertices
// further than the tolerance from what is left, which is the bound the clearance below rests on.
const simplifyRing = (closed: Position[], tolerance: number): Position[] =>
  openRing(
    turf.simplify(turf.polygon([closed]), { tolerance, highQuality: true, mutate: false }).geometry.coordinates[0]
  )

const fitsBudget = (open: Position[], budget: number): boolean =>
  open.length >= MIN_EXCLUSION_VERTICES && open.length <= budget

const toleranceForBudget = (closed: Position[], budget: number): number | undefined => {
  let tolerance = FIRST_SIMPLIFY_TOLERANCE_DEG
  for (let round = 0; round < MAX_SIMPLIFY_ROUNDS; round++) {
    if (fitsBudget(simplifyRing(closed, tolerance), budget)) return tolerance
    tolerance *= 2
  }
  return undefined
}

// Douglas-Peucker keeps a subset of the vertices, so each edge it keeps is a chord lying up to the
// tolerance inside the outline it replaces. Buffering by the margin plus that tolerance before
// simplifying is what leaves the clearance intact: the chords eat the headroom instead.
const coveringRing = (
  source: Feature<Polygon | LineString>,
  distanceMeters: number,
  budget: number
): Position[] | undefined => {
  const base = bufferedRing(source, distanceMeters)
  if (!base) return undefined
  if (openRing(base).length <= budget) return openRing(base)

  // The tolerance is searched against the plain margin, which costs only simplifications; the
  // grown ring is built once the ladder has an answer, and re-grown only if that misses the budget.
  let tolerance = toleranceForBudget(base, budget)
  if (tolerance === undefined) return undefined

  for (let round = 0; round < MAX_SIMPLIFY_ROUNDS; round++) {
    const grown = bufferedRing(source, distanceMeters + toleranceMeters(tolerance))
    if (!grown) return undefined
    const candidate = simplifyRing(grown, tolerance)
    if (fitsBudget(candidate, budget)) return candidate
    tolerance *= 2
  }
  return undefined
}

let selfChecked = false

/**
 * Why an area could not be turned into an exclusion ring.
 */
export type ExclusionRingFailure =
  /** Its outline is not a shape that can be buffered at all. */
  | 'degenerate'
  /** No ring that still covers it and its clearance fits the vertex budget. */
  | 'budget'

/**
 * Turns a hazard area into the vertex ring of a fence exclusion polygon: a line (a shoreline) is
 * widened into a keep-off strip of `marginMeters`, an area is grown by the same margin, and the
 * result is simplified until it fits the autopilot's vertex budget.
 *
 * Simplification moves the boundary, so the margin is applied first and the outward direction is
 * the only one taken: the returned ring covers the hazard and the whole clearance around it.
 * @param {HazardArea} area Area to convert.
 * @param {number} marginMeters Clearance to keep from the hazard, in meters.
 * @param {number} vertexBudget Largest number of vertices the returned ring may have.
 * @returns {FenceLatLng[] | ExclusionRingFailure} The exclusion ring, or why none could be built.
 */
export const hazardAreaToExclusionRing = (
  area: HazardArea,
  marginMeters: number,
  vertexBudget: number
): FenceLatLng[] | ExclusionRingFailure => {
  runSelfCheckOnce()

  const positions = area.coordinates.map(toPosition)
  if (positions.length < 2) return 'degenerate'

  const source =
    area.kind === 'polygon' && positions.length >= MIN_EXCLUSION_VERTICES
      ? turf.polygon([closeRing(positions)])
      : turf.lineString(positions)

  // A zero-width buffer of a line has no area at all, so a line always gets at least a metre.
  const distance = area.kind === 'line' ? Math.max(1, marginMeters) : marginMeters
  const budget = Math.max(MIN_EXCLUSION_VERTICES, Math.floor(vertexBudget))
  const ring = coveringRing(source, distance, budget)
  if (!ring) return bufferedRing(source, distance) ? 'budget' : 'degenerate'
  return ring.map(toFenceLatLng)
}

// Runs once, on the first real conversion of a development session. Deliberately not at import
// time: the global `assert` is installed during bootstrap and may not exist yet here.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  // A circle is the worst case for the budget: buffering emits a vertex every few degrees, and
  // simplification has no long straight runs to collapse.
  const circle: HazardArea = {
    id: 'self-check',
    sourceId: 'restricted-waters',
    kind: 'polygon',
    label: 'Circle',
    coordinates: turf
      .circle([0, 0], 1, { units: 'kilometers', steps: 256 })
      .geometry.coordinates[0].slice(0, -1)
      .map(toFenceLatLng),
  }
  const ring = hazardAreaToExclusionRing(circle, 50, 20)
  assert(Array.isArray(ring), 'A well-formed area must convert into an exclusion ring')
  assert((ring as FenceLatLng[]).length <= 20, 'A converted ring must fit the vertex budget')
  assert((ring as FenceLatLng[]).length >= MIN_EXCLUSION_VERTICES, 'A converted ring must still be a polygon')
  assert(
    turf.booleanContains(
      turf.polygon([closeRing((ring as FenceLatLng[]).map(toPosition))]),
      turf.polygon([closeRing(circle.coordinates.map(toPosition))])
    ),
    'A simplified exclusion ring must still cover the hazard it was simplified from'
  )

  const shoreline: HazardArea = {
    id: 'self-check',
    sourceId: 'coastline',
    kind: 'line',
    label: 'Shoreline',
    coordinates: [
      [0, 0],
      [0, 0.01],
    ],
  }
  const strip = hazardAreaToExclusionRing(shoreline, 100, 40)
  assert(Array.isArray(strip) && strip.length >= MIN_EXCLUSION_VERTICES, 'A line must buffer into a closed strip')
  assert(
    turf.booleanPointInPolygon(
      turf.point([0.005, 0]),
      turf.polygon([closeRing((strip as FenceLatLng[]).map(toPosition))])
    ),
    'The strip must contain the shoreline it was buffered from'
  )
}
