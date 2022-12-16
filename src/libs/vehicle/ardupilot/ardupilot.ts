import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { MAVLinkMessageDictionary, Message as MavMessage, Package } from '@/libs/connection/messages/mavlink2rest'
import { MavCmd, MavComponent, MAVLinkType, MavModeFlag } from '@/libs/connection/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/messages/mavlink2rest-message'
import { SignalTyped } from '@/libs/signal'
import { type PageDescription, Altitude, Attitude, Battery, Coordinates, PowerSupply } from '@/libs/vehicle/types'

import * as Vehicle from '../vehicle'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArduPilot = ArduPilotVehicle<any>

/**
 * Generic ArduPilot vehicle
 */
export abstract class ArduPilotVehicle<Modes> extends Vehicle.AbstractVehicle<Modes> {
  _altitude = new Altitude({ msl: 0, climb_rate: 0 })
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
   * Helper to send long mavlink commands
   * Each parameter depends of the value specified by the protocol
   *
   * @param {MavCmd} mav_command
   * @param {number} param1
   * @param {number} param2
   * @param {number} param3
   * @param {number} param4
   * @param {number} param5
   * @param {number} param6
   * @param {number} param7
   */
  sendCommandLong(
    mav_command: MavCmd,
    param1?: number,
    param2?: number,
    param3?: number,
    param4?: number,
    param5?: number,
    param6?: number,
    param7?: number
  ): void {
    const command: Message.CommandLong = {
      type: MAVLinkType.COMMAND_LONG,
      param1: param1 ?? 0,
      param2: param2 ?? 0,
      param3: param3 ?? 0,
      param4: param4 ?? 0,
      param5: param5 ?? 0,
      param6: param6 ?? 0,
      param7: param7 ?? 0,
      command: {
        type: mav_command,
      },
      target_system: 1,
      target_component: 1,
      confirmation: 0,
    }

    this.write(command)
  }

  /**
   * Send a mavlink message
   *
   * @param {MavMessage} message
   */
  write(message: MavMessage): void {
    const pack: Package = {
      header: {
        system_id: 255, // GCS system ID
        component_id: Number(MavComponent.MAV_COMP_ID_UDP_BRIDGE), // Used by historical reasons (Check QGC)
        sequence: 0,
      },
      message: message,
    }
    const textEncoder = new TextEncoder()
    ConnectionManager.write(textEncoder.encode(JSON.stringify(pack)))
  }

  /**
   *  Decode incoming message
   *
   * @param {Uint8Array} message
   */
  onMessage(message: Uint8Array): void {
    const textDecoder = new TextDecoder()
    let mavlink_message: Package
    const text_message = textDecoder.decode(message)
    try {
      mavlink_message = JSON.parse(text_message) as Package
    } catch (error) {
      console.error(`Failed to parse mavlink message: ${text_message}`)
      return
    }

    const { system_id, component_id } = mavlink_message.header

    if (system_id != 1 || component_id != 1) {
      return
    }

    // Update our internal messages
    this._messages.set(mavlink_message.message.type, mavlink_message.message)

    // TODO: Maybe create a signal class to deal with MAVLink only
    // Where add will use the template argument type to define the lambda argument type
    this.onMAVLinkMessage.emit_value(mavlink_message.message.type, mavlink_message)

    switch (mavlink_message.message.type) {
      case MAVLinkType.VFR_HUD: {
        const vfrHud = mavlink_message.message as Message.VfrHud
        this._altitude.msl = vfrHud.alt
        this._altitude.climb_rate = vfrHud.climb
        this.onAltitude.emit()
        break
      }
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

        this._isArmed = Boolean(heartbeat.base_mode.bits & MavModeFlag.MAV_MODE_FLAG_SAFETY_ARMED)
        this.onArm.emit()
        break
      }
      case MAVLinkType.SYS_STATUS: {
        const sysStatus = mavlink_message.message as Message.SysStatus
        this._cpuLoad = sysStatus.load / 10 // Permille CPU usage
        this.onCpuLoad.emit()

        this._powerSupply.voltage = sysStatus.voltage_battery / 100 // centVolts to Volts
        this._powerSupply.current = sysStatus.current_battery === -1 ? undefined : sysStatus.current_battery / 100 // centAmps, -1 if not available
        this._powerSupply.remaining = sysStatus.battery_remaining === -1 ? undefined : sysStatus.battery_remaining // -1 if not available
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
   * Helper function to arm/disarm the vehicle
   *
   * @param {boolean} arm
   * @param {boolean} force
   */
  _arm(arm: boolean, force?: boolean): void {
    this.sendCommandLong(
      MavCmd.MAV_CMD_COMPONENT_ARM_DISARM,
      arm ? 1 : 0, // 0: Disarm, 1: ARM
      force ? 21196 : 0 // 21196: force arming/disarming (e.g. override preflight checks and disarming in flight)
    )
  }

  /**
   * Arm vehicle
   *
   * @returns {boolean}
   */
  arm(): boolean {
    this._arm(true)
    return true
  }

  /**
   * Return vehicle altitude-related data
   *
   * @returns {Altitude}
   */
  altitude(): Altitude {
    return this._altitude
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
   * Vehicle specific configuration pages
   *
   * @returns {PageDescription[]}
   */
  configurationPages(): PageDescription[] {
    return []
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
    this._arm(false)
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

  /**
   * Set vehicle flight mode
   *
   * @param {'Modes'} mode Custom vehicle mode
   */
  setMode(mode: Modes): void {
    this.sendCommandLong(
      MavCmd.MAV_CMD_DO_SET_MODE,
      MavModeFlag.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
      Number(mode) // Custom mode, please refer to the individual autopilot specifications for details
    )
  }
}
