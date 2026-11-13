import localforage from 'localforage'

const terrainTilesDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Terrain Tiles',
  storeName: 'cockpit-terrain-tiles',
  version: 1.0,
  description: 'Elevation tiles kept so terrain checks keep working offline.',
})
// ponytail: the cache only grows until the user clears it; an LRU sweep by stored date is the upgrade.

/**
 * How much the persistent terrain cache holds.
 */
export interface TerrainCacheSummary {
  /**
   * Number of stored tiles.
   */
  tiles: number
  /**
   * Total size of the stored tiles, in bytes.
   */
  bytes: number
}

/**
 * Reads one stored tile image.
 * @param {string} key Tile key, as built by `terrainSourceTileKey`.
 * @returns {Promise<Blob | null>} The image, or null when it was never stored or cannot be read.
 */
export const readStoredTerrainTile = async (key: string): Promise<Blob | null> => {
  try {
    return await terrainTilesDB.getItem<Blob>(key)
  } catch {
    return null
  }
}

/**
 * Stores one tile image. A failed write only costs a download next time, so it is not raised.
 * @param {string} key Tile key, as built by `terrainSourceTileKey`.
 * @param {Blob} png Terrarium-encoded PNG, or GeoTIFF of a bathymetry model.
 * @returns {Promise<void>}
 */
export const storeTerrainTile = async (key: string, png: Blob): Promise<void> => {
  try {
    await terrainTilesDB.setItem(key, png)
  } catch (error) {
    console.warn(`Could not store the elevation tile ${key}:`, error)
  }
}

/**
 * Removes one stored tile, so a corrupt one is downloaded again rather than failing every read.
 * @param {string} key Tile key, as built by `terrainSourceTileKey`.
 * @returns {Promise<void>}
 */
export const removeStoredTerrainTile = async (key: string): Promise<void> => {
  try {
    await terrainTilesDB.removeItem(key)
  } catch (error) {
    console.warn(`Could not remove the elevation tile ${key}:`, error)
  }
}

/**
 * Counts the stored tiles and their size.
 * @returns {Promise<TerrainCacheSummary>} The cache summary.
 */
export const summarizeTerrainCache = async (): Promise<TerrainCacheSummary> => {
  const summary: TerrainCacheSummary = { tiles: 0, bytes: 0 }
  await terrainTilesDB.iterate<Blob, void>((value) => {
    summary.tiles += 1
    summary.bytes += value?.size ?? 0
  })
  return summary
}

/**
 * Removes every stored tile.
 * @returns {Promise<void>}
 */
export const clearTerrainCache = async (): Promise<void> => {
  await terrainTilesDB.clear()
}
