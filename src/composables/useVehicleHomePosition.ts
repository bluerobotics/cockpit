import { type ComputedRef, computed, watch } from 'vue'

import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * The vehicle's own home position, asked for once it is online, so surfaces that only display home do not each have to
 * fetch it. Cockpit never commands home, so this is whatever the autopilot decided, which for a planned mission is its
 * first item. What is already displayed is no answer to whether the vehicle has been asked, since a mission restored
 * from storage draws its own first item as home, so each connection is tracked instead.
 * @param {() => boolean} isNeeded - Whether the caller currently displays home, to skip the request while it does not.
 * @returns {ComputedRef<WaypointCoordinates | undefined>} Home position, or undefined while the vehicle reports none.
 */
export const useVehicleHomePosition = (
  isNeeded: () => boolean = () => true
): ComputedRef<WaypointCoordinates | undefined> => {
  const vehicleStore = useMainVehicleStore()
  const missionStore = useMissionStore()

  let askedThisConnection = false
  let lastAttempt = 0

  watch(
    [() => vehicleStore.isVehicleOnline, () => vehicleStore.isArmed, isNeeded],
    async ([isOnline, isArmed], previous) => {
      if (!isOnline) {
        askedThisConnection = false
        return
      }
      if (!isNeeded()) return
      // Arming is when the autopilot sets home, and is the retry for a vehicle that had no position fix to set it from.
      const justArmed = isArmed === true && previous?.[1] !== true
      if (askedThisConnection && !justArmed) return

      // Set before the request so a second trigger does not duplicate it, and given back on failure so a request lost
      // on a weak link is retried by whatever asks next instead of writing the whole connection off. Only the newest
      // attempt may give it back, as a slow failure must not undo a later success.
      askedThisConnection = true
      const thisAttempt = ++lastAttempt
      await vehicleStore.fetchHomeWaypoint().catch(() => {
        if (thisAttempt === lastAttempt) askedThisConnection = false
      })
    },
    { immediate: true }
  )

  return computed(() => missionStore.homeMarkerPosition)
}
