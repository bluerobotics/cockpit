import { type Entry, BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js'
import type { SqlJsStatic } from 'sql.js'
import { v4 as uuid } from 'uuid'

import type { CustomTileArchiveFormat, MapOverlayBounds } from '@/types/mission'

/**
 * A uniform, format-agnostic view over a tile archive. Callers pull individual `{z}/{x}/{y}` tiles without
 * caring whether the backing container is a ZIP of images, an MBTiles sqlite database, or a PMTiles file.
 */
export interface TileArchiveSource {
  /**
   * Container format this source was opened from.
   */
  format: CustomTileArchiveFormat
  /**
   * Lowest zoom level with tiles.
   */
  minZoom: number
  /**
   * Highest zoom level with tiles.
   */
  maxZoom: number
  /**
   * WGS84 bounds of the tile coverage, when derivable from the archive.
   */
  bounds?: MapOverlayBounds
  /**
   * Returns the image bytes for a tile in XYZ (Google/OSM) convention, or `undefined` when absent.
   */
  getTile: (z: number, x: number, y: number) => Promise<Blob | undefined>
  /**
   * Releases any resources held by the source (e.g. the sqlite database).
   */
  close: () => void
}

/**
 * Error whose message is already written for the operator, so `openTileArchive` passes it through instead of
 * replacing it with its generic per-format wording.
 */
class ArchiveContentError extends Error {}

const mimeForExtension = (extension: string): string => {
  const normalized = extension.toLowerCase()
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg'
  if (normalized === 'webp') return 'image/webp'
  return 'image/png'
}

const tileToLon = (x: number, z: number): number => (x / 2 ** z) * 360 - 180

const tileToLat = (y: number, z: number): number => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

const boundsFromTileExtent = (z: number, minX: number, maxX: number, minY: number, maxY: number): MapOverlayBounds => {
  const west = tileToLon(minX, z)
  const east = tileToLon(maxX + 1, z)
  const north = tileToLat(minY, z)
  const south = tileToLat(maxY + 1, z)
  return [
    [south, west],
    [north, east],
  ]
}

/**
 * A single tile file located inside a ZIP archive.
 */
interface ZipTileEntry {
  /**
   * The archive entry, whose bytes are read only when the tile is requested.
   */
  entry: Entry
  /**
   * Image file extension (png/jpg/jpeg/webp).
   */
  extension: string
}

/**
 * The tile-column and tile-row extent covering all tiles present at one zoom level.
 */
interface TileZoomExtent {
  /**
   * Lowest tile column (x) present at this zoom.
   */
  minX: number
  /**
   * Highest tile column (x) present at this zoom.
   */
  maxX: number
  /**
   * Lowest tile row (y) present at this zoom.
   */
  minY: number
  /**
   * Highest tile row (y) present at this zoom.
   */
  maxY: number
}

const openZipTileSource = async (blob: Blob): Promise<TileArchiveSource> => {
  // Reading the central directory only, so tile bytes are inflated on demand rather than held for the archive.
  const reader = new ZipReader(new BlobReader(blob))
  const entries = await reader.getEntries()

  const tilePattern = /(?:^|\/)(\d+)\/(\d+)\/(\d+)\.(png|jpe?g|webp)$/i
  const index = new Map<string, ZipTileEntry>()
  let minZoom = Infinity
  let maxZoom = -Infinity
  const tilesByZoom = new Map<number, TileZoomExtent>()

  for (const entry of entries) {
    if (entry.directory) continue
    const match = entry.filename.match(tilePattern)
    if (!match) continue
    const z = Number(match[1])
    const x = Number(match[2])
    const y = Number(match[3])
    index.set(`${z}/${x}/${y}`, { entry, extension: match[4] })
    minZoom = Math.min(minZoom, z)
    maxZoom = Math.max(maxZoom, z)
    const extent = tilesByZoom.get(z) ?? { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    extent.minX = Math.min(extent.minX, x)
    extent.maxX = Math.max(extent.maxX, x)
    extent.minY = Math.min(extent.minY, y)
    extent.maxY = Math.max(extent.maxY, y)
    tilesByZoom.set(z, extent)
  }

  if (index.size === 0) {
    await reader.close()
    throw new ArchiveContentError('No {z}/{x}/{y} tiles found in the ZIP archive.')
  }

  // The deepest zoom gives the tightest coverage: one tile at a coarse zoom spans hundreds of kilometres, so
  // framing the map on a coarse extent would fly far outside the area the archive actually holds.
  const boundsExtent = tilesByZoom.get(maxZoom)
  const bounds = boundsExtent
    ? boundsFromTileExtent(maxZoom, boundsExtent.minX, boundsExtent.maxX, boundsExtent.minY, boundsExtent.maxY)
    : undefined

  return {
    format: 'zip',
    minZoom,
    maxZoom,
    bounds,
    getTile: async (z, x, y) => {
      const tile = index.get(`${z}/${x}/${y}`)
      if (!tile?.entry.getData) return undefined
      return await tile.entry.getData(new BlobWriter(mimeForExtension(tile.extension)))
    },
    close: () => void reader.close(),
  }
}

// The MBTiles metadata table is free-form text, so a missing or non-numeric zoom falls back to the tiles table.
// A zoom range has to come out finite: it becomes the layer's `maxNativeZoom`, which is what keeps Leaflet from
// requesting tiles the archive does not hold.
const firstFiniteZoom = (...candidates: unknown[]): number => {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') continue
    const zoom = Number(candidate)
    if (Number.isFinite(zoom)) return zoom
  }
  return 0
}

let sqlJsPromise: Promise<SqlJsStatic> | undefined

const loadSqlJs = async (): Promise<SqlJsStatic> => {
  const { default: initSqlJs } = await import('sql.js')
  const { default: wasmUrl } = await import('sql.js/dist/sql-wasm.wasm?url')
  return initSqlJs({ locateFile: () => wasmUrl })
}

const openMbtilesTileSource = async (blob: Blob): Promise<TileArchiveSource> => {
  // Forget a failed load so a later archive retries it instead of inheriting the first failure forever.
  sqlJsPromise =
    sqlJsPromise ??
    loadSqlJs().catch((error) => {
      sqlJsPromise = undefined
      throw error
    })
  const SQL = await sqlJsPromise
  // ponytail: sql.js has no range reader, so the whole database is copied into the wasm heap and a regional
  // export of a few hundred MB will exhaust it. Upgrading means serving MBTiles range reads from the vehicle
  // (as PMTiles already does through FileSource) instead of opening the file in the browser.
  const database = new SQL.Database(new Uint8Array(await blob.arrayBuffer()))

  try {
    const metadata = new Map<string, string>()
    const metadataResult = database.exec('SELECT name, value FROM metadata')
    for (const row of metadataResult[0]?.values ?? []) {
      metadata.set(String(row[0]), String(row[1]))
    }

    const format = metadata.get('format')?.toLowerCase()
    if (format === 'pbf' || format === 'mvt') {
      throw new ArchiveContentError('This MBTiles file holds vector tiles, which are not supported as a map.')
    }
    const mime = mimeForExtension(format ?? 'png')

    const zoomResult = database.exec('SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles')
    const zoomRow = zoomResult[0]?.values?.[0]
    const minZoom = firstFiniteZoom(metadata.get('minzoom'), zoomRow?.[0])
    const maxZoom = firstFiniteZoom(metadata.get('maxzoom'), zoomRow?.[1])

    let bounds: MapOverlayBounds | undefined
    const boundsMeta = metadata.get('bounds')
    if (boundsMeta) {
      const [west, south, east, north] = boundsMeta.split(',').map(Number)
      if ([west, south, east, north].every((value) => Number.isFinite(value))) {
        bounds = [
          [south, west],
          [north, east],
        ]
      }
    }

    const statement = database.prepare(
      'SELECT tile_data FROM tiles WHERE zoom_level = $z AND tile_column = $x AND tile_row = $y'
    )

    return {
      format: 'mbtiles',
      minZoom,
      maxZoom,
      bounds,
      getTile: async (z, x, y) => {
        // MBTiles stores rows in TMS convention (y flipped) while Leaflet requests XYZ.
        const tmsY = 2 ** z - 1 - y
        statement.bind({ $z: z, $x: x, $y: tmsY })
        try {
          if (!statement.step()) return undefined
          const data = statement.get()[0] as Uint8Array | null
          if (!data) return undefined
          return new Blob([data], { type: mime })
        } finally {
          statement.reset()
        }
      },
      close: () => {
        statement.free()
        database.close()
      },
    }
  } catch (error) {
    // A file that parses as sqlite but is not usable MBTiles still holds its bytes in the wasm heap.
    database.close()
    throw error
  }
}

const mimeForPmtilesType = (tileType: number): string | undefined => {
  // Values from pmtiles' TileType enum: 2=Png, 3=Jpeg, 4=Webp, 5=Avif.
  switch (tileType) {
    case 2:
      return 'image/png'
    case 3:
      return 'image/jpeg'
    case 4:
      return 'image/webp'
    case 5:
      return 'image/avif'
    default:
      return undefined
  }
}

const openPmtilesTileSource = async (blob: Blob): Promise<TileArchiveSource> => {
  const { PMTiles, FileSource } = await import('pmtiles')
  // FileSource keys its cache on `file.name`. Cached Blobs (IndexedDB) and some downloads arrive without a
  // name; give each archive a unique one so concurrent PMTiles sources never share a cache entry.
  const file =
    blob instanceof File && blob.name
      ? blob
      : new File([blob], `archive-${blob.size}-${uuid()}.pmtiles`, {
          type: blob.type || 'application/octet-stream',
        })
  const archive = new PMTiles(new FileSource(file))
  const header = await archive.getHeader()

  const mime = mimeForPmtilesType(header.tileType)
  if (!mime) {
    throw new ArchiveContentError('This PMTiles archive does not hold raster tiles, so it cannot be a map.')
  }

  const bounds: MapOverlayBounds = [
    [header.minLat, header.minLon],
    [header.maxLat, header.maxLon],
  ]

  return {
    format: 'pmtiles',
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    bounds,
    getTile: async (z, x, y) => {
      const response = await archive.getZxy(z, x, y)
      if (!response) return undefined
      return new Blob([response.data], { type: mime })
    },
    close: () => undefined,
  }
}

// What a reader throws is library wording ("no such table: metadata", "Can't find end of central directory"),
// which says nothing the operator can act on. Only the messages raised above are written for them, so anything
// else is replaced by what the likely causes are for this format.
const unreadableArchiveMessages: Record<CustomTileArchiveFormat, string> = {
  zip: 'The ZIP could not be read. It may be incomplete, or its tiles may not be laid out as {z}/{x}/{y} folders.',
  mbtiles: 'The MBTiles file could not be read. It may be incomplete, or not a tile database at all.',
  pmtiles: 'The PMTiles file could not be read. It may be incomplete, or not a PMTiles archive at all.',
}

/**
 * Opens a tile archive of the given format and returns a uniform source for reading tiles from it.
 * @param {Blob} blob - The archive bytes.
 * @param {CustomTileArchiveFormat} format - Container format of the archive.
 * @returns {Promise<TileArchiveSource>} A source exposing zoom range, bounds and per-tile reads.
 * @throws {Error} When the format is unsupported or the archive cannot be read, with a message written for the user.
 */
export const openTileArchive = async (blob: Blob, format: CustomTileArchiveFormat): Promise<TileArchiveSource> => {
  const openers: Record<CustomTileArchiveFormat, (archive: Blob) => Promise<TileArchiveSource>> = {
    zip: openZipTileSource,
    mbtiles: openMbtilesTileSource,
    pmtiles: openPmtilesTileSource,
  }
  const opener = openers[format]
  if (!opener) throw new Error(`Unsupported tile archive format: ${format}`)

  try {
    return await opener(blob)
  } catch (error) {
    if (error instanceof ArchiveContentError) throw error
    // The replacement message drops what the reader actually said, so keep that for the log a support case reads.
    console.error(`Failed to read ${format} tile archive:`, error)
    throw new Error(unreadableArchiveMessages[format])
  }
}
