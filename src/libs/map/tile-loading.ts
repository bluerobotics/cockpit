import { openDB } from 'idb'

import {
  type NoiseTileOptions,
  type TileCoordinates,
  generateNoiseTileDataUrl,
  looksLikeProviderPlaceholder,
} from '@/libs/map/map-tile-fallback'
import type { TileArchiveSource } from '@/libs/map/tile-archive'

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
export interface TileLoadOptions {
  /** Values for the template's `{s}` placeholder, rotated across tiles as Leaflet did. */
  subdomains?: string[]
  /** Noise fallback drawn when a tile fails or is a provider placeholder. Omit to leave failed tiles empty. */
  fallback?: NoiseTileOptions
  /** Display adjustments applied to each tile. */
  adjustments?: TileDisplayAdjustments
}

const isNeutral = (adjustments?: TileDisplayAdjustments): boolean =>
  !adjustments || (adjustments.brightness === 1 && adjustments.contrast === 1)

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

const archiveSources = new Map<string, () => Promise<TileArchiveSource>>()

/**
 * Makes an archive's tiles reachable through {@link loadArchiveTile}.
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

// The database leaflet.offline created, kept as is so tiles users saved before the move to Cesium keep working.
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

// WebGL ignores Cesium's flip on upload for decoded bitmaps, so tiles are decoded upside down, as Cesium decodes its own.
const decodeTile = (blob: Blob): Promise<ImageBitmap> => createImageBitmap(blob, { imageOrientation: 'flipY' })

// A transparent tile, for tiles with no content, so Cesium draws nothing rather than retrying them.
const emptyTile = (): ImageBitmap => new OffscreenCanvas(1, 1).transferToImageBitmap()

const noiseTile = async (coords: TileCoordinates, fallback: NoiseTileOptions): Promise<ImageBitmap> => {
  const dataUrl = generateNoiseTileDataUrl(coords, fallback)
  if (!dataUrl) return emptyTile()
  return decodeTile(await (await fetch(dataUrl)).blob())
}

const adjustTile = (image: ImageBitmap, adjustments: TileDisplayAdjustments): ImageBitmap => {
  const canvas = new OffscreenCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')!
  ctx.filter = `brightness(${adjustments.brightness}) contrast(${adjustments.contrast})`
  ctx.drawImage(image, 0, 0)
  image.close()
  return canvas.transferToImageBitmap()
}

// Turns a fetched tile into what Cesium draws, swapping in the noise fallback for placeholders and applying the
// display adjustments.
const finishTile = async (
  blob: Blob,
  coords: TileCoordinates,
  fallback?: NoiseTileOptions,
  adjustments?: TileDisplayAdjustments
): Promise<ImageBitmap> => {
  const image = await decodeTile(blob)
  if (fallback && looksLikeProviderPlaceholder(image)) {
    image.close()
    return noiseTile(coords, fallback)
  }
  return isNeutral(adjustments) ? image : adjustTile(image, adjustments!)
}

/**
 * Loads one tile of a URL-template layer: from the offline cache when saved, else from the network, with the noise
 * fallback for failed or placeholder tiles and the display adjustments applied.
 * @param {string} template - The layer's URL template.
 * @param {TileCoordinates} coords - The tile to load.
 * @param {TileLoadOptions} [options] - Subdomains, fallback and adjustments.
 * @returns {Promise<ImageBitmap>} The tile image.
 */
export const loadTemplateTile = async (
  template: string,
  coords: TileCoordinates,
  options: TileLoadOptions = {}
): Promise<ImageBitmap> => {
  const { subdomains = [], fallback, adjustments } = options
  const saved = await readOfflineTile(fillTileTemplate(template, coords, subdomains[0]))
  if (saved) return finishTile(saved, coords, undefined, adjustments)

  let response: Response
  try {
    response = await fetch(fillTileTemplate(template, coords, subdomainFor(coords, subdomains)), {
      // Required by the OSM tile usage policy: tiles requested without a Referer are blocked (403R).
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  } catch (error) {
    if (!fallback) throw error
    return noiseTile(coords, fallback)
  }

  if (!response.ok) {
    if (fallback) return noiseTile(coords, fallback)
    // Overlays answer "nothing here" with 404s; an empty tile keeps those out of the error log.
    if (response.status === 404) return emptyTile()
    throw new Error(`Tile request failed with status ${response.status}`)
  }
  return finishTile(await response.blob(), coords, fallback, adjustments)
}

/**
 * Loads one tile of a registered archive source, empty where the archive has none.
 * @param {string} token - The token the source was registered under.
 * @param {TileCoordinates} coords - The tile to load.
 * @param {TileDisplayAdjustments} [adjustments] - Display adjustments applied to the tile.
 * @returns {Promise<ImageBitmap>} The tile image.
 */
export const loadArchiveTile = async (
  token: string,
  coords: TileCoordinates,
  adjustments?: TileDisplayAdjustments
): Promise<ImageBitmap> => {
  const sourceProvider = archiveSources.get(token)
  if (!sourceProvider) return emptyTile()
  const blob = await (await sourceProvider()).getTile(coords.z, coords.x, coords.y)
  if (!blob) return emptyTile()
  return finishTile(blob, coords, undefined, adjustments)
}
