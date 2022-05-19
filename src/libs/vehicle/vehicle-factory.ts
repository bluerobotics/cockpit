//import * as Protocol from './protocol/protocol'
import * as Vehicle from './vehicle'

/**
 * Create vehicle based on the firmware and vehicle type
 *
 * @param {Vehicle.Firmware} firmware
 * @param {Vehicle.Type} type
 */
export function createVehicle(
  firmware: Vehicle.Firmware,
  type: Vehicle.Type
): void {
  unused(type)
  switch (firmware) {
    case Vehicle.Firmware.ArduPilot:
      unimplemented()
      //return createArduPilotVehicle(type)
      break
    default:
      unimplemented('Firmware not supported')
  }
}

/**
 * Create ArduPilot vehicle based on the category
 *
 * @param  {Vehicle.Type} type
 */
export function createArduPilotVehicle(type: Vehicle.Type): void {
  switch (type) {
    case Vehicle.Type.Sub:
      unimplemented()
      //return new ArduPilotSub()
      break
    default:
      unimplemented('Firmware not supported')
  }
}
