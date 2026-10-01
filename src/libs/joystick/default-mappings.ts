import { cockpitStandardToProtocols, defaultProtocolMappingVehicleCorrespondency } from '@/assets/joystick-profiles'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { JoystickProtocolActionsMapping } from '@/types/joystick'

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
