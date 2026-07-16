import localforage from 'localforage'

import { getStorageBytesAvailable, requestPersistentStorage } from '@/libs/map/storage-quota'
import { LocalForageStorage } from '@/libs/videoStorage'
import type { StorageDB } from '@/types/general'
import type { MapOverlayBounds, MapOverlayRenderMode } from '@/types/mission'

/**
 * Persistent storage for GeoTIFF overlay raster bytes, in IndexedDB for both builds. Overlays are imported
 * input data (not generated output like videos/snapshots), so they are not written to the user's filesystem.
 * In Lite (browser) IndexedDB is origin-quota-limited and evictable; in Standalone (Electron) it has a much
 * larger quota and is effectively durable.
 */
export const mapOverlayStorage: StorageDB = new LocalForageStorage(
  'Cockpit - Map Overlays',
  'cockpit-map-overlays-db',
  1.0,
  'User-loaded GeoTIFF map overlays (e.g. sonar mosaics, bathymetry, photogrammetry surveys).'
)

/**
 * A cached rendered overlay image, persisted so a GeoTIFF reloads instantly on the next app launch without
 * re-parsing the (potentially huge) raster. The rendered image is size-capped, so this stays small regardless
 * of the source file size.
 */
export interface CachedOverlayRender {
  /**
   * Render-algorithm version that produced this image; a mismatch invalidates the cache.
   */
  version: number
  /**
   * Render mode the cached image was produced with; a mode change invalidates it.
   */
  renderMode: MapOverlayRenderMode
  /**
   * PNG data URL of the colorized raster.
   */
  dataUrl: string
  /**
   * WGS84 bounds of the raster.
   */
  bounds: MapOverlayBounds
}

// Keyed by overlay id; holds one rendered image per overlay (the latest render mode used).
const mapOverlayRenderCacheDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Map Overlay Renders',
  storeName: 'cockpit-map-overlay-renders-db',
  version: 1.0,
  description: 'Cached rendered images of GeoTIFF overlays, so they reload without re-parsing the raster.',
})

/**
 * Reads a previously cached rendered overlay image.
 * @param {string} id - The overlay id.
 * @returns {Promise<CachedOverlayRender | null>} The cached render, or `null` if absent or unreadable.
 */
export const getCachedOverlayRender = async (id: string): Promise<CachedOverlayRender | null> => {
  try {
    return await mapOverlayRenderCacheDB.getItem<CachedOverlayRender>(id)
  } catch (error) {
    console.error(`Failed to read cached render for map overlay ${id}:`, error)
    return null
  }
}

/**
 * Persists a rendered overlay image. Best-effort: a failed write (e.g. quota exceeded) is swallowed so it never
 * breaks rendering — the overlay still works for the session via the in-memory cache.
 * @param {string} id - The overlay id.
 * @param {CachedOverlayRender} render - The rendered image to cache.
 * @returns {Promise<void>}
 */
export const setCachedOverlayRender = async (id: string, render: CachedOverlayRender): Promise<void> => {
  try {
    await mapOverlayRenderCacheDB.setItem(id, render)
  } catch (error) {
    console.warn(`Could not cache rendered map overlay ${id}:`, error)
  }
}

/**
 * Removes a cached rendered overlay image.
 * @param {string} id - The overlay id.
 * @returns {Promise<void>}
 */
export const removeCachedOverlayRender = async (id: string): Promise<void> => {
  try {
    await mapOverlayRenderCacheDB.removeItem(id)
  } catch (error) {
    console.error(`Failed to remove cached render for map overlay ${id}:`, error)
  }
}

/**
 * Asks the browser to keep IndexedDB durable so large overlays are less likely to be evicted under storage
 * pressure. No-op where unsupported.
 * @returns {Promise<boolean>} True if storage is persisted, false otherwise.
 */
export const requestPersistentOverlayStorage = async (): Promise<boolean> => requestPersistentStorage()

/**
 * Estimated remaining IndexedDB bytes for the current origin, used to warn before storing a large overlay.
 * Returns `undefined` where the Storage API is unavailable, meaning "no quota concern".
 * @returns {Promise<number | undefined>} The remaining bytes, or `undefined` when not applicable.
 */
export const getOverlayStorageBytesAvailable = async (): Promise<number | undefined> => getStorageBytesAvailable()
