import { type Ref, onScopeDispose, ref, shallowRef, watch } from 'vue'

import type { TerrainProfileSample } from '@/libs/terrain/mission-profile'
import { loadWaterCells, waterAlongPath, waterCellKeys } from '@/libs/terrain/water-map'

/**
 * Where a mission runs over water, from the OpenStreetMap water map.
 */
export interface UseMissionWaterReturn {
  /**
   * Whether each profile station is over water, null where the map is not loaded.
   */
  overWater: Ref<(boolean | null)[]>
  /**
   * Whether part of the mission's water map is neither stored nor could be downloaded.
   */
  failed: Ref<boolean>
  /**
   * Whether the water map is loading.
   */
  loading: Ref<boolean>
  /**
   * Downloads the cells that failed again, without waiting out the pause between attempts.
   */
  retry: () => Promise<void>
}

/**
 * Marks the profile stations over water, loading the water map along the mission while active.
 * @param {Ref<TerrainProfileSample[]>} samples Profile stations, in order.
 * @param {Ref<boolean>} active Whether to load and mark; nothing is marked while inactive.
 * @param {() => number} waterLevelM Water surface height, where the model decides.
 * @returns {UseMissionWaterReturn} The marks and the load state.
 */
export const useMissionWater = (
  samples: Ref<TerrainProfileSample[]>,
  active: Ref<boolean>,
  waterLevelM: () => number
): UseMissionWaterReturn => {
  const overWater = shallowRef<(boolean | null)[]>([])
  const failed = ref(false)
  const loading = ref(false)
  const controller = new AbortController()
  let token = 0

  const refresh = async (retry = false): Promise<void> => {
    const current = ++token
    const stations = samples.value
    if (!active.value || stations.length === 0) {
      overWater.value = []
      failed.value = false
      loading.value = false
      return
    }
    const points = stations.map(({ coordinates }) => coordinates)
    loading.value = true
    try {
      const load = await loadWaterCells(waterCellKeys(points), controller.signal, retry)
      if (current !== token) return
      const groundM = stations.map(({ groundM: ground }) => ground)
      overWater.value = waterAlongPath(points, groundM, waterLevelM(), load.cells)
      failed.value = load.failed > 0
    } catch (error) {
      console.error('Could not mark the water along the mission:', error)
    } finally {
      if (current === token) loading.value = false
    }
  }

  watch([samples, active], () => void refresh(), { immediate: true })
  onScopeDispose(() => controller.abort())

  return { overWater, failed, loading, retry: () => refresh(true) }
}
