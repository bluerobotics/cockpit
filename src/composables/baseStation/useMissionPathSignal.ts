import { type ComputedRef, computed } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { type MobileCoverageCircle, getMobileCoverageCircles } from '@/libs/baseStation/mobileCoverage'
import { BaseStationCommsType } from '@/types/baseStation'

// Reactive helpers driving the mission-path signal coloring.
export const useMissionPathSignal = (): {
  /**
   * Whether a configured comms link can color the path
   */
  isPathSignalAvailable: ComputedRef<boolean>
  /**
   * Active mobile coverage circles
   */
  mobileCoverageCircles: ComputedRef<MobileCoverageCircle[]>
} => {
  const baseStationStore = useBaseStation()

  const mobileCoverageCircles = computed(() =>
    getMobileCoverageCircles(baseStationStore.config, baseStationStore.mobileCoverageCache)
  )

  const isPathSignalAvailable = computed(() => {
    if (!baseStationStore.config.enabled) return false
    if (baseStationStore.config.commsType === BaseStationCommsType.RadioLink) {
      return baseStationStore.config.position !== null
    }
    if (baseStationStore.config.commsType === BaseStationCommsType.MobileData) {
      return mobileCoverageCircles.value.length > 0
    }
    return false
  })

  return { isPathSignalAvailable, mobileCoverageCircles }
}
