import { type Ref, ref } from 'vue'

import { type TerrainTile, terrainSampleTarget, terrainTileKey, terrainTileUrl } from '@/libs/hazards/terrain-rgb'
import type { WaypointCoordinates } from '@/types/mission'
import type { TerrainDecodeRequest, TerrainDecodeResponse } from '@/workers/terrain-decode.worker'
// @ts-ignore: Worker imports
import TerrainDecodeWorker from '@/workers/terrain-decode.worker?worker'

// A decoded tile is 256 KB, so the cache is bounded; oldest out first, which suits a mission that
// walks across the map rather than jumping back to where it started.
const MAX_CACHED_TILES = 64

const tileCache = new Map<string, Float32Array>()
const inFlight = new Map<string, Promise<Float32Array>>()

// One worker for the whole application, created on the first sample and kept: it is idle between
// missions, it owns nothing per consumer, and tearing it down with any one consumer would pull it
// out from under the others.
let worker: Worker | undefined
let nextRequestId = 0
const pendingRequests = new Map<string, (answer: TerrainDecodeResponse) => void>()

const ensureWorker = (): Worker => {
  if (worker) return worker
  worker = new TerrainDecodeWorker() as Worker
  worker.onmessage = (event: MessageEvent<TerrainDecodeResponse>) => {
    pendingRequests.get(event.data.id)?.(event.data)
    pendingRequests.delete(event.data.id)
  }
  return worker
}

const rememberTile = (key: string, elevations: Float32Array): void => {
  tileCache.set(key, elevations)
  while (tileCache.size > MAX_CACHED_TILES) {
    const oldest = tileCache.keys().next().value
    if (oldest === undefined) break
    tileCache.delete(oldest)
  }
}

const loadTile = (tile: TerrainTile): Promise<Float32Array> => {
  const key = terrainTileKey(tile)
  const cached = tileCache.get(key)
  if (cached) return Promise.resolve(cached)

  const running = inFlight.get(key)
  if (running) return running

  const request: TerrainDecodeRequest = { id: String(nextRequestId++), url: terrainTileUrl(tile) }
  const promise = new Promise<Float32Array>((resolve, reject) => {
    pendingRequests.set(request.id, (answer) => {
      if (answer.elevations) resolve(answer.elevations)
      else reject(new Error(answer.error ?? 'The elevation tile could not be decoded.'))
    })
    ensureWorker().postMessage(request)
  })
    .then((elevations) => {
      rememberTile(key, elevations)
      return elevations
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, promise)
  return promise
}

/**
 * Elevation sampling against the public Terrarium tiles.
 */
export interface UseTerrainElevationReturn {
  /**
   * True while tiles are being fetched or decoded.
   */
  isSampling: Ref<boolean>
  /**
   * Samples the ground elevation under each coordinate, in meters above sea level. Positions whose
   * tile could not be loaded come back as `null` rather than as a guess. A lower `zoom` samples a
   * coarser model, for grids whose spacing is wider than the full-resolution pixels.
   */
  sampleElevations: (coordinates: WaypointCoordinates[], zoom?: number) => Promise<(number | null)[]>
}

/**
 * Samples ground elevation from the public Terrarium elevation tiles, decoding them in a worker and
 * caching the result so a mission over one area only pays for its tiles once.
 *
 * The model is a roughly 30 m grid of bare terrain, so it knows nothing of masts, trees or
 * buildings, and every clearance derived from it is advisory.
 * @returns {UseTerrainElevationReturn} The sampling function and whether a sample is running.
 */
export const useTerrainElevation = (): UseTerrainElevationReturn => {
  const isSampling = ref(false)

  const sampleElevations = async (coordinates: WaypointCoordinates[], zoom?: number): Promise<(number | null)[]> => {
    if (coordinates.length === 0) return []

    const targets = coordinates.map((coordinate) => terrainSampleTarget(coordinate, zoom))
    const tilesByKey = new Map<string, TerrainTile>()
    targets.forEach(({ tile }) => tilesByKey.set(terrainTileKey(tile), tile))

    isSampling.value = true
    try {
      const loaded = new Map<string, Float32Array>()
      await Promise.all(
        [...tilesByKey].map(async ([key, tile]) => {
          try {
            loaded.set(key, await loadTile(tile))
          } catch (error) {
            // One missing tile leaves its own waypoints unknown; the rest of the mission is still
            // worth checking, so the failure is not propagated.
            console.warn(`Could not load the elevation tile ${key}:`, error)
          }
        })
      )

      return targets.map(({ tile, index }) => {
        const elevations = loaded.get(terrainTileKey(tile))
        if (!elevations || index >= elevations.length) return null
        return elevations[index]
      })
    } finally {
      isSampling.value = false
    }
  }

  return { isSampling, sampleElevations }
}
