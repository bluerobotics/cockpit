import { type ComputedRef, computed } from 'vue'

import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { getVehicleTypeFromMavType } from '@/libs/vehicle/ardupilot/common'
import {
  type FenceActionOption,
  type FenceVehicle,
  autoEnablesOnTakeoff,
  fenceActionOptions,
  fenceActionParameter,
  fenceAutoEnableOptions,
  fenceBreachOutcome,
  isFenceAutoEnabled,
  supportsBreachReturn,
} from '@/libs/vehicle/fence-actions'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

/**
 * What the fence does on a breach, and when it turns itself on, for the vehicle being planned for.
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
  /**
   * Whether a breach return point is worth adding: true for planes, and while the vehicle type is unknown.
   */
  canAddBreachReturn: ComputedRef<boolean>
  /**
   * Whether the fence can turn itself on at takeoff, rather than only at arming. True while the vehicle type is unknown.
   */
  autoEnablesOnTakeoff: ComputedRef<boolean>
  /**
   * The `FENCE_AUTOENABLE` values that do something on that vehicle.
   */
  autoEnableOptions: ComputedRef<Pick<FenceActionOption, 'value' | 'label'>[]>
  /**
   * Whether the connected vehicle turns its fence on by itself, judged by values it actually acts on.
   */
  autoEnabled: ComputedRef<boolean>
}

/**
 * Describes the fence breach behavior of the connected or planned vehicle in operator terms.
 * @returns {UseFenceBreachActionReturn} The fence action and its options, the breach outcome, breach-return support and auto-enable.
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

  const canAddBreachReturn = computed(() => !vehicle.value || supportsBreachReturn(vehicle.value))

  const takesOff = computed(() => !vehicle.value || autoEnablesOnTakeoff(vehicle.value))
  const autoEnableOptions = computed(() => fenceAutoEnableOptions(takesOff.value))
  const autoEnabled = computed(() => {
    const mode = fenceStore.fenceAutoEnableMode
    return mode !== undefined && isFenceAutoEnabled(takesOff.value, mode)
  })

  return {
    parameterName,
    options,
    outcome,
    canAddBreachReturn,
    autoEnablesOnTakeoff: takesOff,
    autoEnableOptions,
    autoEnabled,
  }
}
