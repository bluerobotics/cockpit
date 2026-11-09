import { type Ref, shallowRef, watch } from 'vue'

import { type UploadPathPoint, prepareTerrainUpload, uploadPathPoints } from '@/libs/terrain/mission-terrain'
import { toPlain } from '@/libs/utils'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'

import type { UseMissionTerrainReturn } from './useMissionTerrain'

/**
 * What an upload holding the height over the ground would send.
 */
export interface TerrainUploadPreview {
  /**
   * The path it sends, laid along the profile.
   */
  path: UploadPathPoint[]
  /**
   * Waypoints it adds.
   */
  addedWaypoints: number
  /**
   * Terrain-relative waypoints it leaves as they are, because the ground is unknown.
   */
  unresolvedWaypoints: number
}

/**
 * Works out, ahead of the upload, the waypoints an upload holding the height over the ground would send.
 * @param {UseMissionTerrainReturn} terrain The live mission terrain check.
 * @param {Ref<boolean>} active Whether to keep the preview; the live check must run while it is true.
 * @returns {Ref<TerrainUploadPreview | null>} The preview, null while inactive or when the upload would change nothing.
 */
export const useTerrainUploadPreview = (
  terrain: UseMissionTerrainReturn,
  active: Ref<boolean>
): Ref<TerrainUploadPreview | null> => {
  const missionStore = useMissionStore()
  const terrainStore = useTerrainStore()
  const preview = shallowRef<TerrainUploadPreview | null>(null)
  let latestRun = 0

  const refresh = async (): Promise<void> => {
    const run = ++latestRun
    const analysis = terrain.analysis.value
    const home = terrain.home.value
    if (!active.value || !analysis || !home) {
      preview.value = null
      return
    }
    // A check behind the mission would lay the uploaded waypoints along the wrong path; the next one refreshes.
    if (JSON.stringify(analysis.points) !== JSON.stringify(terrain.points())) return
    const planned = toPlain(missionStore.currentPlanningWaypoints)
    try {
      const prepared = await prepareTerrainUpload(toPlain(planned), home, terrain.context(), {
        resolveTerrain: true,
        aimRois: false,
        toleranceM: terrainStore.settings.terrainFollowToleranceM,
      })
      if (run !== latestRun) return
      const { waypoints, resolvedWaypoints, addedWaypoints, unresolvedWaypoints } = prepared
      const path = uploadPathPoints(waypoints, planned, home, analysis.profile.samples)
      preview.value = resolvedWaypoints === 0 ? null : { path, addedWaypoints, unresolvedWaypoints }
    } catch {
      if (run === latestRun) preview.value = null
    }
  }

  watch([active, terrain.analysis, () => terrainStore.settings.terrainFollowToleranceM], () => void refresh(), {
    immediate: true,
  })

  return preview
}
