import { onBeforeUnmount, ref, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { PointOfInterest, WaypointCoordinates } from '@/types/mission'

import type { UseMapPoiMarkersReturn } from './useMapPoiMarkers'

/**
 * Dependencies a surface must provide for {@link useMapPoiGoTo} to issue GoTo commands.
 */
export interface UseMapPoiGoToOptions {
  /**
   * Sends the GoTo MAVLink command to the vehicle for the given coordinates. Shared with the surface's
   * regular (non-PoI) map-click GoTo flow so both pipelines issue the exact same command.
   * @param {WaypointCoordinates} coordinates - The coordinates to send the vehicle to.
   * @returns {Promise<void>} Resolves once the command has been sent (or failed and been reported).
   */
  issueGoto: (coordinates: WaypointCoordinates) => Promise<void>
}

/**
 * Handlers exposed by {@link useMapPoiGoTo} to wire up a PoI action popup or menu.
 */
export interface UseMapPoiGoToReturn {
  /**
   * Issues a GoTo to the given PoI and flags it as the active target until it's reached, cancelled, or
   * the vehicle leaves the GoTo state on its own (disarm or flight mode change).
   * @param {PointOfInterest} poi - The PoI to send the vehicle to.
   * @returns {Promise<void>} Resolves once the GoTo command has been issued.
   */
  onPoiGoTo: (poi: PointOfInterest) => Promise<void>
  /**
   * Cancels the active PoI GoTo by switching the vehicle to its position-hold flight mode.
   * @returns {Promise<void>} Resolves once the cancel command has been issued (or failed and been reported).
   */
  onPoiCancelGoTo: () => Promise<void>
  /**
   * Clears the active PoI GoTo target (if any) without sending any command to the vehicle. Used when a
   * different GoTo (e.g. a regular map-click GoTo) takes over as the map's active destination.
   * @returns {void}
   */
  clearTarget: () => void
}

/**
 * Owns the GoTo-to-PoI lifecycle for a single map: issuing the command, flagging the target PoI on the
 * given marker registry, and tracking the vehicle's arm state and flight mode so the highlight is dropped
 * if the GoTo is interrupted outside of this flow (disarm or mode change caused by something else).
 * @param {UseMapPoiMarkersReturn} poiMarkers - The PoI marker registry to flag the active target on.
 * @param {UseMapPoiGoToOptions} options - Dependencies needed to issue the GoTo command.
 * @returns {UseMapPoiGoToReturn} Handlers to wire up a PoI action popup or menu.
 */
export const useMapPoiGoTo = (
  poiMarkers: UseMapPoiMarkersReturn,
  options: UseMapPoiGoToOptions
): UseMapPoiGoToReturn => {
  const vehicleStore = useMainVehicleStore()

  // Vehicle state an active PoI GoTo expects, used to drop the highlight when the user disarms or
  // changes flight mode outside of the GoTo flow. Mode tracking only starts once the arm + GUIDED
  // transitions caused by issuing the GoTo itself have settled, so the GoTo does not cancel itself.
  const poiGotoBaselineMode = ref<string | undefined>(undefined)
  const poiGotoModeTracking = ref(false)
  let poiGotoSettleTimeout: ReturnType<typeof setTimeout> | undefined

  const resetPoiGotoTracking = (): void => {
    if (poiGotoSettleTimeout !== undefined) clearTimeout(poiGotoSettleTimeout)
    poiGotoSettleTimeout = undefined
    poiGotoModeTracking.value = false
    poiGotoBaselineMode.value = undefined
  }

  const clearTarget = (): void => {
    poiMarkers.setGotoTarget(null)
    resetPoiGotoTracking()
  }

  const cancelPoiGotoTarget = (message: string): void => {
    clearTarget()
    openSnackbar({ message, variant: 'info' })
  }

  const onPoiGoTo = async (poi: PointOfInterest): Promise<void> => {
    poiMarkers.setGotoTarget(poi.id)
    resetPoiGotoTracking()
    await options.issueGoto(poi.coordinates)
    if (poiMarkers.gotoTargetId.value !== poi.id) return
    poiGotoSettleTimeout = setTimeout(() => {
      if (poiMarkers.gotoTargetId.value !== poi.id) return
      poiGotoBaselineMode.value = vehicleStore.mode
      poiGotoModeTracking.value = true
    }, 2000)
  }

  const onPoiCancelGoTo = async (): Promise<void> => {
    try {
      await vehicleStore.pauseMission()
      clearTarget()
      openSnackbar({
        message: 'GoTo command cancelled. Vehicle will hold at its current position.',
        variant: 'success',
      })
    } catch (error) {
      openSnackbar({ message: `Cancel GoTo failed: ${(error as Error).message}`, variant: 'error' })
    }
  }

  // Drop the GoTo highlight when the vehicle leaves the GoTo state on its own (disarm or mode change).
  watch(
    () => vehicleStore.isArmed,
    (isNowArmed, wasArmed) => {
      if (!poiMarkers.gotoTargetId.value) return
      if (wasArmed && isNowArmed === false) {
        cancelPoiGotoTarget('GoTo cancelled: the vehicle was disarmed.')
      }
    }
  )

  watch(
    () => vehicleStore.mode,
    (newMode) => {
      if (!poiMarkers.gotoTargetId.value || !poiGotoModeTracking.value) return
      if (newMode !== poiGotoBaselineMode.value) {
        cancelPoiGotoTarget('GoTo cancelled: the vehicle flight mode changed.')
      }
    }
  )

  onBeforeUnmount(() => {
    resetPoiGotoTracking()
  })

  return { onPoiGoTo, onPoiCancelGoTo, clearTarget }
}
