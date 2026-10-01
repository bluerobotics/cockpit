import * as turf from '@turf/turf'
import type { BBox, Feature, MultiPolygon, Polygon, Position } from 'geojson'

import { bboxContains, polygonRings } from '@/libs/hazards/hazard-areas'
import { TERRAIN_TILE_SIZE, TERRAIN_TILE_ZOOM } from '@/libs/hazards/terrain-rgb'
import type { GeoBbox } from '@/types/general'
import type { HazardArea, HazardGridSourceId, TerrainGrid } from '@/types/hazards'
import type { WaypointCoordinates } from '@/types/mission'

// ponytail: about a million samples, traced on the main thread, so a threshold change blocks the interface
// for seconds. Tracing in the terrain worker is the upgrade path if this detail is kept.
const MAX_SAMPLES_PER_SIDE = 1024

// Above any real ground, closing the band from the top.
const BAND_TOP_M = 100000

const MIN_AREA_WIDTH_M = 3

const pixelDegreesAt = (zoom: number): number => 360 / (2 ** zoom * TERRAIN_TILE_SIZE)

/**
 * Where to sample the ground to cover one bounding box.
 */
export interface TerrainGridLayout {
  /**
   * Samples per row, west to east.
   */
  columns: number
  /**
   * Rows of samples, south to north.
   */
  rows: number
  /**
   * Coarsest elevation tile zoom whose pixels are no wider than the sample spacing.
   */
  zoom: number
  /**
   * Every sample position, row-major from the south-west corner.
   */
  positions: WaypointCoordinates[]
}

const gridPosition = (bbox: GeoBbox, columns: number, rows: number, index: number): WaypointCoordinates => {
  const row = Math.floor(index / columns)
  const column = index % columns
  return [
    bbox.south + ((bbox.north - bbox.south) * row) / (rows - 1),
    bbox.west + ((bbox.east - bbox.west) * column) / (columns - 1),
  ]
}

/**
 * Lays out a regular sampling grid over a bounding box, no finer than the elevation model itself.
 * @param {GeoBbox} bbox Area to cover.
 * @returns {TerrainGridLayout} The grid size, the tile zoom to sample at and every sample position.
 */
export const terrainGridLayout = (bbox: GeoBbox): TerrainGridLayout => {
  const span = Math.max(bbox.north - bbox.south, bbox.east - bbox.west)
  const spacing = Math.max(pixelDegreesAt(TERRAIN_TILE_ZOOM), span / (MAX_SAMPLES_PER_SIDE - 1))
  const zoom = Math.min(TERRAIN_TILE_ZOOM, Math.ceil(Math.log2(360 / (TERRAIN_TILE_SIZE * spacing))))
  const columns = Math.max(2, Math.round((bbox.east - bbox.west) / spacing) + 1)
  const rows = Math.max(2, Math.round((bbox.north - bbox.south) / spacing) + 1)
  const positions = Array.from({ length: columns * rows }, (_, index) => gridPosition(bbox, columns, rows, index))
  return { columns, rows, zoom, positions }
}

let selfChecked = false

const openRing = (ring: Position[]): WaypointCoordinates[] =>
  ring.slice(0, -1).map(([lng, lat]) => [lat, lng] as WaypointCoordinates)

// Each unknown sample takes the elevation of the nearest known one (breadth-first over the grid), so no
// slope is invented between known ground and a placeholder value.
const fillUnknownSamples = ({ columns, rows, elevationsM }: TerrainGrid): number[] | undefined => {
  const filled = [...elevationsM]
  const queue: number[] = []
  filled.forEach((elevation, index) => {
    if (elevation !== null) queue.push(index)
  })
  if (queue.length === 0) return undefined
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]
    const column = index % columns
    const neighbors = [
      column > 0 ? index - 1 : -1,
      column < columns - 1 ? index + 1 : -1,
      index >= columns ? index - columns : -1,
      index < (rows - 1) * columns ? index + columns : -1,
    ]
    neighbors
      .filter((neighbor) => neighbor >= 0 && filled[neighbor] === null)
      .forEach((neighbor) => {
        filled[neighbor] = filled[index]
        queue.push(neighbor)
      })
  }
  return filled as number[]
}

const polygonsOf = (feature: Feature<Polygon | MultiPolygon> | null | undefined): Position[][][] => {
  const geometry = feature?.geometry
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.coordinates ?? []
  return polygons.filter(([outer]) => outer.length >= 4)
}

// ponytail: twice the area over the perimeter is the exact width of a strip or ring but only half that of a round
// patch, and a thin tail on a wide area survives; eroding each area by half the width is the precise upgrade.
const meanWidthM = (rings: Position[][]): number => {
  const polygon = turf.polygon(rings)
  return (2 * turf.area(polygon)) / turf.length(polygon, { units: 'meters' })
}

const bboxesOverlap = ([aWest, aSouth, aEast, aNorth]: BBox, [bWest, bSouth, bEast, bNorth]: BBox): boolean =>
  aWest <= bEast && aEast >= bWest && aSouth <= bNorth && aNorth >= bSouth

// ponytail: clipping dominates a full trace, so only the areas reaching into an unknown patch pay for it; an
// unknown strip across the whole grid still adds seconds on the main thread, and the terrain worker is the fix.
const cutOutUnknown = (areas: Position[][][], unknown: Position[][][]): Position[][][] => {
  const patches = unknown.map((rings) => ({ rings, bbox: turf.bbox(turf.polygon(rings)) }))
  return areas.flatMap((rings) => {
    const area = turf.polygon(rings)
    const bbox = turf.bbox(area)
    const touching = patches.filter((patch) => bboxesOverlap(bbox, patch.bbox)).map((patch) => patch.rings)
    if (touching.length === 0) return [rings]
    try {
      const pair: Feature<Polygon | MultiPolygon>[] = [area, turf.multiPolygon(touching)]
      return polygonsOf(turf.difference(turf.featureCollection(pair)))
    } catch (error) {
      console.warn('Could not cut the unknown ground out of a traced area:', error)
      return [rings]
    }
  })
}

const traceBand = (
  grid: TerrainGrid,
  [lowerM, upperM]: [number, number],
  sourceId: HazardGridSourceId,
  label: string
): HazardArea[] => {
  const filled = fillUnknownSamples(grid)
  if (!filled) return []
  const positions = filled.map((_, index) => {
    const [lat, lng] = gridPosition(grid.bbox, grid.columns, grid.rows, index)
    return [lng, lat]
  })
  const isoband = (values: number[], breaks: number[]): Feature<Polygon | MultiPolygon> | undefined =>
    turf.isobands(
      turf.featureCollection(values.map((elevation, index) => turf.point(positions[index], { elevation }))),
      breaks
    ).features[0]

  const band = polygonsOf(isoband(filled, [lowerM, upperM]))
  // The filled samples only keep the trace honest up to the unknown region, which is then cut back out of it.
  const unknownMask = grid.elevationsM.map((elevation) => (elevation === null ? 1 : 0))
  const polygons =
    band.length > 0 && grid.elevationsM.includes(null)
      ? cutOutUnknown(band, polygonsOf(isoband(unknownMask, [0.5, 2])))
      : band
  return polygons
    .map(([outer, ...holes]) => [outer, ...holes.filter((hole) => hole.length >= 4)])
    .filter((rings) => meanWidthM(rings) >= MIN_AREA_WIDTH_M)
    .map(([outer, ...holes], index) => ({
      id: `${sourceId}:${index}`,
      sourceId,
      kind: 'polygon',
      label,
      coordinates: openRing(outer),
      holes: holes.map(openRing),
    }))
}

/**
 * Distance between neighboring samples of a grid, which bounds how finely its traced edges follow the ground.
 * @param {TerrainGrid} grid Sampled grid.
 * @returns {number} Sample spacing, in meters, rounded to the meter.
 */
export const terrainSampleSpacingM = (grid: TerrainGrid): number => {
  const rowStep = (grid.bbox.north - grid.bbox.south) / (grid.rows - 1)
  return Math.round(turf.distance([0, 0], [0, rowStep], { units: 'meters' }))
}

/**
 * A copy of a grid with every sample inside a box turned unknown, so nothing is traced there.
 * @param {TerrainGrid} grid Sampled grid.
 * @param {GeoBbox} bbox Box whose samples to clear, edges included.
 * @returns {TerrainGrid} The grid with those samples set to `null`.
 */
export const clearGridSamplesIn = (grid: TerrainGrid, bbox: GeoBbox): TerrainGrid => ({
  ...grid,
  elevationsM: grid.elevationsM.map((elevation, index) =>
    bboxContains(bbox, gridPosition(grid.bbox, grid.columns, grid.rows, index)) ? null : elevation
  ),
})

/**
 * Traces the ground higher than an elevation as closed areas. Samples whose tile could not be loaded
 * are never marked, matching the waypoint check, which skips what it cannot establish.
 * @param {TerrainGrid} grid Sampled grid.
 * @param {number} thresholdM Elevation, in meters above sea level, above which ground is marked.
 * @returns {HazardArea[]} One polygon per stretch of marked ground.
 */
export const terrainAreasAbove = (grid: TerrainGrid, thresholdM: number): HazardArea[] => {
  runSelfCheckOnce()
  // Elevations are whole meters, so half a meter up keeps ground at exactly the threshold out of the band.
  return traceBand(grid, [thresholdM + 0.5, BAND_TOP_M], 'terrain', `Ground above ${thresholdM} m`)
}

/**
 * Traces the seabed no deeper than a depth as closed areas. Land and unknown samples are never marked.
 * @param {TerrainGrid} grid Sampled grid.
 * @param {number} depthM Depth, in meters below sea level, down to which water is marked.
 * @returns {HazardArea[]} One polygon per stretch of shallow water.
 */
export const shallowWaterAreas = (grid: TerrainGrid, depthM: number): HazardArea[] => {
  runSelfCheckOnce()
  return traceBand(grid, [-depthM - 0.5, -0.5], 'shallow-water', `Water ${depthM} m deep or less`)
}

// Runs once, on the first real trace of a development session, after bootstrap has installed `assert`.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  // Sea-level ground to the west rising to a 100 m ridge along the eastern edge.
  const slope: TerrainGrid = {
    bbox: { south: 0, west: 0, north: 0.02, east: 0.02 },
    fetchedAtMs: 0,
    columns: 3,
    rows: 3,
    elevationsM: [0, 0, 100, 0, 0, 100, 0, 0, 100],
  }
  const encloses = (area: HazardArea, lng: number): boolean =>
    turf.booleanPointInPolygon(turf.point([lng, 0.01]), turf.polygon(polygonRings(area)))

  const [high, ...extra] = terrainAreasAbove(slope, 50)
  assert(extra.length === 0, 'One stretch of high ground must trace a single area')
  assert(encloses(high, 0.019), 'Ground above the threshold must be marked')
  assert(!encloses(high, 0.002), 'Ground below the threshold must be left out')
  assert(terrainAreasAbove(slope, 100).length === 0, 'Ground at the threshold must not be marked')
  assert(
    terrainAreasAbove({ ...slope, elevationsM: slope.elevationsM.map(() => null) }, -10).length === 0,
    'Unknown ground must never be marked'
  )
  assert(
    terrainAreasAbove(clearGridSamplesIn(slope, { south: 0, west: 0.015, north: 0.02, east: 0.02 }), 50).length === 0,
    'Ground in a cleared box must never be marked'
  )
  assert(
    shallowWaterAreas({ ...slope, elevationsM: [5, 5, null, 5, 5, null, 5, 5, null] }, 5).length === 0,
    'Land next to unknown ground must never be marked as shallow water'
  )
  const [ridgeBesideUnknown] = terrainAreasAbove(
    { ...slope, elevationsM: [null, 0, 100, null, 0, 100, null, 0, 100] },
    50
  )
  assert(
    ridgeBesideUnknown !== undefined && encloses(ridgeBesideUnknown, 0.019),
    'Ground above the threshold must still be marked beside unknown ground'
  )

  // A 20 m deep channel to the west shoaling to a 2 m bank, with land along the eastern edge.
  const shoal: TerrainGrid = { ...slope, elevationsM: [-20, -2, 5, -20, -2, 5, -20, -2, 5] }
  const [shallow, ...extraShallow] = shallowWaterAreas(shoal, 5)
  assert(extraShallow.length === 0, 'One bank must trace a single shallow area')
  assert(encloses(shallow, 0.01), 'Water shallower than the depth must be marked')
  assert(!encloses(shallow, 0.001), 'Water deeper than the depth must be left out')
  assert(!encloses(shallow, 0.0195), 'Land must never be marked as shallow water')

  // Steep enough that the 5 m shallow band is about 2.8 m wide, then ten times gentler for about 28 m.
  const cliff: TerrainGrid = { ...slope, elevationsM: [-1000, 1000, 1000, -1000, 1000, 1000, -1000, 1000, 1000] }
  assert(shallowWaterAreas(cliff, 5).length === 0, 'Areas thinner than the minimum width must be ignored')
  const gentle: TerrainGrid = { ...slope, elevationsM: [-100, 100, 100, -100, 100, 100, -100, 100, 100] }
  assert(shallowWaterAreas(gentle, 5).length === 1, 'Areas wider than the minimum width must be kept')

  // A 20 m deep pool in the middle of a 2 m flat.
  const [flat] = shallowWaterAreas({ ...slope, elevationsM: [-2, -2, -2, -2, -20, -2, -2, -2, -2] }, 5)
  assert(encloses(flat, 0.001), 'Shallow water around a deep pool must be marked')
  assert(!encloses(flat, 0.01), 'A deep pool ringed by shallow water must be left out')
}
