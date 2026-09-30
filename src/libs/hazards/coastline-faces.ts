import * as turf from '@turf/turf'
import type { Feature, LineString, Position } from 'geojson'

import { polygonRings } from '@/libs/hazards/hazard-areas'
import type { GeoBbox } from '@/types/general'
import type { HazardArea } from '@/types/hazards'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * The land and the water a loaded coastline divides its bounding box into.
 */
export interface CoastlineFaces {
  /**
   * Stretches of land, islands included.
   */
  land: HazardArea[]
  /**
   * Stretches of water.
   */
  water: HazardArea[]
}

let selfChecked = false

const edgeKey = (a: Position, b: Position): string => `${a[0]},${a[1]}|${b[0]},${b[1]}`

// Distance along the box outline, counterclockwise from its south-west corner, for a position on it.
const outlineOffset = ({ south, west, north, east }: GeoBbox, [lng, lat]: Position): number | undefined => {
  const width = east - west
  const height = north - south
  if (lat === south) return lng - west
  if (lng === east) return width + (lat - south)
  if (lat === north) return width + height + (east - lng)
  if (lng === west) return 2 * width + height + (north - lat)
  return undefined
}

// The box outline cut at every point a coastline reaches it, so each piece meets the coastline at its ends.
const outlineSegments = (bbox: GeoBbox, cuts: Position[]): Feature<LineString>[] => {
  const corners: Position[] = [
    [bbox.west, bbox.south],
    [bbox.east, bbox.south],
    [bbox.east, bbox.north],
    [bbox.west, bbox.north],
  ]
  const stops = [...corners, ...cuts]
    .map((position) => ({ position, offset: outlineOffset(bbox, position) ?? 0 }))
    .sort((a, b) => a.offset - b.offset)
    .filter((stop, index, sorted) => index === 0 || stop.offset !== sorted[index - 1].offset)
  return stops.map((stop, index) => turf.lineString([stop.position, stops[(index + 1) % stops.length].position]))
}

/**
 * Divides a coastline's bounding box into land and water. OSM draws coastline with the land on its left,
 * so each face is judged by the direction of a coastline edge on its border. Only the loaded box is
 * divided: outside it nothing is known, and a face ends at the box edge.
 * @param {HazardArea[]} coastline Coastline runs and rings, in their OSM direction.
 * @param {GeoBbox} bbox Area the coastline was loaded for.
 * @returns {CoastlineFaces} The land and water faces, both empty when no coastline crosses the box.
 */
export const coastlineFaces = (coastline: HazardArea[], bbox: GeoBbox): CoastlineFaces => {
  runSelfCheckOnce()

  const pieces = coastline.flatMap((area) => {
    const ring = area.kind === 'polygon' ? [...area.coordinates, area.coordinates[0]] : area.coordinates
    if (ring.length < 2) return []
    const clipped = turf.bboxClip(turf.lineString(ring.map(([lat, lng]) => [lng, lat])), [
      bbox.west,
      bbox.south,
      bbox.east,
      bbox.north,
    ]).geometry
    if (clipped.type === 'LineString') return clipped.coordinates.length >= 2 ? [clipped.coordinates] : []
    if (clipped.type !== 'MultiLineString') return []
    return clipped.coordinates.filter((line) => line.length >= 2)
  })
  if (pieces.length === 0) return { land: [], water: [] }

  const coastEdges = new Set(pieces.flatMap((line) => line.slice(1).map((end, index) => edgeKey(line[index], end))))
  const cuts = pieces
    .flatMap((line) => [line[0], line[line.length - 1]])
    .filter((end) => outlineOffset(bbox, end) !== undefined)

  const lines = [...pieces.map((line) => turf.lineString(line)), ...outlineSegments(bbox, cuts)]
  // A ring that touches nothing else, like an island, also comes back reversed as the hole it leaves.
  const seenOutlines = new Set<string>()
  const rings = turf
    .polygonize(turf.featureCollection(lines))
    .features.map((face) => face.geometry.coordinates[0])
    .filter((ring) => {
      const outline = ring.slice(0, -1).map(String).sort().join('|')
      if (seenOutlines.has(outline)) return false
      seenOutlines.add(outline)
      return true
    })
  const toCoordinates = (ring: Position[]): WaypointCoordinates[] => ring.slice(0, -1).map(([lng, lat]) => [lat, lng])

  const faces: CoastlineFaces = { land: [], water: [] }
  rings.forEach((ring) => {
    const side = sideOf(ring, coastEdges)
    if (side === undefined) return
    // ponytail: faces come back without holes, so any face strictly inside is cut out, which also cuts an island
    // in a lake out of the land around the lake. Nest by depth if that ever matters.
    const outline = turf.polygon([ring])
    const holes = rings.filter(
      (other) => other !== ring && turf.booleanPointInPolygon(other[0], outline, { ignoreBoundary: true })
    )
    faces[side].push({
      id: `coastline-${side}:${faces[side].length}`,
      sourceId: 'coastline',
      kind: 'polygon',
      label: side === 'land' ? 'Land' : 'Water',
      coordinates: toCoordinates(ring),
      holes: holes.map(toCoordinates),
    })
  })
  return faces
}

// A counterclockwise ring has its inside on the left of every edge, which is where the land is along a coastline.
const sideOf = (ring: Position[], coastEdges: Set<string>): keyof CoastlineFaces | undefined => {
  const counterclockwise = !turf.booleanClockwise(ring)
  for (let index = 1; index < ring.length; index++) {
    const forward = coastEdges.has(edgeKey(ring[index - 1], ring[index]))
    if (forward || coastEdges.has(edgeKey(ring[index], ring[index - 1]))) {
      return forward === counterclockwise ? 'land' : 'water'
    }
  }
  return undefined
}

// Runs once, on the first real division of a development session, after bootstrap has installed `assert`.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  const coastline = (coordinates: WaypointCoordinates[], kind: HazardArea['kind']): HazardArea => ({
    id: 'self-check',
    sourceId: 'coastline',
    kind,
    label: 'Coastline',
    coordinates,
  })
  // A shore running east across the box, so the land (its left) is north, and a counterclockwise island to the south.
  const { land, water } = coastlineFaces(
    [
      coastline(
        [
          [1, -1],
          [1, 3],
        ],
        'line'
      ),
      coastline(
        [
          [0.4, 0.4],
          [0.4, 0.6],
          [0.6, 0.6],
          [0.6, 0.4],
        ],
        'polygon'
      ),
    ],
    { south: 0, west: 0, north: 2, east: 2 }
  )
  const holds = (areas: HazardArea[], lat: number, lng: number): boolean =>
    areas.some((area) => turf.booleanPointInPolygon(turf.point([lng, lat]), turf.polygon(polygonRings(area))))
  assert(holds(land, 1.5, 1) && !holds(water, 1.5, 1), 'The left of a shore must be land')
  assert(holds(water, 0.2, 1) && !holds(land, 0.2, 1), 'The right of a shore must be water')
  assert(holds(land, 0.5, 0.5) && !holds(water, 0.5, 0.5), 'The inside of a counterclockwise ring must be land')
}
