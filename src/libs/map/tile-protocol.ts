import { openDB } from 'idb'
import { type GetResourceResponse, type RequestParameters, addProtocol } from 'maplibre-gl'

import {
  type NoiseTileOptions,
  type TileCoordinates,
  generateNoiseTileDataUrl,
  looksLikeProviderPlaceholder,
} from '@/libs/map/map-tile-fallback'
import type { TileArchiveSource } from '@/libs/map/tile-archive'

const tileProtocol = 'cockpit-tile'
const archiveProtocol = 'cockpit-archive'

// MapLibre fills these in before the request reaches the protocol handler.
const tileCoordinatePlaceholders = '{z}/{x}/{y}'

/**
 * Brightness and contrast applied to every tile of a layer, with CSS filter semantics (1 leaves the tile unchanged).
 */
export interface TileDisplayAdjustments {
  /** Brightness multiplier. */
  brightness: number
  /** Contrast multiplier. */
  contrast: number
}

/**
 * How a URL-template layer loads its tiles.
 */
export interface TileProtocolOptions {
  /** Values for the template's `{s}` placeholder, rotated across tiles as Leaflet did. */
  subdomains?: string[]
  /** Noise fallback drawn when a tile fails or is a provider placeholder. Omit to leave failed tiles empty. */
  fallback?: NoiseTileOptions
  /** Display adjustments applied to each tile. */
  adjustments?: TileDisplayAdjustments
}

// A 1x1 transparent PNG, returned for tiles with no content so MapLibre draws nothing rather than logging an error.
const transparentTile = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (char) => char.charCodeAt(0)
).buffer

const isNeutral = (adjustments?: TileDisplayAdjustments): boolean =>
  !adjustments || (adjustments.brightness === 1 && adjustments.contrast === 1)

const encodeFallback = (fallback: NoiseTileOptions): string =>
  [fallback.seed, fallback.baseColor, fallback.intensity ?? 0.3].map(String).join(',')

const decodeFallback = (encoded: string | null): NoiseTileOptions | undefined => {
  if (!encoded) return undefined
  const [seed, baseColor, intensity] = encoded.split(',')
  return { seed: Number(seed), baseColor, intensity: Number(intensity) }
}

const encodeAdjustments = (adjustments: TileDisplayAdjustments): string =>
  `${adjustments.brightness},${adjustments.contrast}`

const decodeAdjustments = (encoded: string | null): TileDisplayAdjustments | undefined => {
  if (!encoded) return undefined
  const [brightness, contrast] = encoded.split(',').map(Number)
  return { brightness, contrast }
}

/**
 * Fills a tile URL template the way Leaflet did, so URLs (and the offline-cache keys derived from them) stay the same.
 * @param {string} template - The URL template with `{z}`, `{x}`, `{y}` and optionally `{s}`, `{r}`, `{-y}` or
 *   `{bbox-epsg-3857}` placeholders.
 * @param {TileCoordinates} coords - The tile to address.
 * @param {string} [subdomain] - The value for `{s}`.
 * @returns {string} The tile URL.
 */
export const fillTileTemplate = (template: string, coords: TileCoordinates, subdomain = ''): string =>
  template
    .replace(/\{z\}/g, String(coords.z))
    .replace(/\{x\}/g, String(coords.x))
    .replace(/\{y\}/g, String(coords.y))
    .replace(/\{-y\}/g, String(2 ** coords.z - 1 - coords.y))
    .replace(/\{s\}/g, subdomain)
    .replace(/\{r\}/g, (globalThis.devicePixelRatio ?? 1) > 1 ? '@2x' : '')
    .replace(/\{bbox-epsg-3857\}/g, () => webMercatorTileBbox(coords).join(','))

// Half the Web Mercator world width, in meters.
const webMercatorHalfWorld = Math.PI * 6378137

// Tile bounds in Web Mercator meters as minX, minY, maxX, maxY, which is what WMS servers take as the tile's bbox.
const webMercatorTileBbox = (coords: TileCoordinates): [number, number, number, number] => {
  const size = (2 * webMercatorHalfWorld) / 2 ** coords.z
  const minX = -webMercatorHalfWorld + coords.x * size
  const maxY = webMercatorHalfWorld - coords.y * size
  return [minX, maxY - size, minX + size, maxY]
}

const subdomainFor = (coords: TileCoordinates, subdomains: string[] = []): string =>
  subdomains.length ? subdomains[Math.abs(coords.x + coords.y) % subdomains.length] : ''

/**
 * Tile URL a layer declares to MapLibre for a URL template, routed through Cockpit's tile loader.
 * @param {string} template - The provider's URL template.
 * @param {TileProtocolOptions} [options] - Subdomains, fallback and adjustments.
 * @returns {string} The URL to put in a raster source's `tiles`.
 */
export const tileProtocolUrl = (template: string, options: TileProtocolOptions = {}): string => {
  const query = new URLSearchParams({ t: template })
  if (options.subdomains?.length) query.set('s', options.subdomains.join(','))
  if (options.fallback) query.set('fb', encodeFallback(options.fallback))
  if (!isNeutral(options.adjustments)) query.set('f', encodeAdjustments(options.adjustments!))
  return `${tileProtocol}://${tileCoordinatePlaceholders}?${query.toString()}`
}

/**
 * Tile URL a layer declares to MapLibre for a registered archive source.
 * @param {string} token - The token the source was registered under.
 * @param {TileDisplayAdjustments} [adjustments] - Display adjustments applied to each tile.
 * @returns {string} The URL to put in a raster source's `tiles`.
 */
export const archiveProtocolUrl = (token: string, adjustments?: TileDisplayAdjustments): string => {
  const query = isNeutral(adjustments) ? '' : `?f=${encodeAdjustments(adjustments!)}`
  return `${archiveProtocol}://${encodeURIComponent(token)}/${tileCoordinatePlaceholders}${query}`
}

const archiveSources = new Map<string, () => Promise<TileArchiveSource>>()

/**
 * Makes an archive's tiles reachable through {@link archiveProtocolUrl}.
 * @param {string} token - A token unique to the layer drawing the archive.
 * @param {() => Promise<TileArchiveSource>} sourceProvider - Resolves the archive, lazily, on the first tile request.
 * @returns {() => void} Unregisters the source.
 */
export const registerArchiveSource = (
  token: string,
  sourceProvider: () => Promise<TileArchiveSource>
): (() => void) => {
  archiveSources.set(token, sourceProvider)
  return () => {
    archiveSources.delete(token)
  }
}

// The database leaflet.offline created, kept as is so tiles users saved before the move to MapLibre keep working.
const offlineDatabaseName = 'leaflet.offline'
const offlineTileStore = 'tileStore'

/**
 * A tile saved for offline use, as leaflet.offline stored it.
 */
export interface OfflineTileInfo {
  /** The tile URL with the first subdomain, which is the record key. */
  key: string
  /** The URL the tile is downloaded from. */
  url: string
  /** The layer's URL template. */
  urlTemplate: string
  /** Column. */
  x: number
  /** Row. */
  y: number
  /** Zoom, on the tile scale. */
  z: number
  /** When the record was created, in epoch milliseconds. */
  createdAt: number
}

let offlineDatabase: ReturnType<typeof openDB> | undefined

const openOfflineDatabase = (): ReturnType<typeof openDB> => {
  offlineDatabase =
    offlineDatabase ??
    openDB(offlineDatabaseName, 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(offlineTileStore, { keyPath: 'key' })
          store.createIndex('urlTemplate', 'urlTemplate')
          store.createIndex('z', 'z')
        }
      },
    })
  return offlineDatabase
}

/**
 * Whether a tile is already saved for offline use.
 * @param {string} key - The tile's offline key.
 * @returns {Promise<boolean>} True when it is stored.
 */
export const hasOfflineTile = async (key: string): Promise<boolean> =>
  (await (await openOfflineDatabase()).getKey(offlineTileStore, key)) !== undefined

/**
 * Saves a downloaded tile for offline use.
 * @param {OfflineTileInfo} info - The tile record.
 * @param {Blob} blob - The tile image.
 */
export const saveOfflineTile = async (info: OfflineTileInfo, blob: Blob): Promise<void> => {
  await (await openOfflineDatabase()).put(offlineTileStore, { ...info, blob })
}

const readOfflineTile = async (key: string): Promise<Blob | undefined> => {
  try {
    const record = await (await openOfflineDatabase()).get(offlineTileStore, key)
    return record?.blob
  } catch (error) {
    // An unavailable database (private window, blocked storage) only means no tile is saved.
    return undefined
  }
}

/**
 * The tiles covering bounds at each zoom from `fromZoom` to `toZoom`, as leaflet.offline enumerated them.
 * @param {string} template - The layer's URL template.
 * @param {[[number, number], [number, number]]} bounds - `[[north, west], [south, east]]` in degrees.
 * @param {number} fromZoom - First zoom, on the tile scale.
 * @param {number} toZoom - Last zoom, on the tile scale.
 * @param {string[]} [subdomains] - The layer's `{s}` values.
 * @returns {OfflineTileInfo[]} The tiles to save.
 */
export const offlineTilesInBounds = (
  template: string,
  bounds: [[number, number], [number, number]],
  fromZoom: number,
  toZoom: number,
  subdomains: string[] = []
): OfflineTileInfo[] => {
  const [[north, west], [south, east]] = bounds
  const tiles: OfflineTileInfo[] = []
  const createdAt = Date.now()
  for (let z = fromZoom; z <= toZoom; z++) {
    const [minX, minY] = worldTileAt(north, west, z)
    const [maxX, maxY] = worldTileAt(south, east, z)
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const coords = { x, y, z }
        tiles.push({
          key: fillTileTemplate(template, coords, subdomains[0]),
          url: fillTileTemplate(template, coords, subdomainFor(coords, subdomains)),
          urlTemplate: template,
          x,
          y,
          z,
          createdAt,
        })
      }
    }
  }
  return tiles
}

// Tile column and row under a coordinate at a zoom, on the Web Mercator grid.
const worldTileAt = (latitude: number, longitude: number, zoom: number): [number, number] => {
  const scale = 2 ** zoom
  const maxLatitude = 85.0511287798
  const sinLatitude = Math.sin((Math.max(Math.min(latitude, maxLatitude), -maxLatitude) * Math.PI) / 180)
  const x = ((longitude + 180) / 360) * scale
  const y = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale
  return [Math.floor(x), Math.floor(y)]
}

const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer =>
  Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (char) => char.charCodeAt(0)).buffer

const noiseTile = (coords: TileCoordinates, fallback: NoiseTileOptions): ArrayBuffer => {
  const dataUrl = generateNoiseTileDataUrl(coords, fallback)
  return dataUrl ? dataUrlToArrayBuffer(dataUrl) : transparentTile
}

const adjustTile = async (image: ImageBitmap, adjustments: TileDisplayAdjustments): Promise<ArrayBuffer> => {
  const canvas = new OffscreenCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')!
  ctx.filter = `brightness(${adjustments.brightness}) contrast(${adjustments.contrast})`
  ctx.drawImage(image, 0, 0)
  return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
}

// Turns a fetched tile into what MapLibre receives, swapping in the noise fallback for placeholders and applying the
// display adjustments. Tiles needing neither are passed through without decoding.
const finishTile = async (
  blob: Blob,
  coords: TileCoordinates,
  fallback?: NoiseTileOptions,
  adjustments?: TileDisplayAdjustments
): Promise<ArrayBuffer> => {
  if (!fallback && isNeutral(adjustments)) return blob.arrayBuffer()
  const image = await createImageBitmap(blob)
  try {
    if (fallback && looksLikeProviderPlaceholder(image)) return noiseTile(coords, fallback)
    return isNeutral(adjustments) ? await blob.arrayBuffer() : await adjustTile(image, adjustments!)
  } finally {
    image.close()
  }
}

const parseTileCoordinates = (path: string[]): TileCoordinates => {
  const [z, x, y] = path.slice(-3).map(Number)
  return { z, x, y }
}

const loadUrlTile = async (
  request: RequestParameters,
  abortController: AbortController
): Promise<GetResourceResponse<ArrayBuffer>> => {
  const url = new URL(request.url)
  const coords = parseTileCoordinates(`${url.host}${url.pathname}`.split('/').filter(Boolean))
  const template = url.searchParams.get('t') ?? ''
  const subdomains = url.searchParams.get('s')?.split(',') ?? []
  const fallback = decodeFallback(url.searchParams.get('fb'))
  const adjustments = decodeAdjustments(url.searchParams.get('f'))

  const saved = await readOfflineTile(fillTileTemplate(template, coords, subdomains[0]))
  if (saved) return { data: await finishTile(saved, coords, undefined, adjustments) }

  let response: Response
  try {
    response = await fetch(fillTileTemplate(template, coords, subdomainFor(coords, subdomains)), {
      signal: abortController.signal,
      // Required by the OSM tile usage policy: tiles requested without a Referer are blocked (403R).
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  } catch (error) {
    if (abortController.signal.aborted || !fallback) throw error
    return { data: noiseTile(coords, fallback) }
  }

  if (!response.ok) {
    if (fallback) return { data: noiseTile(coords, fallback) }
    // Overlays answer "nothing here" with 404s; an empty tile keeps those out of the error log.
    if (response.status === 404) return { data: transparentTile }
    throw new Error(`Tile request failed with status ${response.status}`)
  }
  return { data: await finishTile(await response.blob(), coords, fallback, adjustments) }
}

const loadArchiveTile = async (request: RequestParameters): Promise<GetResourceResponse<ArrayBuffer>> => {
  const url = new URL(request.url)
  const path = `${url.host}${url.pathname}`.split('/').filter(Boolean)
  const sourceProvider = archiveSources.get(decodeURIComponent(path[0]))
  if (!sourceProvider) return { data: transparentTile }
  const coords = parseTileCoordinates(path)
  const blob = await (await sourceProvider()).getTile(coords.z, coords.x, coords.y)
  if (!blob) return { data: transparentTile }
  return { data: await finishTile(blob, coords, undefined, decodeAdjustments(url.searchParams.get('f'))) }
}

let protocolsRegistered = false

/**
 * Registers the tile loaders every Cockpit map draws its raster tiles through. Protocols are global to MapLibre, so
 * this runs once however many maps are mounted.
 */
export const registerTileProtocols = (): void => {
  if (protocolsRegistered) return
  protocolsRegistered = true
  addProtocol(tileProtocol, loadUrlTile)
  addProtocol(archiveProtocol, loadArchiveTile)
}
