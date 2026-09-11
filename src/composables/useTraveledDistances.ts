import { type ComputedRef, computed } from 'vue'

import { formatDistance } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'

type TraveledDistances = {
  /**
   * Total distance the vehicle has traveled across its whole history, pre-formatted in the user's
   * preferred distance unit.
   */
  formattedTotalDistance: ComputedRef<string>
  /**
   * Distance traveled during the current mission (since waypoint 1), pre-formatted in the user's
   * preferred distance unit.
   */
  formattedMissionDistance: ComputedRef<string>
}

/**
 * Exposes the total and mission traveled distances pre-formatted with the user's preferred distance
 * unit, so widgets, mini-widgets, and map overlays can share a single formatting funnel instead of
 * duplicating the mission-store + interface-store wiring at each call site.
 * @returns {TraveledDistances} Reactive formatted-distance strings for the total and mission odometers
 */
export const useTraveledDistances = (): TraveledDistances => {
  const missionStore = useMissionStore()
  const interfaceStore = useAppInterfaceStore()

  const formattedTotalDistance = computed(() =>
    formatDistance(missionStore.totalTraveledDistanceMeters, interfaceStore.displayUnitPreferences.distance)
  )
  const formattedMissionDistance = computed(() =>
    formatDistance(missionStore.missionTraveledDistanceMeters, interfaceStore.displayUnitPreferences.distance)
  )

  return { formattedTotalDistance, formattedMissionDistance }
}
