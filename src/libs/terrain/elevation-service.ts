import { isElectron } from '@/libs/utils'
import type { WaypointCoordinates } from '@/types/mission'
import type { BathymetrySourceId, TerrainSampleMode, TerrainSourceId } from '@/types/terrain'
import type { TerrainDecodeRequest, TerrainDecodeResponse, TerrainTileFormat } from '@/workers/terrain-decode.worker'
// @ts-ignore: Worker imports
import TerrainDecodeWorker from '@/workers/terrain-decode.worker?worker'

import {
  type BathymetryTileSourceId,
  BATHYMETRY_TILE_MAX_ZOOM,
  bathymetryAttribution,
  bathymetryLayerCovers,
  bathymetryLayers,
  bathymetryTileUrl,
  checkBathymetryOnce,
} from './bathymetry'
import { checkCopernicusLatticeOnce } from './copernicus'
import {
  type TerrainTileSourceId,
  isValidTileUrlTemplate,
  TERRAIN_SOURCES,
  terrainSourceTileKey,
  terrainTileUrl,
} from './sources'
import { readStoredTerrainTile, removeStoredTerrainTile, storeTerrainTile } from './tile-store'
import {
  type TerrainSampleTarget,
  type TerrainTile,
  checkDespeckleOnce,
  terrainLatticeCell,
  terrainSampleTarget,
  TERRARIUM_NO_DATA_M,
} from './tiles'

/**
 * Which model the service reads, as chosen in the terrain settings.
 */
export interface TerrainServiceConfig {
  /**
   * Source sampled when a caller does not name one.
   */
  sourceId: TerrainSourceId
  /**
   * Model the depths are read from wherever the terrain source reads sea level or below.
   */
  bathymetrySourceId: BathymetrySourceId
  /**
   * URL template of the custom source.
   */
  customUrlTemplate: string
  /**
   * Deepest zoom of the custom source.
   */
  customMaxZoom: number
}

/**
 * How one batch of samples is read.
 */
export interface TerrainSampleOptions {
  /**
   * Zoom to sample at; defaults to the source's deepest.
   */
  zoom?: number
  /**
   * How the surrounding model points are combined; defaults to nearest.
   */
  mode?: TerrainSampleMode
  /**
   * Source to sample; defaults to the configured one.
   */
  sourceId?: TerrainSourceId
  /**
   * Returns null for open water no bathymetry knows the depth of, instead of a seabed at sea level, for checks
   * against the seabed.
   */
  seabedOnly?: boolean
}

// A decoded tile is 256 KB, so the cache is bounded; oldest out first, which suits a mission that
// walks across the map rather than jumping back to where it started.
const MAX_CACHED_TILES = 96
const TILE_FETCH_TIMEOUT_MS = 20000
const UNREACHABLE_BACKOFF_MS = 60000
const TILE_SIGNATURES: Record<TerrainTileFormat, number[][]> = {
  terrarium: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  geotiff: [
    [0x49, 0x49, 0x2a, 0x00],
    [0x4d, 0x4d, 0x00, 0x2a],
  ],
}
const unreachableUntilMs = new Map<TerrainTileSourceId, number>()

/**
 * A tile the server answered with an error status, which shows the source is reachable.
 */
class HttpTileError extends Error {
  // eslint-disable-next-line jsdoc/require-jsdoc
  constructor(status: number) {
    super(`HTTP ${status}`)
  }
}

let config: TerrainServiceConfig = {
  sourceId: 'tilezen',
  bathymetrySourceId: 'auto',
  customUrlTemplate: '',
  customMaxZoom: 15,
}

const tileCache = new Map<string, Float32Array>()
const inFlight = new Map<string, Promise<Float32Array>>()

// One worker for the whole application, created on the first sample and kept: it is idle between
// missions, it owns nothing per consumer, and tearing it down with any one consumer would pull it
// out from under the others.
let worker: Worker | undefined
let nextRequestId = 0
const pendingRequests = new Map<string, (answer: TerrainDecodeResponse) => void>()

const ensureWorker = (): Worker => {
  if (worker) return worker
  worker = new TerrainDecodeWorker() as Worker
  worker.onmessage = (event: MessageEvent<TerrainDecodeResponse>) => {
    pendingRequests.get(event.data.id)?.(event.data)
    pendingRequests.delete(event.data.id)
  }
  // A worker that fails to start answers nothing, so without this every sample waiting on it stays
  // pending forever. It never recovers either, so the next sample builds a new one.
  worker.onerror = (event: ErrorEvent) => {
    const error = event.message || 'The elevation decoder could not be started.'
    pendingRequests.forEach((settle, id) => settle({ id, error }))
    pendingRequests.clear()
    worker = undefined
  }
  return worker
}

const isBathymetryTileSource = (sourceId: string): sourceId is BathymetryTileSourceId =>
  sourceId in BATHYMETRY_TILE_MAX_ZOOM

const tileFormat = (sourceId: TerrainTileSourceId): TerrainTileFormat =>
  isBathymetryTileSource(sourceId) ? 'geotiff' : 'terrarium'

const decodeTile = (image: ArrayBuffer, tile: TerrainTile, format: TerrainTileFormat): Promise<Float32Array> => {
  checkDespeckleOnce()
  const request: TerrainDecodeRequest = { id: String(nextRequestId++), image, format, tile }
  return new Promise<Float32Array>((resolve, reject) => {
    pendingRequests.set(request.id, (answer) => {
      if (answer.elevations) resolve(answer.elevations)
      else reject(new Error(answer.error ?? 'The elevation tile could not be decoded.'))
    })
    ensureWorker().postMessage(request, [image])
  })
}

const rememberTile = (key: string, elevations: Float32Array): void => {
  tileCache.set(key, elevations)
  while (tileCache.size > MAX_CACHED_TILES) {
    const oldest = tileCache.keys().next().value
    if (oldest === undefined) break
    tileCache.delete(oldest)
  }
}

/**
 * Points the service at the configured model. Tiles are keyed by source, so switching keeps what
 * every source already loaded.
 * @param {TerrainServiceConfig} next Configuration to use from now on.
 */
export const configureTerrainService = (next: TerrainServiceConfig): void => {
  config = { ...next }
}

/**
 * Forgets the decoded tiles and the sources found unreachable, so the next samples read every tile
 * again. Tiles kept for offline use stay stored.
 */
export const reloadTerrainTiles = (): void => {
  tileCache.clear()
  unreachableUntilMs.clear()
}

/**
 * Whether a source can be read in this build.
 * @param {TerrainSourceId} sourceId Source to check.
 * @param {string} customUrlTemplate Custom tile address, defaulting to the configured one.
 * @returns {boolean} False for Standalone-only sources in Cockpit Lite, and for a custom source without a usable address.
 */
export const isTerrainSourceAvailable = (
  sourceId: TerrainSourceId,
  customUrlTemplate = config.customUrlTemplate
): boolean => {
  if (sourceId === 'custom') return isValidTileUrlTemplate(customUrlTemplate)
  return !TERRAIN_SOURCES[sourceId].standaloneOnly || (isElectron() && !!window.electronAPI?.getCopernicusTerrainTile)
}

/**
 * Source actually read for a requested one. Settings sync between computers, so a Standalone-only
 * choice can reach Cockpit Lite, which then reads Tilezen instead of nothing at all.
 * @param {TerrainSourceId} sourceId Requested source.
 * @param {string} customUrlTemplate Custom tile address, defaulting to the configured one.
 * @returns {TerrainSourceId} The requested source, or Tilezen when it cannot be read here.
 */
export const effectiveTerrainSource = (
  sourceId: TerrainSourceId,
  customUrlTemplate = config.customUrlTemplate
): TerrainSourceId => (isTerrainSourceAvailable(sourceId, customUrlTemplate) ? sourceId : 'tilezen')

/**
 * Deepest zoom a source publishes, with the custom source's own limit.
 * @param {TerrainSourceId | BathymetryTileSourceId} sourceId Source to check.
 * @returns {number} The zoom level.
 */
export const terrainSourceMaxZoom = (sourceId: TerrainSourceId | BathymetryTileSourceId): number => {
  if (isBathymetryTileSource(sourceId)) return BATHYMETRY_TILE_MAX_ZOOM[sourceId]
  return sourceId === 'custom' ? config.customMaxZoom : TERRAIN_SOURCES[sourceId].maxZoom
}

/**
 * Attribution for the terrain actually read, with the bathymetry read under water.
 * @returns {string} The attribution their licences require.
 */
export const terrainAttribution = (): string =>
  [
    TERRAIN_SOURCES[effectiveTerrainSource(config.sourceId)].attribution,
    bathymetryAttribution(config.bathymetrySourceId),
  ]
    .filter(Boolean)
    .join('. ')

const tileUrl = (sourceId: Exclude<TerrainTileSourceId, 'copernicus'>, tile: TerrainTile): string => {
  if (isBathymetryTileSource(sourceId)) {
    checkBathymetryOnce()
    return bathymetryTileUrl(sourceId, tile)
  }
  return terrainTileUrl(sourceId, tile, config.customUrlTemplate)
}

const readTileImage = async (sourceId: TerrainTileSourceId, tile: TerrainTile): Promise<Blob> => {
  if (sourceId === 'copernicus') {
    if (!isTerrainSourceAvailable('copernicus')) throw new Error('The Copernicus model needs Cockpit Standalone.')
    checkCopernicusLatticeOnce()
    const bytes = await window.electronAPI!.getCopernicusTerrainTile(tile.z, tile.x, tile.y)
    return new Blob([bytes], { type: 'image/png' })
  }
  const response = await fetch(tileUrl(sourceId, tile), { signal: AbortSignal.timeout(TILE_FETCH_TIMEOUT_MS) })
  // A refused or missing tile is not flat ground or open water, so it is an error rather than a zero.
  if (!response.ok) throw new HttpTileError(response.status)
  const image = await response.blob()
  // A captive portal or proxy answers with a page, and a coverage service with an error document, which would
  // otherwise be stored as the tile.
  const signatures = TILE_SIGNATURES[tileFormat(sourceId)]
  const head = new Uint8Array(await image.slice(0, 8).arrayBuffer())
  if (!signatures.some((signature) => signature.every((byte, index) => head[index] === byte))) {
    throw new Error(`The answer was not a ${tileFormat(sourceId) === 'geotiff' ? 'GeoTIFF' : 'PNG'} tile.`)
  }
  return image
}

const fetchTileImage = async (sourceId: TerrainTileSourceId, tile: TerrainTile): Promise<Blob> => {
  if (Date.now() < (unreachableUntilMs.get(sourceId) ?? 0)) throw new Error('The terrain source is unreachable.')
  try {
    return await readTileImage(sourceId, tile)
  } catch (error) {
    // Without internet every tile would wait for its own timeout, so a source that cannot be reached is
    // skipped for a while and only the stored tiles are read.
    if (!(error instanceof HttpTileError)) unreachableUntilMs.set(sourceId, Date.now() + UNREACHABLE_BACKOFF_MS)
    throw error
  }
}

/**
 * Fetches a tile and keeps it in the persistent cache, without decoding it, for offline use.
 * @param {TerrainTileSourceId} sourceId Source of the tile.
 * @param {TerrainTile} tile Tile to keep.
 * @returns {Promise<void>}
 */
export const prefetchTerrainTile = async (sourceId: TerrainTileSourceId, tile: TerrainTile): Promise<void> => {
  const key = terrainSourceTileKey(sourceId, tile, config.customUrlTemplate)
  if (await readStoredTerrainTile(key)) return
  // Read without the unreachable backoff, so one slow tile does not fail the rest of the download.
  await storeTerrainTile(key, await readTileImage(sourceId, tile))
}

const loadTile = (sourceId: TerrainTileSourceId, tile: TerrainTile): Promise<Float32Array> => {
  const key = terrainSourceTileKey(sourceId, tile, config.customUrlTemplate)
  const cached = tileCache.get(key)
  if (cached) return Promise.resolve(cached)

  const running = inFlight.get(key)
  if (running) return running

  const promise = (async () => {
    const stored = await readStoredTerrainTile(key)
    const image = stored ?? (await fetchTileImage(sourceId, tile))
    const elevations = await decodeTile(await image.arrayBuffer(), tile, tileFormat(sourceId)).catch((error) => {
      if (stored) void removeStoredTerrainTile(key)
      throw error
    })
    if (!stored) void storeTerrainTile(key, image)
    rememberTile(key, elevations)
    return elevations
  })().finally(() => inFlight.delete(key))

  inFlight.set(key, promise)
  return promise
}

const combineCorners = (values: number[], fx: number, fy: number, mode: TerrainSampleMode): number => {
  if (mode === 'highest') return Math.max(...values)
  const [northWest, northEast, southWest, southEast] = values
  const north = northWest + (northEast - northWest) * fx
  const south = southWest + (southEast - southWest) * fx
  return north + (south - north) * fy
}

type SampleLookup = {
  /**
   * Pixels to read: the nearest one, or the four lattice corners around the point.
   */
  targets: TerrainSampleTarget[]
  /**
   * Position between the west and east corners, from 0 to 1.
   */
  fx: number
  /**
   * Position between the north and south corners, from 0 to 1.
   */
  fy: number
}

const sampleTileSource = async (
  sourceId: TerrainTileSourceId,
  coordinates: WaypointCoordinates[],
  zoom: number,
  mode: TerrainSampleMode
): Promise<(number | null)[]> => {
  const lookups: SampleLookup[] = coordinates.map((coordinate) => {
    if (mode === 'nearest') return { targets: [terrainSampleTarget(coordinate, zoom)], fx: 0, fy: 0 }
    const cell = terrainLatticeCell(coordinate, zoom)
    return { targets: cell.corners, fx: cell.fx, fy: cell.fy }
  })

  const tilesByKey = new Map<string, TerrainTile>()
  lookups.forEach(({ targets }) =>
    targets.forEach(({ tile }) => tilesByKey.set(terrainSourceTileKey(sourceId, tile), tile))
  )

  const loaded = new Map<string, Float32Array>()
  await Promise.all(
    [...tilesByKey].map(async ([key, tile]) => {
      try {
        loaded.set(key, await loadTile(sourceId, tile))
      } catch (error) {
        // One missing tile leaves its own samples unknown; the rest are still worth having, so the
        // failure is not propagated.
        console.warn(`Could not load the elevation tile ${key}:`, error)
      }
    })
  )

  return lookups.map(({ targets, fx, fy }) => {
    const values: number[] = []
    for (const { tile, index } of targets) {
      const value = loaded.get(terrainSourceTileKey(sourceId, tile))?.[index]
      if (value === undefined) return null
      if (value !== TERRARIUM_NO_DATA_M) values.push(value)
    }
    if (values.length === 0) return null
    if (values.length < targets.length && mode === 'bilinear') return values.reduce((a, b) => a + b) / values.length
    return values.length === 1 ? values[0] : combineCorners(values, fx, fy, mode)
  })
}

// Each model fills only what the ones before it left without a depth, so a regional model's gaps and a
// provider that cannot be reached fall through to the next one.
const sampleBathymetry = async (
  coordinates: WaypointCoordinates[],
  zoom: number,
  mode: TerrainSampleMode
): Promise<(number | null)[]> => {
  const depths: (number | null)[] = coordinates.map(() => null)
  for (const layer of bathymetryLayers(config.bathymetrySourceId)) {
    const pending = depths.flatMap((depth, index) => {
      const [lat, lon] = coordinates[index]
      return depth === null && bathymetryLayerCovers(layer, lat, lon) ? [index] : []
    })
    if (pending.length === 0) continue
    const { layerId } = layer
    const layerZoom = Math.min(zoom, terrainSourceMaxZoom(layerId))
    const read = await sampleTileSource(
      layerId,
      pending.map((index) => coordinates[index]),
      layerZoom,
      mode
    )
    pending.forEach((index, position) => {
      const depth = read[position]
      if (depth !== null && depth < 0) depths[index] = depth
    })
  }
  return depths
}

const sampleLand = async (
  sourceId: TerrainSourceId,
  coordinates: WaypointCoordinates[],
  zoom: number,
  mode: TerrainSampleMode
): Promise<(number | null)[]> => {
  // Below the Copernicus model's shallowest zoom a tile spans dozens of its files, so coarse
  // requests read Tilezen, whose own coarse tiles are a resampling of the same kind of data.
  if (zoom < TERRAIN_SOURCES[sourceId].minZoom) return sampleTileSource('tilezen', coordinates, zoom, mode)
  const land = await sampleTileSource(sourceId, coordinates, zoom, mode)
  if (sourceId !== 'copernicus') return land
  const unreadIndices = land.flatMap((value, index) => (value === null ? [index] : []))
  if (unreadIndices.length === 0) return land
  const fallback = await sampleTileSource(
    'tilezen',
    unreadIndices.map((index) => coordinates[index]),
    zoom,
    mode
  )
  unreadIndices.forEach((index, position) => (land[index] = fallback[position]))
  return land
}

const sampleModel = async (
  sourceId: TerrainSourceId,
  coordinates: WaypointCoordinates[],
  requestedZoom: number | undefined,
  mode: TerrainSampleMode,
  seabedOnly: boolean
): Promise<(number | null)[]> => {
  const zoom = Math.min(requestedZoom ?? terrainSourceMaxZoom(sourceId), terrainSourceMaxZoom(sourceId))
  const land = await sampleLand(sourceId, coordinates, zoom, mode)
  const seaIndices = land.flatMap((value, index) => (value !== null && value <= 0 ? [index] : []))
  const depths = await sampleBathymetry(
    seaIndices.map((index) => coordinates[index]),
    zoom,
    mode
  )
  // Copernicus reads the sea as exactly 0 m, and Tilezen often does near the coast, so a zero no bathymetry
  // replaces is open water of unknown depth rather than a seabed at the surface.
  seaIndices.forEach((index, position) => {
    const height = land[index]
    land[index] = depths[position] ?? (height === 0 && seabedOnly ? null : height)
  })
  return land
}

/**
 * Samples the ground elevation under each coordinate, in meters above sea level, below it for the
 * sea floor. Positions whose tile could not be loaded come back as `null` rather than as a guess.
 * @param {WaypointCoordinates[]} coordinates Positions to sample, as `[latitude, longitude]`.
 * @param {TerrainSampleOptions} options How to sample them.
 * @returns {Promise<(number | null)[]>} One height per coordinate, in the same order.
 */
export const sampleTerrain = async (
  coordinates: WaypointCoordinates[],
  options: TerrainSampleOptions = {}
): Promise<(number | null)[]> => {
  if (coordinates.length === 0) return []
  const sourceId = effectiveTerrainSource(options.sourceId ?? config.sourceId)
  return sampleModel(sourceId, coordinates, options.zoom, options.mode ?? 'nearest', options.seabedOnly ?? false)
}
