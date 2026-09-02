import { type ComputedRef, computed, watch } from 'vue'

import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * The home position to display, asked of the vehicle once it is online so surfaces that only show home do not each
 * have to fetch it. What is already displayed is no answer to whether the vehicle has been asked, since a mission
 * restored from storage draws its own first item as home, so each connection is tracked instead.
 * @param {() => boolean} isNeeded - Whether the caller currently displays home, to skip the request while it does not.
 * @returns {{ coordinates: ComputedRef<WaypointCoordinates | undefined>, isConfirmedByVehicle: ComputedRef<boolean> }}
 * The displayed home, and whether the vehicle currently connected is the one that reported it rather than it being a
 * mission's first item, a point the operator commanded, or one left over from another connection.
 */
export const useVehicleHomePosition = (
  isNeeded: () => boolean = () => true
): {
  /** The home position being displayed, or undefined while none is known */
  coordinates: ComputedRef<WaypointCoordinates | undefined>
  /** Whether the vehicle currently connected is the one that reported this home */
  isConfirmedByVehicle: ComputedRef<boolean>
} => {
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

  return {
    coordinates: computed(() => missionStore.homeMarkerPosition),
    isConfirmedByVehicle: computed(
      () =>
        missionStore.homeMarkerSource === 'vehicle' &&
        vehicleStore.isVehicleOnline &&
        missionStore.homeMarkerVehicleId != null &&
        missionStore.homeMarkerVehicleId === vehicleStore.currentlyConnectedVehicleId
    ),
  }
}
