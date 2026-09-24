import * as turf from '@turf/turf'
import type { Feature, Polygon, Position } from 'geojson'

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

// Simplification is shape-preserving but not count-controlled, so a ring that is still too long
// after the tolerance ladder is thinned by dropping evenly spaced vertices. That distorts the
// outline, which for an exclusion is acceptable only because the result is grown back by the
// safety margin afterwards.
const decimate = (open: Position[], budget: number): Position[] => {
  const step = open.length / budget
  return Array.from({ length: budget }, (_, index) => open[Math.floor(index * step)])
}

const simplifyToBudget = (open: Position[], budget: number): Position[] => {
  if (open.length <= budget) return open

  let tolerance = FIRST_SIMPLIFY_TOLERANCE_DEG
  for (let round = 0; round < MAX_SIMPLIFY_ROUNDS; round++) {
    const simplified = turf.simplify(turf.polygon([closeRing(open)]), { tolerance, mutate: false })
    const candidate = openRing(simplified.geometry.coordinates[0])
    if (candidate.length >= MIN_EXCLUSION_VERTICES && candidate.length <= budget) return candidate
    tolerance *= 2
  }
  return decimate(open, budget)
}

let selfChecked = false

/**
 * Turns a hazard area into the vertex ring of a fence exclusion polygon: a line (a shoreline) is
 * widened into a keep-off strip of `marginMeters`, an area is grown by the same margin, and the
 * result is simplified until it fits the autopilot's vertex budget.
 *
 * Simplification moves the boundary, so the margin is applied first and the outward direction is
 * the only one taken: the returned ring covers at least the hazard itself.
 * @param {HazardArea} area Area to convert.
 * @param {number} marginMeters Clearance to keep from the hazard, in meters.
 * @param {number} vertexBudget Largest number of vertices the returned ring may have.
 * @returns {FenceLatLng[] | null} The exclusion ring, or `null` when the area is too degenerate to buffer.
 */
export const hazardAreaToExclusionRing = (
  area: HazardArea,
  marginMeters: number,
  vertexBudget: number
): FenceLatLng[] | null => {
  runSelfCheckOnce()

  const positions = area.coordinates.map(toPosition)
  if (positions.length < 2) return null

  const source =
    area.kind === 'polygon' && positions.length >= MIN_EXCLUSION_VERTICES
      ? turf.polygon([closeRing(positions)])
      : turf.lineString(positions)

  // A zero-width buffer of a line has no area at all, so a line always gets at least a metre.
  const distance = area.kind === 'line' ? Math.max(1, marginMeters) : marginMeters
  const buffered =
    distance > 0 ? (turf.buffer(source, distance, { units: 'meters' }) as Feature<Polygon> | undefined) : undefined
  const ring = buffered?.geometry?.coordinates?.[0] ?? (area.kind === 'polygon' ? closeRing(positions) : undefined)
  if (!ring || ring.length < MIN_EXCLUSION_VERTICES + 1) return null

  const budget = Math.max(MIN_EXCLUSION_VERTICES, Math.floor(vertexBudget))
  return simplifyToBudget(openRing(ring), budget).map(toFenceLatLng)
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
  assert(ring !== null, 'A well-formed area must convert into an exclusion ring')
  assert((ring as FenceLatLng[]).length <= 20, 'A converted ring must fit the vertex budget')
  assert((ring as FenceLatLng[]).length >= MIN_EXCLUSION_VERTICES, 'A converted ring must still be a polygon')

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
  assert(strip !== null && strip.length >= MIN_EXCLUSION_VERTICES, 'A line must buffer into a closed strip')
  assert(
    turf.booleanPointInPolygon(
      turf.point([0.005, 0]),
      turf.polygon([closeRing((strip as FenceLatLng[]).map(toPosition))])
    ),
    'The strip must contain the shoreline it was buffered from'
  )
}
