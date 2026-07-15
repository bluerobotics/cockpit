import { LocalForageStorage } from '@/libs/videoStorage'
import type { StorageDB } from '@/types/general'

/**
 * Local IndexedDB cache of custom-tile-provider archives (ZIP/MBTiles/PMTiles), keyed by provider id. This is a
 * render cache only: the master copy of each archive lives on the vehicle (File Browser), so a cache miss (e.g.
 * on a fresh machine or after browser eviction) is recovered by re-downloading from the vehicle.
 */
export const customTileArchiveStorage: StorageDB = new LocalForageStorage(
  'Cockpit - Custom Tile Providers',
  'cockpit-custom-tile-providers-db',
  1.0,
  'Locally cached tile archives for user-defined custom map providers (master copy stored on the vehicle).'
)

/**
 * Reads a cached tile archive.
 * @param {string} id - The provider id.
 * @returns {Promise<Blob | null | undefined>} The cached archive, or nullish if absent/unreadable.
 */
export const getCachedTileArchive = async (id: string): Promise<Blob | null | undefined> => {
  try {
    return await customTileArchiveStorage.getItem(id)
  } catch (error) {
    console.error(`Failed to read cached tile archive ${id}:`, error)
    return null
  }
}

/**
 * Caches a tile archive locally. Best-effort: a failed write (e.g. quota exceeded) is swallowed, since the
 * archive can always be re-fetched from the vehicle.
 * @param {string} id - The provider id.
 * @param {Blob} archive - The archive bytes.
 * @returns {Promise<void>}
 */
export const setCachedTileArchive = async (id: string, archive: Blob): Promise<void> => {
  try {
    await customTileArchiveStorage.setItem(id, archive)
  } catch (error) {
    console.warn(`Could not cache tile archive ${id} locally:`, error)
  }
}

/**
 * Removes a cached tile archive. Safe to call even if the archive is not cached.
 * @param {string} id - The provider id.
 * @returns {Promise<void>}
 */
export const removeCachedTileArchive = async (id: string): Promise<void> => {
  try {
    await customTileArchiveStorage.removeItem(id)
  } catch (error) {
    console.error(`Failed to remove cached tile archive ${id}:`, error)
  }
}
