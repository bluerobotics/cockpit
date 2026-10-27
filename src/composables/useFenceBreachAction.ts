import { type ComputedRef, computed } from 'vue'

import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { getVehicleTypeFromMavType } from '@/libs/vehicle/ardupilot/common'
import {
  type FenceActionOption,
  type FenceVehicle,
  fenceActionOptions,
  fenceActionParameter,
  fenceBreachOutcome,
} from '@/libs/vehicle/fence-actions'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

/**
 * What the fence does on a breach, for the vehicle being planned for.
 */
export interface UseFenceBreachActionReturn {
  /**
   * Name of the parameter holding that vehicle's fence action.
   */
  parameterName: ComputedRef<string | undefined>
  /**
   * The fence actions that vehicle accepts.
   */
  options: ComputedRef<FenceActionOption[]>
  /**
   * What crossing the fence leads to, once the connected vehicle has reported its fence action.
   */
  outcome: ComputedRef<string | undefined>
}

/**
 * Describes the fence breach behavior of the connected or planned vehicle in operator terms.
 * @returns {UseFenceBreachActionReturn} The fence action parameter and its options, and the breach outcome.
 */
export const useFenceBreachAction = (): UseFenceBreachActionReturn => {
  const vehicleStore = useMainVehicleStore()
  const missionStore = useMissionStore()
  const fenceStore = useGeoFenceStore()

  // The planned vehicle type while offline, taken to run ArduPilot.
  const vehicle = computed<FenceVehicle | undefined>(() => {
    const mavType = missionStore.effectiveVehicleType
    const firmware = vehicleStore.isVehicleOnline ? vehicleStore.mainVehicle?.firmware() : Vehicle.Firmware.ArduPilot
    if (!mavType || !firmware) return undefined
    return { firmware, family: getVehicleTypeFromMavType(mavType), isBoat: mavType === MavType.MAV_TYPE_SURFACE_BOAT }
  })

  const parameterName = computed(() => vehicle.value && fenceActionParameter(vehicle.value.firmware))

  const options = computed(() => (vehicle.value ? fenceActionOptions(vehicle.value) : []))

  const outcome = computed(() => {
    const value = fenceStore.fenceAction
    return vehicle.value && value !== undefined ? fenceBreachOutcome(vehicle.value, value) : undefined
  })

  return {
    parameterName,
    options,
    outcome,
  }
}
