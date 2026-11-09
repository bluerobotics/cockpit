import { type Ref, ref } from 'vue'

import { sampleTerrain } from '@/libs/terrain/elevation-service'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * Elevation sampling against the configured terrain model.
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
 * Samples ground elevation from the configured terrain model, tracking whether a sample is running.
 * Every derived clearance is advisory: no public model knows of masts or fresh construction.
 * @returns {UseTerrainElevationReturn} The sampling function and whether a sample is running.
 */
export const useTerrainElevation = (): UseTerrainElevationReturn => {
  const isSampling = ref(false)
  let running = 0

  const sampleElevations = async (coordinates: WaypointCoordinates[], zoom?: number): Promise<(number | null)[]> => {
    running += 1
    isSampling.value = true
    try {
      return await sampleTerrain(coordinates, { zoom })
    } finally {
      running -= 1
      isSampling.value = running > 0
    }
  }

  return { isSampling, sampleElevations }
}
