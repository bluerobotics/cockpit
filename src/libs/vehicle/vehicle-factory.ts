import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MavAutopilot, MAVLinkType, MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { Signal } from '@/libs/signal'

import { ArduCopter } from './ardupilot/arducopter'
import { ArduPlane } from './ardupilot/arduplane'
import { ArduRover } from './ardupilot/ardurover'
import { ArduSub } from './ardupilot/ardusub'
import * as Vehicle from './vehicle'

/**
 * Class responsible for handling vehicle creation
 */
export class VehicleFactory {
  static _vehicles: WeakRef<Vehicle.Abstract>[] = []

  // Signals
  static onVehicles = new Signal<WeakRef<Vehicle.Abstract>[]>()

  /**
   * Create vehicle based on the firmware and vehicle type
   * @param {Vehicle.Firmware} firmware
   * @param {Vehicle.Type} type
   * @param {number} system_id - The system ID for the vehicle
   * @returns {Vehicle.Abstract | undefined}
   */
  static createVehicle(
    firmware: Vehicle.Firmware,
    type: Vehicle.Type,
    system_id: number
  ): Vehicle.Abstract | undefined {
    let vehicle: undefined | Vehicle.Abstract = undefined

    switch (firmware) {
      case Vehicle.Firmware.ArduPilot:
        vehicle = VehicleFactory.createArduPilotVehicle(type, system_id)
        break
    }

    if (vehicle === undefined) {
      unimplemented('Firmware not supported')
      return undefined
    }

    ConnectionManager.onRead.add((message) => vehicle?.onIncomingMessage(message))
    ConnectionManager.onWrite.add((message) => vehicle?.onOutgoingMessage(message))

    VehicleFactory._vehicles.push(new WeakRef(vehicle))
    VehicleFactory.onVehicles.register_caller(this.vehicles)
    VehicleFactory.onVehicles.emit()
    return vehicle
  }

  /**
   * Create ArduPilot vehicle based on the category
   * @param  {Vehicle.Type} type
   * @param  {number} system_id
   * @returns {Vehicle.Abstract | undefined}
   */
  static createArduPilotVehicle(type: Vehicle.Type, system_id: number): Vehicle.Abstract | undefined {
    switch (type) {
      case Vehicle.Type.Copter:
        return new ArduCopter(system_id)
      case Vehicle.Type.Plane:
        return new ArduPlane(system_id)
      case Vehicle.Type.Rover:
        return new ArduRover(system_id)
      case Vehicle.Type.Sub:
        return new ArduSub(system_id)
      default:
        unimplemented('Firmware not supported')
    }
  }

  /**
   * Return a list of vehicles available
   * @returns {WeakRef<Vehicle.Abstract>[]}
   */
  static vehicles(): WeakRef<Vehicle.Abstract>[] {
    // Be sure to remove vehicles that does not exist anymore
    VehicleFactory._vehicles = VehicleFactory._vehicles.filter((weakRef) => weakRef.deref() !== undefined)

    return VehicleFactory._vehicles
  }
}

/**
 * Create vehicle from message
 * @param {Uint8Array} message
 */
function createVehicleFromMessage(message: Uint8Array): void {
  // Remove from event as soon we have a single vehicle
  if (!VehicleFactory.vehicles().isEmpty()) {
    ConnectionManager.onRead.remove(createVehicleFromMessage)
    return
  }

  const textDecoder = new TextDecoder()
  const mavlink_message = JSON.parse(textDecoder.decode(message)) as Package
  const { system_id, component_id } = mavlink_message.header
  if (mavlink_message.message.type !== MAVLinkType.HEARTBEAT) {
    return
  }

  const heartbeat = mavlink_message.message as Message.Heartbeat
  if (heartbeat.autopilot.type === MavAutopilot.MAV_AUTOPILOT_INVALID) return
  if (heartbeat.autopilot.type !== MavAutopilot.MAV_AUTOPILOT_ARDUPILOTMEGA) {
    console.warn(`Vehicle not supported: ${system_id}/${component_id}: ${heartbeat.autopilot.type}`)
  }

  switch (heartbeat.mavtype.type) {
    case MavType.MAV_TYPE_SUBMARINE:
      VehicleFactory.createVehicle(Vehicle.Firmware.ArduPilot, Vehicle.Type.Sub, system_id)
      break
    case MavType.MAV_TYPE_GROUND_ROVER:
    case MavType.MAV_TYPE_SURFACE_BOAT:
      VehicleFactory.createVehicle(Vehicle.Firmware.ArduPilot, Vehicle.Type.Rover, system_id)
      break
    case MavType.MAV_TYPE_FLAPPING_WING:
    case MavType.MAV_TYPE_VTOL_TILTROTOR:
    case MavType.MAV_TYPE_VTOL_QUADROTOR:
    case MavType.MAV_TYPE_VTOL_DUOROTOR:
    case MavType.MAV_TYPE_FIXED_WING:
      VehicleFactory.createVehicle(Vehicle.Firmware.ArduPilot, Vehicle.Type.Plane, system_id)
      break
    case MavType.MAV_TYPE_TRICOPTER:
    case MavType.MAV_TYPE_COAXIAL:
    case MavType.MAV_TYPE_HEXAROTOR:
    case MavType.MAV_TYPE_HELICOPTER:
    case MavType.MAV_TYPE_OCTOROTOR:
    case MavType.MAV_TYPE_DODECAROTOR:
    case MavType.MAV_TYPE_QUADROTOR:
      VehicleFactory.createVehicle(Vehicle.Firmware.ArduPilot, Vehicle.Type.Copter, system_id)
      break
    default:
      console.warn(`Vehicle type not supported: ${system_id}/${component_id}: ${heartbeat.mavtype.type}`)
  }
}

ConnectionManager.onRead.add(createVehicleFromMessage)
