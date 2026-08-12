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
 * Caches a tile archive locally. Callers decide how to treat a failure: it only costs a re-download when the
 * vehicle already holds the archive, but it is fatal while this cache is the sole copy of a fresh import.
 * @param {string} id - The provider id.
 * @param {Blob} archive - The archive bytes.
 * @returns {Promise<void>}
 * @throws {Error} When the write fails, e.g. because the browser storage quota is exhausted.
 */
export const setCachedTileArchive = async (id: string, archive: Blob): Promise<void> => {
  await customTileArchiveStorage.setItem(id, archive)
}

/**
 * Lists the provider ids whose archive this computer holds. Reads keys only, so it does not pull archive bytes.
 * @returns {Promise<string[]>} The cached provider ids, or an empty list when the cache cannot be read.
 */
export const cachedTileArchiveIds = async (): Promise<string[]> => {
  try {
    return await customTileArchiveStorage.keys()
  } catch (error) {
    console.error('Failed to list cached tile archives:', error)
    return []
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
