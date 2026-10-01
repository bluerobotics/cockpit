import * as turf from '@turf/turf'

import { restrictedAreaDetails, seamarkDetails } from '@/libs/hazards/osm-details'
import { type OverpassElement, type OverpassGeometryPoint, overpassRegion, runOverpassQuery } from '@/libs/overpass'
import type { GeoBbox } from '@/types/general'
import type { HazardArea, HazardFetchResult } from '@/types/hazards'
import type { WaypointCoordinates } from '@/types/mission'

/** Sources served by Overpass. openAIP airspace has its own client. */
export type OverpassHazardSourceId = 'coastline' | 'restricted-waters' | 'seamarks'

/**
 * A dense archipelago publishes more runs than an operator can read or a fence can hold, so the
 * fetch keeps the first slice and reports that the picture is partial.
 */
const MAX_AREAS_PER_SOURCE = 300

const OVERPASS_TIMEOUT_S = 30

const RESTRICTED_WATER_SELECTORS = ['["seamark:type"="restricted_area"]', '["boundary"="protected_area"]']

const SEAMARK_HAZARD_SELECTOR = '["seamark:type"~"^(rock|wreck|obstruction)$"]'

const SEAMARK_LABELS: Record<string, string> = { rock: 'Rock', wreck: 'Wreck', obstruction: 'Obstruction' }

// A charted point carries no extent, so it is given a token one; the clearance margin does the real work.
const SEAMARK_POINT_RADIUS_M = 10

// Enough vertices to outvote the few that land beside a shoreline corner, where the side test is ambiguous.
const SHORE_SIDE_SAMPLES = 16

const samePoint = (a: WaypointCoordinates, b: WaypointCoordinates): boolean => a[0] === b[0] && a[1] === b[1]

const pointKey = ([lat, lng]: WaypointCoordinates): string => `${lat}:${lng}`

const toCoordinates = (geometry: OverpassGeometryPoint[]): WaypointCoordinates[] =>
  geometry.map(({ lat, lon }) => [lat, lon])

const geometryOf = (element: Pick<OverpassElement, 'geometry'>): WaypointCoordinates[] =>
  (element.geometry?.length ?? 0) >= 2 ? toCoordinates(element.geometry as OverpassGeometryPoint[]) : []

let selfChecked = false

/**
 * Joins way segments that share an endpoint into the longest continuous runs possible. OSM stores a
 * coastline or a large protected boundary as many separate ways, and checking a mission against
 * those fragments individually both draws badly and misses crossings at the seams.
 * @param {WaypointCoordinates[][]} segments Way geometries, each a list of `[lat, lng]` vertices.
 * @returns {WaypointCoordinates[][]} Chained runs. A run whose first and last vertex coincide is a closed ring.
 */
export const chainSegments = (segments: WaypointCoordinates[][]): WaypointCoordinates[][] => {
  runSelfChecksOnce()

  const pool = segments.filter((segment) => segment.length >= 2)
  const used = pool.map(() => false)

  // Endpoint lookup, so extending a chain costs a map read instead of a scan over every segment.
  const endpoints = new Map<string, number[]>()
  const register = (point: WaypointCoordinates, index: number): void => {
    const key = pointKey(point)
    const bucket = endpoints.get(key)
    if (bucket) bucket.push(index)
    else endpoints.set(key, [index])
  }
  pool.forEach((segment, index) => {
    register(segment[0], index)
    register(segment[segment.length - 1], index)
  })

  const takeUnused = (point: WaypointCoordinates): number | undefined => {
    const bucket = endpoints.get(pointKey(point))
    while (bucket && bucket.length > 0) {
      const index = bucket.pop()
      if (index !== undefined && !used[index]) return index
    }
    return undefined
  }

  const chains: WaypointCoordinates[][] = []
  pool.forEach((segment, index) => {
    if (used[index]) return
    used[index] = true
    let chain = segment

    for (;;) {
      const tail = chain[chain.length - 1]
      if (samePoint(chain[0], tail)) break
      const next = takeUnused(tail)
      if (next === undefined) break
      used[next] = true
      const found = pool[next]
      chain = chain.concat(samePoint(found[0], tail) ? found.slice(1) : found.slice(0, -1).reverse())
    }

    for (;;) {
      const head = chain[0]
      if (samePoint(chain[chain.length - 1], head)) break
      const previous = takeUnused(head)
      if (previous === undefined) break
      used[previous] = true
      const found = pool[previous]
      chain = (samePoint(found[found.length - 1], head) ? found.slice(0, -1) : found.slice(1).reverse()).concat(chain)
    }

    chains.push(chain)
  })

  return chains
}

/**
 * Tells whether a protected area reaches open water, given the coastline ways around it. OSM draws
 * coastline with the land on its left, so an area that never crosses the shore is judged by which
 * side of the nearest coastline segment most of its vertices fall on.
 * @param {WaypointCoordinates[]} ring Area outline, open form.
 * @param {WaypointCoordinates[][]} shoreline Raw coastline way geometries, in their OSM direction.
 * @returns {boolean} Whether the area touches or lies in the water.
 */
export const reachesWater = (ring: WaypointCoordinates[], shoreline: WaypointCoordinates[][]): boolean => {
  runSelfChecksOnce()
  // No shore in view means an area is either all land or all sea, and nothing here tells which, so
  // it is kept: a spurious advisory costs less than a missing one.
  if (shoreline.length === 0 || ring.length < 2) return true

  const toLine = (coordinates: WaypointCoordinates[]): number[][] => coordinates.map(([lat, lng]) => [lng, lat])
  const outline = turf.lineString(toLine([...ring, ring[0]]))
  const shore = turf.multiLineString(shoreline.map(toLine))
  if (turf.lineIntersect(outline, shore).features.length > 0) return true

  const step = Math.max(1, Math.floor(ring.length / SHORE_SIDE_SAMPLES))
  const samples = ring.filter((_, index) => index % step === 0)
  const inWater = samples.filter((point) => isOnWaterSide(point, shoreline)).length
  return inWater * 2 > samples.length
}

// ponytail: brute-force nearest segment, O(samples x shoreline segments) per area; a spatial index
// (turf's rbush) is the upgrade if dense coastlines make the restricted-waters load stutter.
const isOnWaterSide = ([lat, lng]: WaypointCoordinates, shoreline: WaypointCoordinates[][]): boolean => {
  const lngScale = Math.cos((lat * Math.PI) / 180)
  const px = lng * lngScale
  let nearest = Infinity
  let cross = 0
  shoreline.forEach((way) => {
    for (let index = 1; index < way.length; index++) {
      const [ay, ax] = [way[index - 1][0], way[index - 1][1] * lngScale]
      const [by, bx] = [way[index][0], way[index][1] * lngScale]
      const [dx, dy] = [bx - ax, by - ay]
      const lengthSquared = dx * dx + dy * dy
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (lat - ay) * dy) / lengthSquared))
      const distance = (ax + t * dx - px) ** 2 + (ay + t * dy - lat) ** 2
      if (distance < nearest) {
        nearest = distance
        cross = dx * (lat - ay) - dy * (px - ax)
      }
    }
  })
  return cross < 0
}

// Runs once, on the first real use in a development session. Deliberately not at import time:
// the global `assert` is installed during bootstrap and may not exist yet when this module loads.
const runSelfChecksOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  const chained = chainSegments([
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 1],
      [1, 0],
    ],
    // Reversed on purpose: OSM ways meeting at a node do not agree on direction.
    [
      [1, 1],
      [0, 1],
    ],
    [
      [1, 0],
      [0, 0],
    ],
  ])
  assert(chained.length === 1, 'Segments forming one ring must chain into a single run')
  assert(chained[0].length === 5, 'A closed chain must repeat its first vertex at the end')
  assert(samePoint(chained[0][0], chained[0][4]), 'A closed chain must start and end at the same vertex')
  assert(chainSegments([[[0, 0]]]).length === 0, 'Degenerate single-vertex segments must be dropped')

  // A shore running east along the equator, so the land (its left) is north and the sea is south.
  const shore: WaypointCoordinates[][] = [
    [
      [0, 0],
      [0, 2],
    ],
  ]
  const square = (south: number, north: number): WaypointCoordinates[] => [
    [south, 0.5],
    [north, 0.5],
    [north, 1.5],
    [south, 1.5],
  ]
  assert(reachesWater(square(-0.8, -0.2), shore), 'An area on the sea side of the shore must reach water')
  assert(!reachesWater(square(0.2, 0.8), shore), 'An area on the land side of the shore must not reach water')
  assert(reachesWater(square(-0.5, 0.5), shore), 'An area crossing the shore must reach water')
  assert(reachesWater(square(0.2, 0.8), []), 'An area with no shore in view must be kept')

  const rock = seamarkAreaOf({ type: 'node', id: 1, lat: 0, lon: 0, tags: { 'seamark:type': 'rock' } })
  assert(rock?.kind === 'polygon' && rock.coordinates.length === 8, 'A charted point must become a small polygon')
  assert(rock?.label === 'Rock', 'An unnamed seamark must be labeled by its type')
}

// A ring repeats its first vertex at the end; every consumer here wants the open form.
const toArea = (
  sourceId: OverpassHazardSourceId,
  id: string,
  label: string,
  coordinates: WaypointCoordinates[]
): HazardArea => {
  const closed = coordinates.length >= 4 && samePoint(coordinates[0], coordinates[coordinates.length - 1])
  return {
    id,
    sourceId,
    kind: closed ? 'polygon' : 'line',
    coordinates: closed ? coordinates.slice(0, -1) : coordinates,
    label,
  }
}

const elementLabel = (element: OverpassElement, fallback: string): string =>
  element.tags?.name?.trim() || element.tags?.['seamark:name']?.trim() || fallback

const coastlineAreas = (elements: OverpassElement[]): HazardArea[] =>
  chainSegments(elements.map(geometryOf)).map((coordinates) =>
    // Keyed on the first vertex rather than a way id, which chaining discards: it keeps the id
    // stable across re-fetches for as long as the underlying geometry is unchanged.
    toArea('coastline', `coastline:${pointKey(coordinates[0])}`, 'Coastline', coordinates)
  )

const isCoastlineWay = (element: OverpassElement): boolean => element.tags?.natural === 'coastline'

const restrictedWaterAreasOf = (element: OverpassElement): HazardArea[] => {
  const label = elementLabel(element, element.tags?.['seamark:type'] ? 'Restricted area' : 'Protected area')
  const details = restrictedAreaDetails(element)
  const wayGeometry = geometryOf(element)
  if (wayGeometry.length > 0) {
    return [{ ...toArea('restricted-waters', `restricted-waters:w${element.id}`, label, wayGeometry), details }]
  }

  // Inner members (holes) are dropped: a fence exclusion has no holes, and covering the hole too
  // keeps the vehicle out of more water rather than less.
  const outerSegments = (element.members ?? [])
    .filter((member) => member.role !== 'inner')
    .map(geometryOf)
    .filter((geometry) => geometry.length > 0)
  return chainSegments(outerSegments).map((coordinates, ringIndex) => ({
    ...toArea('restricted-waters', `restricted-waters:r${element.id}:${ringIndex}`, label, coordinates),
    details,
  }))
}

// Protected areas include land parks, and marine reserves are rarely tagged as marine, so a protected
// area only counts when it reaches the water. Seamark restricted areas are marine by definition.
const restrictedWaterAreas = (elements: OverpassElement[]): HazardArea[] => {
  const shoreline = elements.filter(isCoastlineWay).map(geometryOf)
  return elements
    .filter((element) => !isCoastlineWay(element))
    .flatMap((element) => {
      const areas = restrictedWaterAreasOf(element)
      if (element.tags?.['seamark:type']) return areas
      return areas.filter((area) => reachesWater(area.coordinates, shoreline))
    })
}

const seamarkAreaOf = (element: OverpassElement): HazardArea | undefined => {
  const type = element.tags?.['seamark:type'] ?? ''
  const label = elementLabel(element, SEAMARK_LABELS[type] ?? 'Obstruction')
  const id = `seamarks:${element.type?.[0] ?? 'x'}${element.id}`
  const details = seamarkDetails(element)
  const wayGeometry = geometryOf(element)
  if (wayGeometry.length > 0) return { ...toArea('seamarks', id, label, wayGeometry), details }
  if (element.lat === undefined || element.lon === undefined) return undefined
  const circle = turf.circle([element.lon, element.lat], SEAMARK_POINT_RADIUS_M, { units: 'meters', steps: 8 })
  const ring = circle.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => [lat, lng] as WaypointCoordinates)
  return { id, sourceId: 'seamarks', kind: 'polygon', coordinates: ring, label, details }
}

const seamarkAreas = (elements: OverpassElement[]): HazardArea[] => {
  runSelfChecksOnce()
  return elements.map(seamarkAreaOf).filter((area): area is HazardArea => area !== undefined)
}

const overpassQueries: Record<OverpassHazardSourceId, (region: string) => string> = {
  'coastline': (region) => `way["natural"="coastline"]${region};`,
  'restricted-waters': (region) =>
    `(${RESTRICTED_WATER_SELECTORS.flatMap((selector) => [
      `way${selector}${region};`,
      `relation${selector}${region};`,
    ]).join('')}way["natural"="coastline"]${region};);`,
  'seamarks': (region) => `(node${SEAMARK_HAZARD_SELECTOR}${region};way${SEAMARK_HAZARD_SELECTOR}${region};);`,
}

const overpassParsers: Record<OverpassHazardSourceId, (elements: OverpassElement[]) => HazardArea[]> = {
  'coastline': coastlineAreas,
  'restricted-waters': restrictedWaterAreas,
  'seamarks': seamarkAreas,
}

/**
 * Fetches the areas one OpenStreetMap-backed source publishes inside a bounding box. Anything
 * outside the box, or past the area cap, is unknown rather than clear.
 * @param {OverpassHazardSourceId} sourceId Source to query.
 * @param {GeoBbox} bbox Area to restrict the query to.
 * @param {AbortSignal} signal Cancellation signal.
 * @returns {Promise<HazardFetchResult>} The areas found, with the box and timestamp they belong to.
 */
export const fetchOverpassHazardAreas = async (
  sourceId: OverpassHazardSourceId,
  bbox: GeoBbox,
  signal: AbortSignal
): Promise<HazardFetchResult> => {
  const query = `[out:json][timeout:${OVERPASS_TIMEOUT_S}];${overpassQueries[sourceId](overpassRegion(bbox))}out geom;`
  const elements = await runOverpassQuery(query, signal)
  const found = overpassParsers[sourceId](elements)

  return {
    sourceId,
    bbox,
    fetchedAtMs: Date.now(),
    areas: found.slice(0, MAX_AREAS_PER_SOURCE),
    truncated: found.length > MAX_AREAS_PER_SOURCE,
  }
}
