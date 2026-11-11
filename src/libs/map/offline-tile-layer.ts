import L from 'leaflet'

// The database, store, indexes and record shape that leaflet.offline used, kept exactly: tiles users saved before
// keep loading offline, and an older Cockpit can still read the tiles this one saves.
const databaseName = 'leaflet.offline'
const databaseVersion = 2
const storeName = 'tileStore'

/**
 * A map tile to be saved for offline use.
 */
export interface OfflineTile {
  /**
   * Storage key: the tile URL built with the layer's first subdomain
   */
  key: string
  /**
   * URL the tile is downloaded from
   */
  url: string
  /**
   * URL template of the layer the tile belongs to
   */
  urlTemplate: string
  /**
   * Tile column
   */
  x: number
  /**
   * Tile row
   */
  y: number
  /**
   * Zoom level
   */
  z: number
}

let database: Promise<IDBDatabase> | undefined

const openDatabase = (): Promise<IDBDatabase> => {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      if (request.result.objectStoreNames.contains(storeName)) return
      const store = request.result.createObjectStore(storeName, { keyPath: 'key' })
      store.createIndex('urlTemplate', 'urlTemplate')
      store.createIndex('z', 'z')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch((error) => {
    database = undefined
    throw error
  })
  return database
}

// Resolves once the transaction commits, since a write that runs out of storage quota only fails at commit.
const runInStore = <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        const request = operation(transaction.objectStore(storeName))
        transaction.oncomplete = () => resolve(request.result)
        transaction.onerror = () => reject(transaction.error ?? request.error)
        transaction.onabort = () => reject(transaction.error ?? request.error)
      })
  )

/**
 * A tile as stored for offline use.
 */
interface StoredTile extends OfflineTile {
  /**
   * When the tile was stored, in milliseconds since the epoch
   */
  createdAt: number
  /**
   * The tile image
   */
  blob: Blob
}

const loadStoredTile = async (key: string): Promise<Blob | undefined> => {
  const record = (await runInStore('readonly', (store) => store.get(key))) as StoredTile | undefined
  return record?.blob
}

/**
 * Lists the keys of the tiles already saved for a layer.
 * @param {string} urlTemplate URL template of the layer
 * @returns {Promise<Set<string>>} The saved tile keys
 */
export const storedTileKeys = async (urlTemplate: string): Promise<Set<string>> => {
  const keys = await runInStore('readonly', (store) => store.index('urlTemplate').getAllKeys(urlTemplate))
  return new Set(keys as string[])
}

/**
 * Downloads a tile image.
 * @param {string} url URL of the tile
 * @returns {Promise<Blob>} The tile image
 */
export const downloadTile = async (url: string): Promise<Blob> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Tile request failed with status ${response.status}: ${url}`)
  return response.blob()
}

const storeTile = (tile: OfflineTile, blob: Blob): Promise<IDBValidKey> =>
  runInStore('readwrite', (store) => store.put({ ...tile, createdAt: Date.now(), blob } satisfies StoredTile))

/**
 * Downloads tiles and saves them for offline use, a few at a time. A tile that fails is skipped, not retried.
 * @param {OfflineTile[]} tiles Tiles to save
 * @param {() => void} onTileDone Called after each tile, whether it was saved or not
 * @param {number} parallel How many tiles to download at once
 * @returns {Promise<number>} How many tiles could not be saved
 */
export const saveTiles = async (tiles: OfflineTile[], onTileDone: () => void, parallel = 20): Promise<number> => {
  let next = 0
  let failed = 0
  const worker = async (): Promise<void> => {
    while (next < tiles.length) {
      const tile = tiles[next++]
      try {
        await storeTile(tile, await downloadTile(tile.url))
      } catch {
        failed++
      }
      onTileDone()
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker))
  return failed
}

/**
 * Columns and rows of tiles at one zoom level. Columns may run past the antimeridian and wrap around.
 */
interface TileRange {
  /**
   * Zoom level
   */
  z: number
  /**
   * First tile column
   */
  firstColumn: number
  /**
   * Last tile column
   */
  lastColumn: number
  /**
   * First tile row
   */
  firstRow: number
  /**
   * Last tile row
   */
  lastRow: number
}

/**
 * Tile layer that shows a tile from the offline store when it was saved there, and downloads it otherwise.
 */
export class OfflineTileLayer extends L.TileLayer {
  /**
   * Creates the layer, keeping its URL template public so its saved tiles can be looked up by it.
   * @param {string} urlTemplate Tile URL template, as for `L.tileLayer`
   * @param {L.TileLayerOptions} options Tile layer options, as for `L.tileLayer`
   */
  constructor(readonly urlTemplate: string, options?: L.TileLayerOptions) {
    super(urlTemplate, options)
  }

  /**
   * Storage key of a tile: its URL built with the layer's first subdomain.
   * @param {number} x Tile column
   * @param {number} y Tile row
   * @param {number} z Zoom level
   * @returns {string} The storage key
   */
  tileKey(x: number, y: number, z: number): string {
    const subdomain = this.options.subdomains?.[0]
    const retina = L.Browser.retina ? '@2x' : ''
    return L.Util.template(this.urlTemplate, { ...this.options, x, y, z, s: subdomain, r: retina })
  }

  /**
   * Range of tile rows and columns that cover an area at each zoom level in a range.
   * @param {L.Map} map Map the layer is shown on
   * @param {L.LatLngBounds} bounds Area to cover
   * @param {number} minZoom Lowest zoom level
   * @param {number} maxZoom Highest zoom level
   * @returns {TileRange[]} One range per zoom level
   */
  private tileRanges(map: L.Map, bounds: L.LatLngBounds, minZoom: number, maxZoom: number): TileRange[] {
    const size = this.getTileSize()
    const ranges: TileRange[] = []
    for (let z = minZoom; z <= maxZoom; z++) {
      const tilesPerSide = 2 ** z
      const topLeft = map.project(bounds.getNorthWest(), z).unscaleBy(size).floor()
      const bottomRight = map.project(bounds.getSouthEast(), z).unscaleBy(size).floor()
      // Columns past the antimeridian wrap around, so a view wider than the world never counts a column twice.
      const lastColumn = Math.min(bottomRight.x, topLeft.x + tilesPerSide - 1)
      const firstRow = Math.max(topLeft.y, 0)
      const lastRow = Math.min(bottomRight.y, tilesPerSide - 1)
      ranges.push({ z, firstColumn: topLeft.x, lastColumn, firstRow, lastRow })
    }
    return ranges
  }

  /**
   * Counts the tiles that cover an area at each zoom level in a range, without listing them.
   * @param {L.Map} map Map the layer is shown on
   * @param {L.LatLngBounds} bounds Area to cover
   * @param {number} minZoom Lowest zoom level
   * @param {number} maxZoom Highest zoom level
   * @returns {number} The tile count
   */
  countTilesIn(map: L.Map, bounds: L.LatLngBounds, minZoom: number, maxZoom: number): number {
    return this.tileRanges(map, bounds, minZoom, maxZoom).reduce((count, range) => {
      const columns = range.lastColumn - range.firstColumn + 1
      const rows = Math.max(range.lastRow - range.firstRow + 1, 0)
      return count + columns * rows
    }, 0)
  }

  /**
   * Lists the tiles that cover an area at each zoom level in a range.
   * @param {L.Map} map Map the layer is shown on
   * @param {L.LatLngBounds} bounds Area to cover
   * @param {number} minZoom Lowest zoom level
   * @param {number} maxZoom Highest zoom level
   * @returns {OfflineTile[]} The tiles
   */
  tilesIn(map: L.Map, bounds: L.LatLngBounds, minZoom: number, maxZoom: number): OfflineTile[] {
    const tiles: OfflineTile[] = []
    this.tileRanges(map, bounds, minZoom, maxZoom).forEach(({ z, firstColumn, lastColumn, firstRow, lastRow }) => {
      const tilesPerSide = 2 ** z
      for (let column = firstColumn; column <= lastColumn; column++) {
        const x = ((column % tilesPerSide) + tilesPerSide) % tilesPerSide
        for (let y = firstRow; y <= lastRow; y++) {
          const key = this.tileKey(x, y, z)
          tiles.push({ key, url: key, urlTemplate: this.urlTemplate, x, y, z })
        }
      }
    })
    return tiles
  }

  /**
   * Builds the tile image, from the offline store when the tile was saved there.
   * @param {L.Coords} coords Tile coordinates
   * @param {L.DoneCallback} done Tells Leaflet the tile finished loading
   * @returns {HTMLElement} The tile image
   */
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img')
    let objectUrl: string | undefined
    const releaseObjectUrl = (): void => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrl = undefined
    }

    L.DomEvent.on(tile, 'load', () => {
      this._tileOnLoad(done, tile)
      releaseObjectUrl()
    })
    L.DomEvent.on(tile, 'error', (event) => {
      this._tileOnError(done, tile, event as unknown as Error)
      releaseObjectUrl()
    })

    const { crossOrigin, referrerPolicy } = this.options
    if (crossOrigin || crossOrigin === '') tile.crossOrigin = crossOrigin === true ? '' : crossOrigin
    if (typeof referrerPolicy === 'string') tile.referrerPolicy = referrerPolicy
    tile.alt = ''
    tile.setAttribute('role', 'presentation')

    loadStoredTile(this.tileKey(coords.x, coords.y, coords.z))
      .catch(() => undefined)
      .then((blob) => {
        objectUrl = blob ? URL.createObjectURL(blob) : undefined
        tile.src = objectUrl ?? this.getTileUrl(coords)
      })
    return tile
  }
}
