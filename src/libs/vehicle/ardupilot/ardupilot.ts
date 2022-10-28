import type {
  MAVLinkMessageDictionary,
  Package,
} from '@/libs/connection/messages/mavlink2rest'
import {
  MAVLinkType,
  MavModeFlag,
} from '@/libs/connection/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/messages/mavlink2rest-message'
import { SignalTyped } from '@/libs/signal'
import {
  Attitude,
  Battery,
  Coordinates,
  PowerSupply,
} from '@/libs/vehicle/types'

import * as Vehicle from '../vehicle'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArduPilot = ArduPilotVehicle<any>

/**
 * Generic ArduPilot vehicle
 */
export abstract class ArduPilotVehicle<
  Modes
> extends Vehicle.AbstractVehicle<Modes> {
  _attitude = new Attitude({ roll: 0, pitch: 0, yaw: 0 })
  _communicationDropRate = 0
  _communicationErrors = 0
  _coordinates = new Coordinates({
    precision: 0,
    altitude: 0,
    latitude: 0,
    longitude: 0,
  })
  _cpuLoad = 0 // CPU load in percentage
  _isArmed = false // Defines if the vehicle is armed
  _powerSupply = new PowerSupply()
  _vehicleSpecificErrors = [0, 0, 0, 0]

  _messages: MAVLinkMessageDictionary = new Map()

  onMAVLinkMessage = new SignalTyped()

  /**
   * Function for subclass inheritance
   * Helps to deal with specialized vehicles that has particular or custom behaviour
   *
   * @param {Package} mavlink message
   */
  protected onMAVLinkPackage(mavlink: Package): void {
    // Nothing here, typescript does not not have clean optional abstract methods
    // without abstract class
    mavlink
  }

  /**
   * Construct a new generic ArduPilot type
   *
   * @param {Vehicle.Type} type
   */
  constructor(type: Vehicle.Type) {
    super(Vehicle.Firmware.ArduPilot, type)
  }

  /**
   *  Decode incoming message
   *
   * @param {Uint8Array} message
   */
  onMessage(message: Uint8Array): void {
    const textDecoder = new TextDecoder()
    const mavlink_message = JSON.parse(textDecoder.decode(message)) as Package
    const { system_id, component_id } = mavlink_message.header

    if (system_id != 1 || component_id != 1) {
      return
    }

    // Update our internal messages
    this._messages.set(mavlink_message.message.type, mavlink_message.message)

    // TODO: Maybe create a signal class to deal with MAVLink only
    // Where add will use the template argument type to define the lambda argument type
    this.onMAVLinkMessage.emit_value(
      mavlink_message.message.type,
      mavlink_message
    )

    switch (mavlink_message.message.type) {
      case MAVLinkType.ATTITUDE: {
        const attitude = mavlink_message.message as Message.Attitude
        this._attitude.roll = attitude.roll
        this._attitude.pitch = attitude.pitch
        this._attitude.yaw = attitude.yaw
        this.onAttitude.emit()
        break
      }
      case MAVLinkType.GLOBAL_POSITION_INT: {
        const position = mavlink_message.message as Message.GlobalPositionInt
        this._coordinates.precision = 1
        this._coordinates.altitude = position.alt / 1000 // (mm to meters)
        this._coordinates.latitude = position.lat / 1e7 // DegE7 to Deg
        this._coordinates.longitude = position.lon / 1e7 // DegE7 to Deg
        this.onPosition.emit()
        break
      }
      case MAVLinkType.HEARTBEAT: {
        const heartbeat = mavlink_message.message as Message.Heartbeat

        this._isArmed = Boolean(
          heartbeat.base_mode.bits & MavModeFlag.MAV_MODE_FLAG_SAFETY_ARMED
        )
        this.onArm.emit()
        break
      }
      case MAVLinkType.SYS_STATUS: {
        const sysStatus = mavlink_message.message as Message.SysStatus
        this._cpuLoad = sysStatus.load / 10 // Permille CPU usage
        this.onCpuLoad.emit()

        this._powerSupply.voltage = sysStatus.voltage_battery / 100 // centVolts to Volts
        this._powerSupply.current =
          sysStatus.current_battery === -1
            ? undefined
            : sysStatus.current_battery / 100 // centAmps, -1 if not available
        this._powerSupply.remaining =
          sysStatus.battery_remaining === -1
            ? undefined
            : sysStatus.battery_remaining // -1 if not available
        this.onPowerSupply.emit()

        this._communicationDropRate = sysStatus.drop_rate_comm // Drop rate of packets that were corrupted on reception
        this._communicationErrors = sysStatus.errors_comm // Number of packets that were corrupted on reception
        this._vehicleSpecificErrors = [
          sysStatus._errors_count1,
          sysStatus._errors_count2,
          sysStatus._errors_count3,
          sysStatus._errors_count4,
        ] // Autopilot-specific errors
        break
      }
      default:
        break
    }

    this.onMAVLinkPackage(mavlink_message)
  }

  /**
   * Arm vehicle
   *
   * @returns {boolean}
   */
  arm(): boolean {
    unimplemented()
    return true
  }

  /**
   * Return vehicle attitude
   *
   * @returns {Attitude}
   */
  attitude(): Attitude {
    return this._attitude
  }

  /**
   * Get batteries status
   *
   * @returns {Battery[]}
   */
  batteries(): Battery[] {
    return [new Battery({ cells: [0, 0, 0, 0, 0, 0], voltage: 0 })]
  }

  /**
   * Get CPU load percentage
   *
   * @returns {number}
   */
  cpuLoad(): number {
    return this._cpuLoad
  }

  /**
   * Disarm vehicle
   *
   * @returns {boolean}
   */
  disarm(): boolean {
    unimplemented()
    return true
  }

  /**
   * Check if vehicle is armed
   *
   * @returns {boolean}
   */
  isArmed(): boolean {
    return this._isArmed
  }

  /**
   * Return vehicle position information
   *
   * @returns {Coordinates}
   */
  position(): Coordinates {
    return this._coordinates
  }
  /**
   * Return power supply information
   *
   * @returns {PowerSupply}
   */
  powerSupply(): PowerSupply {
    return this._powerSupply
  }
}
