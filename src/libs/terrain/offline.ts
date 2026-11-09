import type { BathymetrySourceId, TerrainSourceId } from '@/types/terrain'

import { bathymetryLayerOverlaps, bathymetryLayers } from './bathymetry'
import { prefetchTerrainTile, terrainSourceMaxZoom } from './elevation-service'
import type { TerrainTileSourceId } from './sources'
import { type TerrainTile, type TerrainTileBounds, terrainTilesInBounds } from './tiles'

/** Largest area kept for offline use in one go, in tiles; about 50 by 40 km at the deepest zoom. */
export const MAX_OFFLINE_TERRAIN_TILES = 3000

/**
 * One tile to keep for offline use.
 */
export interface OfflineTerrainTile {
  /**
   * Source to fetch it from.
   */
  sourceId: TerrainTileSourceId
  /**
   * Tile to fetch.
   */
  tile: TerrainTile
}

/**
 * How far an offline download got.
 */
export interface OfflineTerrainProgress {
  /**
   * Tiles stored so far, including those already stored before.
   */
  done: number
  /**
   * Tiles that could not be fetched.
   */
  failed: number
  /**
   * Tiles in the whole download.
   */
  total: number
}

/**
 * Tiles to keep so every terrain check over an area works without a connection, at the zoom the
 * checks read: the terrain source, Tilezen where Copernicus has no file, and every bathymetry model read there.
 * @param {TerrainTileBounds} bounds Area to cover.
 * @param {TerrainSourceId} sourceId Source the checks read.
 * @param {BathymetrySourceId} bathymetrySourceId Bathymetry read under water.
 * @returns {OfflineTerrainTile[]} The tiles to fetch.
 */
export const offlineTerrainPlan = (
  bounds: TerrainTileBounds,
  sourceId: TerrainSourceId,
  bathymetrySourceId: BathymetrySourceId
): OfflineTerrainTile[] => {
  const zoom = terrainSourceMaxZoom(sourceId)
  const bathymetry = bathymetryLayers(bathymetrySourceId)
    .filter((layer) => bathymetryLayerOverlaps(layer, bounds))
    .map(({ layerId }) => layerId)
  const land: TerrainTileSourceId[] = sourceId === 'copernicus' ? ['copernicus', 'tilezen'] : [sourceId]
  const sources = [...new Set<TerrainTileSourceId>([...land, ...bathymetry])]
  return sources.flatMap((source) => {
    const sourceZoom = Math.min(zoom, terrainSourceMaxZoom(source))
    return terrainTilesInBounds(bounds, sourceZoom).map((tile) => ({ sourceId: source, tile }))
  })
}

/**
 * Fetches and stores tiles a few at a time, so a large area neither floods the network nor the
 * Copernicus converter.
 * @param {OfflineTerrainTile[]} tiles Tiles to keep.
 * @param {AbortSignal} signal Stops the download between tiles.
 * @param {(progress: OfflineTerrainProgress) => void} onProgress Called after every tile.
 * @returns {Promise<OfflineTerrainProgress>} The final count.
 */
export const downloadOfflineTerrain = async (
  tiles: OfflineTerrainTile[],
  signal: AbortSignal,
  onProgress: (progress: OfflineTerrainProgress) => void
): Promise<OfflineTerrainProgress> => {
  const progress: OfflineTerrainProgress = { done: 0, failed: 0, total: tiles.length }
  const queue = [...tiles]
  const lane = async (): Promise<void> => {
    while (!signal.aborted) {
      const next = queue.shift()
      if (!next) return
      try {
        await prefetchTerrainTile(next.sourceId, next.tile)
        progress.done += 1
      } catch {
        progress.failed += 1
      }
      onProgress({ ...progress })
    }
  }
  await Promise.all(Array.from({ length: 4 }, lane))
  return progress
}
