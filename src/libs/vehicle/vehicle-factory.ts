//import * as Protocol from './protocol/protocol'
import { ArduPilotSub } from './ardupilot/ardusub'
import * as Vehicle from './vehicle'

/**
 *
 */
export class VehicleFactory {
  static _vehicles: WeakRef<Vehicle.Abstract>[] = []

  /**
   * Create vehicle based on the firmware and vehicle type
   *
   * @param {Vehicle.Firmware} firmware
   * @param {Vehicle.Type} type
   * @returns {Vehicle.Abstract | undefined}
   */
  static createVehicle(
    firmware: Vehicle.Firmware,
    type: Vehicle.Type
  ): Vehicle.Abstract | undefined {
    let vehicle = undefined

    switch (firmware) {
      case Vehicle.Firmware.ArduPilot:
        vehicle = VehicleFactory.createArduPilotVehicle(type)
        break
    }

    if (vehicle == undefined) {
      unimplemented('Firmware not supported')
    }

    VehicleFactory._vehicles.push(new WeakRef(vehicle))
    return vehicle
  }

  /**
   * Create ArduPilot vehicle based on the category
   *
   * @param  {Vehicle.Type} type
   * @returns {Vehicle.Abstract | undefined}
   */
  static createArduPilotVehicle(
    type: Vehicle.Type
  ): Vehicle.Abstract | undefined {
    switch (type) {
      case Vehicle.Type.Sub:
        return new ArduPilotSub()
      default:
        unimplemented('Firmware not supported')
    }
  }
  /**
   * Return a list of vehicles available
   *
   * @returns {WeakRef<Vehicle.Abstract>[]}
   */
  vehicles(): WeakRef<Vehicle.Abstract>[] {
    // Be sure to remove vehicles that does not exist anymore
    VehicleFactory._vehicles = VehicleFactory._vehicles.filter(
      (weakRef) => weakRef.deref() !== undefined
    )

    return VehicleFactory._vehicles
  }
}
