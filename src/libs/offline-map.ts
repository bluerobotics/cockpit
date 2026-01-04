import L, { type LatLngBounds } from 'leaflet'
import { get, set, del, keys } from 'idb-keyval'

interface DownloadProgress {
  total: number
  downloaded: number
  failed: number
  percentage: number
}

export class OfflineMapManager {
  private dbName: string
  private urlTemplate: string
  private options: L.TileLayerOptions
  private onProgressCallback: ((progress: DownloadProgress) => void) | null = null

  constructor(urlTemplate: string, options: L.TileLayerOptions = {}, layerName?: string) {
    this.urlTemplate = urlTemplate
    // Use layer-specific database name to avoid cache conflicts between different map layers
    this.dbName = layerName ? `cockpit-map-${layerName}` : 'cockpit-map-tiles'
    this.options = {
      ...options,
      crossOrigin: true,
    }
  }

  /**
   * Create tile layer that uses offline cache and auto-saves tiles
   */
  createTileLayer(): L.TileLayer {
    const that = this

    const CustomTileLayer = L.TileLayer.extend({
      createTile(coords: L.Coords, done: L.DoneCallback): HTMLImageElement {
        const tile = document.createElement('img')
        const url = that.getTileUrl(coords)
        const key = that.getTileKey(coords.x, coords.y, coords.z)

        // Try to load from cache first
        get<Blob>(key)
          .then((cachedBlob: Blob | undefined) => {
            if (cachedBlob) {
              // Load from cache
              tile.src = URL.createObjectURL(cachedBlob)
              done(undefined, tile)
            } else {
              // Load from network
              fetch(url)
                .then((response) => response.blob())
                .then((blob) => {
                  // Auto-save to cache if enabled
                  const autoCacheEnabled = localStorage.getItem('cockpit-auto-map-cache') === 'true'
                  if (autoCacheEnabled) {
                    set(key, blob)
                      .then(() => {
                        // Trigger cache stats refresh
                        window.dispatchEvent(new CustomEvent('map-cache-updated'))
                      })
                      .catch(() => {
                        // Silently handle cache errors
                      })
                  }
                  tile.src = URL.createObjectURL(blob)
                  done(undefined, tile)
                })
                .catch((error: Error) => {
                  done(error, tile)
                })
            }
          })
          .catch((error: Error) => {
            // If cache fails, try network
            tile.src = url
            L.DomEvent.on(tile, 'load', () => done(undefined, tile))
            L.DomEvent.on(tile, 'error', () => done(error, tile))
          })

        return tile
      },
    })

    const layer = new (CustomTileLayer as unknown as typeof L.TileLayer)(this.urlTemplate, this.options)
    return layer as L.TileLayer
  }

  private getTileUrl(coords: L.Coords): string {
    const data = {
      s: ['a', 'b', 'c'][Math.abs(coords.x + coords.y) % 3],
      x: coords.x,
      y: coords.y,
      z: coords.z,
    }
    return L.Util.template(this.urlTemplate, data)
  }

  private getTileKey(x: number, y: number, z: number): string {
    return `${this.dbName}-${z}-${x}-${y}`
  }

  private getTilesInBounds(bounds: LatLngBounds, minZoom: number, maxZoom: number): L.Coords[] {
    const tiles: L.Coords[] = []

    for (let z = minZoom; z <= maxZoom; z++) {
      const min = this.latLngToTile(bounds.getNorthWest(), z)
      const max = this.latLngToTile(bounds.getSouthEast(), z)

      for (let x = min.x; x <= max.x; x++) {
        for (let y = min.y; y <= max.y; y++) {
          tiles.push({ x, y, z } as L.Coords)
        }
      }
    }

    return tiles
  }

  private latLngToTile(latLng: L.LatLng, zoom: number): { x: number; y: number } {
    const lat = latLng.lat
    const lng = latLng.lng
    const n = Math.pow(2, zoom)
    const x = Math.floor(((lng + 180) / 360) * n)
    const y = Math.floor(
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
    )
    return { x, y }
  }

  /**
   * Download tiles for specified area and zoom levels (for manual download)
   */
  async downloadArea(
    bounds: LatLngBounds,
    minZoom: number,
    maxZoom: number,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    const tiles = this.getTilesInBounds(bounds, minZoom, maxZoom)
    const total = tiles.length
    let downloaded = 0
    let failed = 0

    this.onProgressCallback = onProgress || null

    const updateProgress = () => {
      const progress: DownloadProgress = {
        total,
        downloaded,
        failed,
        percentage: Math.round((downloaded / total) * 100),
      }
      if (this.onProgressCallback) {
        this.onProgressCallback(progress)
      }
    }

    const batchSize = 10
    for (let i = 0; i < tiles.length; i += batchSize) {
      const batch = tiles.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (coords) => {
          try {
            const url = this.getTileUrl(coords)
            const response = await fetch(url)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            const blob = await response.blob()
            const key = this.getTileKey(coords.x, coords.y, coords.z)
            await set(key, blob)
            downloaded++
          } catch (error) {
            console.error(`Failed to download tile ${coords.z}/${coords.x}/${coords.y}:`, error)
            failed++
          }
          updateProgress()
        })
      )

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    updateProgress()
    window.dispatchEvent(new CustomEvent('map-cache-updated'))
  }

  estimateTileCount(bounds: LatLngBounds, minZoom: number, maxZoom: number): number {
    return this.getTilesInBounds(bounds, minZoom, maxZoom).length
  }

  estimateStorageSize(tileCount: number): string {
    const avgTileSize = 15 * 1024
    const totalBytes = tileCount * avgTileSize

    if (totalBytes < 1024 * 1024) {
      return `${Math.round(totalBytes / 1024)} KB`
    } else if (totalBytes < 1024 * 1024 * 1024) {
      return `${Math.round(totalBytes / (1024 * 1024))} MB`
    } else {
      return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }
  }

  async getCacheSize(): Promise<{ count: number; size: string }> {
    try {
      const allKeys = await keys()
      const mapKeys = allKeys.filter((key: IDBValidKey) => String(key).startsWith(this.dbName))

      const count = mapKeys.length
      const size = this.estimateStorageSize(count)

      return { count, size }
    } catch (error) {
      console.error('Failed to get cache size:', error)
      return { count: 0, size: '0 KB' }
    }
  }

  async clearCache(): Promise<void> {
    try {
      const allKeys = await keys()
      const mapKeys = allKeys.filter((key: IDBValidKey) => String(key).startsWith(this.dbName))

      await Promise.all(mapKeys.map((key: IDBValidKey) => del(key)))
      window.dispatchEvent(new CustomEvent('map-cache-updated'))
    } catch (error) {
      console.error('Failed to clear cache:', error)
      throw error
    }
  }

  async hasTile(x: number, y: number, z: number): Promise<boolean> {
    try {
      const key = this.getTileKey(x, y, z)
      const tile = await get(key)
      return tile !== undefined
    } catch {
      return false
    }
  }

  getDbName(): string {
    return this.dbName
  }
}
