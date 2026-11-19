import * as turf from '@turf/turf'
import type { Feature, Polygon, Position } from 'geojson'
import localforage from 'localforage'

import { coastlineFaces } from '@/libs/hazards/coastline-faces'
import { polygonRings } from '@/libs/hazards/hazard-areas'
import { chainSegments, coastlineAreas } from '@/libs/hazards/overpass-hazards'
import { type OverpassElement, type OverpassGeometryPoint, overpassRegion, runOverpassQuery } from '@/libs/overpass'
import type { GeoBbox } from '@/types/general'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * What OpenStreetMap maps as water and land in one cell of the water map. Each polygon is its outline and then
 * its holes, closed and in `[longitude, latitude]`.
 */
export interface WaterCell {
  /**
   * When the cell was downloaded, in milliseconds since the epoch.
   */
  fetchedAtMs: number
  /**
   * The sea side of the coastline, lakes, lagoons and river areas.
   */
  water: Position[][][]
  /**
   * The land side of the coastline. Away from a coastline neither list covers a point.
   */
  land: Position[][][]
}

/**
 * The water map cells a path crosses, and how many of them could not be loaded.
 */
export interface WaterCellsLoad {
  /**
   * Loaded cells, by key.
   */
  cells: Map<string, WaterCell>
  /**
   * Cells that are neither stored nor could be downloaded.
   */
  failed: number
}

// About 5.5 km north to south: a mission crosses few cells, and one cell's water is a small download.
const CELL_DEG = 0.05
// Several cells share a query, so a long mission costs one round trip per handful of cells.
const CELLS_PER_QUERY = 6
const OVERPASS_TIMEOUT_S = 30
// Re-checks run on every mission edit, so a cell that failed is only asked for again after this, or on a retry.
const RETRY_AFTER_MS = 60000
const WATER_SELECTORS = ['["natural"="water"]', '["waterway"="riverbank"]']
const STORED_KEY_PREFIX = 'v1:'

// ponytail: cells never expire, so a coastline or lake edited in OpenStreetMap is only picked up once the database
// is cleared. Store a max age per cell if that starts to matter.
const waterDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Water Map',
  storeName: 'cockpit-water-map',
  version: 1.0,
})

const loadedCells = new Map<string, WaterCell>()
const pendingCells = new Map<string, Promise<void>>()
const failedAtMs = new Map<string, number>()

let selfChecked = false

const cellKeyAt = ([lat, lng]: WaypointCoordinates): string =>
  `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`

const cellBbox = (key: string): GeoBbox => {
  const [row, column] = key.split(':').map(Number)
  return {
    south: row * CELL_DEG,
    west: column * CELL_DEG,
    north: (row + 1) * CELL_DEG,
    east: (column + 1) * CELL_DEG,
  }
}

const roundRings = (rings: Position[][]): Position[][] =>
  rings.map((ring) => ring.map(([lng, lat]) => [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]))

const geometryOf = (geometry?: OverpassGeometryPoint[]): WaypointCoordinates[] =>
  (geometry ?? []).map(({ lat, lon }) => [lat, lon])

const closedRing = (coordinates: WaypointCoordinates[]): Position[] | undefined => {
  const first = coordinates[0]
  const last = coordinates.at(-1)
  if (coordinates.length < 4 || first[0] !== last?.[0] || first[1] !== last[1]) return undefined
  return coordinates.map(([lat, lng]) => [lng, lat])
}

// Whole lakes and river areas, their islands as holes, before any cell clips them.
const inlandWaterPolygons = (elements: OverpassElement[]): Position[][][] =>
  elements.flatMap((element) => {
    if (element.type === 'way') {
      const ring = closedRing(geometryOf(element.geometry))
      return ring ? [[ring]] : []
    }
    const ringsOf = (inner: boolean): Position[][] =>
      chainSegments(
        (element.members ?? [])
          .filter((member) => (member.role === 'inner') === inner)
          .map((member) => geometryOf(member.geometry))
      )
        .map(closedRing)
        .filter((ring): ring is Position[] => ring !== undefined)
    const holes = ringsOf(true)
    return ringsOf(false).map((outline) => {
      const polygon = turf.polygon([outline])
      return [outline, ...holes.filter((hole) => turf.booleanPointInPolygon(hole[0], polygon))]
    })
  })

const clipToCell = (polygon: Position[][], bbox: GeoBbox): Position[][][] => {
  const clipped = turf.bboxClip(turf.polygon(polygon), [bbox.west, bbox.south, bbox.east, bbox.north]).geometry
  if (clipped.type !== 'Polygon' && clipped.type !== 'MultiPolygon') return []
  const pieces = clipped.type === 'Polygon' ? [clipped.coordinates] : clipped.coordinates
  return pieces
    .filter((rings) => (rings[0]?.length ?? 0) >= 4)
    .map((rings) => roundRings(rings.filter((ring) => ring.length >= 4)))
}

const boxesTouch = ([west, south, east, north]: number[], bbox: GeoBbox): boolean =>
  west <= bbox.east && east >= bbox.west && south <= bbox.north && north >= bbox.south

const downloadCells = async (keys: string[], signal: AbortSignal): Promise<Map<string, WaterCell>> => {
  const selectors = keys.flatMap((key) => {
    const region = overpassRegion(cellBbox(key))
    const water = WATER_SELECTORS.flatMap((selector) => [`way${selector}${region};`, `relation${selector}${region};`])
    return [`way["natural"="coastline"]${region};`, ...water]
  })
  const query = `[out:json][timeout:${OVERPASS_TIMEOUT_S}];(${selectors.join('')});out geom;`
  const elements = await runOverpassQuery(query, signal)
  const isCoastline = (element: OverpassElement): boolean => element.tags?.natural === 'coastline'
  const coastline = coastlineAreas(elements.filter(isCoastline))
  const inland = inlandWaterPolygons(elements.filter((element) => !isCoastline(element))).map((polygon) => ({
    polygon,
    extent: turf.bbox(turf.polygon(polygon)),
  }))
  const fetchedAtMs = Date.now()
  return new Map(
    keys.map((key) => {
      const bbox = cellBbox(key)
      const faces = coastlineFaces(coastline, bbox)
      const lakes = inland
        .filter(({ extent }) => boxesTouch(extent, bbox))
        .flatMap(({ polygon }) => clipToCell(polygon, bbox))
      const water = [...faces.water.map((area) => roundRings(polygonRings(area))), ...lakes]
      return [key, { fetchedAtMs, water, land: faces.land.map((area) => roundRings(polygonRings(area))) }]
    })
  )
}

const isWaterCell = (value: unknown): value is WaterCell => {
  const cell = value as Partial<WaterCell> | null
  return typeof cell?.fetchedAtMs === 'number' && Array.isArray(cell.water) && Array.isArray(cell.land)
}

// A cell that cannot be read is downloaded again, rather than failing the whole load.
const readStoredCell = async (key: string): Promise<WaterCell | undefined> => {
  try {
    const stored = await waterDB.getItem<unknown>(`${STORED_KEY_PREFIX}${key}`)
    return isWaterCell(stored) ? stored : undefined
  } catch (error) {
    console.warn(`Could not read the stored water map cell ${key}:`, error)
    return undefined
  }
}

const storeCells = async (cells: Map<string, WaterCell>): Promise<void> => {
  try {
    await Promise.all([...cells].map(([key, cell]) => waterDB.setItem(`${STORED_KEY_PREFIX}${key}`, cell)))
  } catch (error) {
    console.warn('Could not store the water map:', error)
  }
}

const startDownload = (keys: string[], signal: AbortSignal): void => {
  const download = downloadCells(keys, signal)
    .then(async (cells) => {
      cells.forEach((cell, key) => {
        loadedCells.set(key, cell)
        failedAtMs.delete(key)
      })
      await storeCells(cells)
    })
    .catch((error) => {
      if ((error as DOMException)?.name === 'AbortError') return
      keys.forEach((key) => failedAtMs.set(key, Date.now()))
      console.warn('Could not download the water map:', error)
    })
    .finally(() => keys.forEach((key) => pendingCells.delete(key)))
  keys.forEach((key) => pendingCells.set(key, download))
}

/**
 * The water map cells a path crosses, in path order.
 * @param {WaypointCoordinates[]} points Points along the path, close enough together not to skip a cell.
 * @returns {string[]} The cell keys.
 */
export const waterCellKeys = (points: WaypointCoordinates[]): string[] => [...new Set(points.map(cellKeyAt))]

/**
 * Loads water map cells: from memory, then from this computer's database, and downloads from OpenStreetMap only
 * the cells never stored, keeping them for every later load. A failed download is not repeated for a minute.
 * @param {string[]} keys Cells to load.
 * @param {AbortSignal} signal Cancels the downloads this call started.
 * @param {boolean} retry Whether to download cells that failed recently instead of waiting out the pause.
 * @returns {Promise<WaterCellsLoad>} The loaded cells and how many could not be loaded.
 */
export const loadWaterCells = async (keys: string[], signal: AbortSignal, retry = false): Promise<WaterCellsLoad> => {
  const unread = keys.filter((key) => !loadedCells.has(key) && !pendingCells.has(key))
  const stored = await Promise.all(unread.map(async (key) => [key, await readStoredCell(key)] as const))
  stored.forEach(([key, cell]) => cell && loadedCells.set(key, cell))
  const now = Date.now()
  const missing = unread.filter(
    (key) =>
      !loadedCells.has(key) &&
      !pendingCells.has(key) &&
      (retry || now - (failedAtMs.get(key) ?? -Infinity) > RETRY_AFTER_MS)
  )
  for (let start = 0; start < missing.length; start += CELLS_PER_QUERY) {
    startDownload(missing.slice(start, start + CELLS_PER_QUERY), signal)
  }
  await Promise.all(keys.map((key) => pendingCells.get(key)))
  const cells = new Map(keys.flatMap((key) => (loadedCells.has(key) ? [[key, loadedCells.get(key)!]] : [])))
  return { cells, failed: keys.length - cells.size }
}

type PreparedPolygon = {
  /**
   * Bounding box, `[west, south, east, north]`, tested before the polygon itself.
   */
  extent: number[]
  /**
   * The polygon.
   */
  polygon: Feature<Polygon>
}

const preparedCells = new WeakMap<WaterCell, Record<'water' | 'land', PreparedPolygon[]>>()

const preparedCell = (cell: WaterCell): Record<'water' | 'land', PreparedPolygon[]> => {
  const known = preparedCells.get(cell)
  if (known) return known
  const prepare = (polygons: Position[][][]): PreparedPolygon[] =>
    polygons.map((rings) => {
      const polygon = turf.polygon(rings)
      return { extent: turf.bbox(polygon), polygon }
    })
  const prepared = { water: prepare(cell.water), land: prepare(cell.land) }
  preparedCells.set(cell, prepared)
  return prepared
}

const covers = (polygons: PreparedPolygon[], [lng, lat]: Position): boolean =>
  polygons.some(
    ({ extent: [west, south, east, north], polygon }) =>
      lng >= west && lng <= east && lat >= south && lat <= north && turf.booleanPointInPolygon([lng, lat], polygon)
  )

/**
 * Whether each point of a path is over water. Mapped water and the land side of a coastline decide first; open sea
 * and the water around an island have no coastline running through their cell, so there the model's ground below
 * the water level decides.
 * @param {WaypointCoordinates[]} points Points along the path.
 * @param {(number | null)[]} groundM Model ground under each point, meters above sea level.
 * @param {number} waterLevelM Water surface height.
 * @param {Map<string, WaterCell>} cells Loaded water map cells.
 * @returns {(boolean | null)[]} Whether each point is over water, null where its cell is not loaded.
 */
export const waterAlongPath = (
  points: WaypointCoordinates[],
  groundM: (number | null)[],
  waterLevelM: number,
  cells: Map<string, WaterCell>
): (boolean | null)[] => {
  runSelfCheckOnce()
  return points.map((point, index) => {
    const cell = cells.get(cellKeyAt(point))
    if (!cell) return null
    const { water, land } = preparedCell(cell)
    const position = [point[1], point[0]]
    if (covers(water, position)) return true
    if (covers(land, position)) return false
    // ponytail: inland ground below sea level, like a polder, reads as water when no coastline crosses its cell.
    const ground = groundM[index]
    return ground == null ? null : ground < waterLevelM
  })
}

// Runs once, on the first real use in a development session, after bootstrap has installed `assert`.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true

  const key = cellKeyAt([0.01, 0.01])
  const bbox = cellBbox(key)
  const lake: Position[][] = [
    [
      [-1, -1],
      [1, -1],
      [1, 0.02],
      [-1, 0.02],
      [-1, -1],
    ],
  ]
  const clipped = clipToCell(lake, bbox)
  assert(
    clipped.length === 1 && clipped[0][0].every(([lng]) => lng >= 0 && lng <= CELL_DEG),
    'A lake is cut to the cell'
  )
  const cell: WaterCell = { fetchedAtMs: 0, water: clipped, land: [] }
  const cells = new Map([[key, cell]])
  const found = waterAlongPath(
    [
      [0.01, 0.01],
      [0.04, 0.01],
      [0.04, 0.02],
      [1, 1],
    ],
    [50, 50, -20, -20],
    0,
    cells
  )
  assert(found[0] === true, 'A point in a mapped lake is over water, whatever the model reads')
  assert(found[1] === false, 'Away from mapped water, ground above the water level is land')
  assert(found[2] === true, 'Away from mapped water, ground below the water level is water')
  assert(found[3] === null, 'A point whose cell is not loaded is unknown')
}
