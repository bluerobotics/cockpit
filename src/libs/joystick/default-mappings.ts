import { cockpitStandardToProtocols, defaultProtocolMappingVehicleCorrespondency } from '@/assets/joystick-profiles'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { AxisCorrespondence, JoystickProtocolActionsMapping } from '@/types/joystick'

/**
 * The joystick mapping Cockpit ships for a vehicle type.
 * @param {MavType} vehicleType - The vehicle's type
 * @returns {JoystickProtocolActionsMapping | undefined} The default mapping, or undefined when the type has none
 */
export const getDefaultMapping = (vehicleType: MavType): JoystickProtocolActionsMapping | undefined => {
  // @ts-ignore: We know that the value is a string
  const hash = defaultProtocolMappingVehicleCorrespondency[vehicleType]
  return cockpitStandardToProtocols.find((m) => m.hash === hash)
}

/**
 * Whether an axis range strays from the default one by more than a fraction of the default's full range, on
 * either endpoint. The fraction applies to the full range so it stays meaningful when a default endpoint is 0.
 * @param {Pick<AxisCorrespondence, 'min' | 'max'>} range - The user's axis range
 * @param {Pick<AxisCorrespondence, 'min' | 'max'>} defaultRange - The default range for the same function
 * @param {number} toleranceFraction - Allowed deviation, as a fraction of the default's full range
 * @returns {boolean} True when either endpoint is outside the tolerance
 */
export const isAxisRangeOffDefault = (
  range: Pick<AxisCorrespondence, 'min' | 'max'>,
  defaultRange: Pick<AxisCorrespondence, 'min' | 'max'>,
  toleranceFraction: number
): boolean => {
  const tolerance = toleranceFraction * Math.abs(defaultRange.max - defaultRange.min)
  return Math.abs(range.min - defaultRange.min) > tolerance || Math.abs(range.max - defaultRange.max) > tolerance
}
