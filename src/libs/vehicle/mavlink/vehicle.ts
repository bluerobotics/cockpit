import { differenceInMilliseconds } from 'date-fns'
import { defaultMessageIntervalsOptions } from 'defaults'
import { unit } from 'mathjs'

import {
  createDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { createTransformingFunction, getAllTransformingFunctions } from '@/libs/actions/data-lake-transformations'
import { sendMavlinkMessage } from '@/libs/communication/mavlink'
import type { MAVLinkMessageDictionary, Package, Type } from '@/libs/connection/m2r/messages/mavlink2rest'
import {
  getMAVLinkMessageId,
  GpsFixType,
  MavAutopilot,
  MavCmd,
  MAVLinkType,
  MavMissionResult,
  MavMissionType,
  MavModeFlag,
  MavParamType,
  MavResult,
  MavState,
  MavType,
} from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { MavFrame } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { SignalTyped } from '@/libs/signal'
import { degrees, frequencyHzToIntervalUs, round, sleep } from '@/libs/utils'
import {
  type MAVLinkParameterSetData,
  type MessageIntervalOptions,
  alertLevelFromMavSeverity,
  convertCockpitWaypointsToMavlink,
  convertMavlinkWaypointsToCockpit,
} from '@/libs/vehicle/mavlink/types'
import {
  type PageDescription,
  Altitude,
  Attitude,
  Battery,
  CommandAck,
  Coordinates,
  FixTypeGPS,
  Parameter,
  PowerSupply,
  StatusGPS,
  StatusText,
  Velocity,
} from '@/libs/vehicle/types'
import { type MissionLoadingCallback, type Waypoint, defaultLoadingCallback } from '@/types/mission'
import { DataLakeVariable } from '@/types/widgets'

import { flattenData } from '../common/data-flattener'
import * as Vehicle from '../vehicle'

export const MAVLINK_MESSAGE_INTERVALS_STORAGE_KEY = 'cockpit-mavlink-message-intervals'

/**
 * Generic MAVLink vehicle
 */
export abstract class MAVLinkVehicle<Modes> extends Vehicle.AbstractVehicle<Modes> {
  _dateLastHeartbeat: Date | undefined = undefined
  _altitude = new Altitude({ msl: unit(0, 'm'), rel: 0 })
  _attitude = new Attitude({ roll: 0, pitch: 0, yaw: 0 })
  _communicationDropRate = 0
  _communicationErrors = 0
  _coordinates = new Coordinates({
    precision: 0,
    altitude: 0,
    latitude: 0,
    longitude: 0,
  })
  _velocity = new Velocity({ x: 0, y: 0, z: 0, ground: 0, overall: 0 })
  _cpuLoad = 0 // CPU load in percentage
  _isArmed = false // Defines if the vehicle is armed
  _powerSupply = new PowerSupply()
  _lastParameter = new Parameter()
  _totalParametersCount: number | undefined = undefined
  _currentMavlinkMissionItemsOnVehicle: Message.MissionItemInt[] = []
  _statusText = new StatusText()
  _statusGPS = new StatusGPS()
  _vehicleSpecificErrors = [0, 0, 0, 0]

  _messages: MAVLinkMessageDictionary = new Map()

  onIncomingMAVLinkMessage = new SignalTyped()
  onOutgoingMAVLinkMessage = new SignalTyped()
  _flying = false

  shouldCreateDatalakeVariablesFromOtherSystems = false

  protected currentSystemId = 1

  /**
   * Create MAVLink vehicle
   * @param {Vehicle.Firmware} firmware
   * @param {Vehicle.Type} type
   * @param {number} systemId
   */
  constructor(firmware: Vehicle.Firmware, type: Vehicle.Type, systemId: number) {
    super(firmware, type)
    this.currentSystemId = systemId

    // Request vehicle to stream a pre-defined list of messages so the GCS can receive them
    try {
      this.requestDefaultMessages()
    } catch (error) {
      console.error('Failed to request default messages from the vehicle.')
      console.error(error)
    }

    // Create data-lake variables for the vehicle
    this.createPredefinedDataLakeVariables()

    // Set the system ID in the data-lake
    setDataLakeVariableData(this.preDefinedDataLakeVariables.autopilotSystemId.id, systemId)
  }

  /**
   * Returns the current system ID
   * @returns {number}
   */
  get systemId(): number {
    return this.currentSystemId
  }

  /**
   * Function for subclass inheritance
   * Helps to deal with specialized vehicles that has particular or custom behaviour
   * @param {Package} mavlink message
   */
  protected onMAVLinkPackage(mavlink: Package): void {
    // Nothing here, typescript does not not have clean optional abstract methods
    // without abstract class
    mavlink
  }

  /**
   * Helper to send mavlink commands
   * @param {Message.CommandLong | Message.CommandInt} commandMessage
   * @returns {Promise<void>} A promise that resolves with the command acknowledgment.
   */
  async sendCommand(commandMessage: Message.CommandLong | Message.CommandInt): Promise<void> {
    sendMavlinkMessage(commandMessage)

    // Monitor the acknowledgment of the command and throw an error if it fails or reaches a timeout
    let incomingAckCommand: CommandAck | undefined = undefined
    let receivedCommandAck = false
    let timeoutReached = false
    const timeout = 5000

    const ackHandler = (commandAck: CommandAck): void => {
      incomingAckCommand = commandAck
    }

    const dateCommand = new Date()
    this.onCommandAck.add(ackHandler)

    // Wait for the acknowledgment to be received
    while (!timeoutReached && !receivedCommandAck) {
      await sleep(100)
      receivedCommandAck = (incomingAckCommand as unknown as CommandAck)?.command.type === commandMessage.command.type
      timeoutReached = differenceInMilliseconds(new Date(), dateCommand) > timeout
    }

    this.onCommandAck.remove(ackHandler)

    if (!receivedCommandAck) {
      throw Error(
        `No acknowledgment received for command '${commandMessage.command.type}' before timeout (${timeout / 1000}s).`
      )
    }

    // We already tested the ack and know that it is of the correct type
    const commandAck = incomingAckCommand as unknown as CommandAck

    console.debug('Received command acknowledgment:', commandAck)

    const confirmationResults = [MavResult.MAV_RESULT_ACCEPTED, MavResult.MAV_RESULT_IN_PROGRESS]
    if (confirmationResults.includes(commandAck.result.type)) {
      return
    }

    throw new Error(`Command '${commandAck.command.type}' failed with result '${commandAck.result.type}'.`)
  }

  /**
   * Helper to send long mavlink commands
   * Each parameter depends of the value specified by the protocol
   * @param {MavCmd} mav_command
   * @param {number} param1
   * @param {number} param2
   * @param {number} param3
   * @param {number} param4
   * @param {number} param5
   * @param {number} param6
   * @param {number} param7
   * @returns {Promise<void>} A promise that resolves when the command is acknowledged.
   */
  async sendCommandLong(
    mav_command: MavCmd,
    param1 = 0,
    param2 = 0,
    param3 = 0,
    param4 = 0,
    param5 = 0,
    param6 = 0,
    param7 = 0
  ): Promise<void> {
    const commandMessage: Message.CommandLong = {
      type: MAVLinkType.COMMAND_LONG,
      param1: param1,
      param2: param2,
      param3: param3,
      param4: param4,
      param5: param5,
      param6: param6,
      param7: param7,
      command: {
        type: mav_command,
      },
      target_system: this.currentSystemId,
      target_component: 1,
      confirmation: 0,
    }
    return this.sendCommand(commandMessage)
  }

  /**
   * Helper to send int mavlink commands
   * Each parameter depends of the value specified by the protocol
   * @param {MavCmd} mav_command
   * @param {number} param1
   * @param {number} param2
   * @param {number} param3
   * @param {number} param4
   * @param {number} x (latitude)
   * @param {number} y (longitude)
   * @param {number} z (altitude)
   * @returns {Promise<void>} A promise that resolves when the command is acknowledged.
   */
  async sendCommandInt(
    mav_command: MavCmd,
    param1 = 0,
    param2 = 0,
    param3 = 0,
    param4 = 0,
    x = 0,
    y = 0,
    z = 0
  ): Promise<void> {
    const commandMessage: Message.CommandInt = {
      type: MAVLinkType.COMMAND_INT,
      param1: param1,
      param2: param2,
      param3: param3,
      param4: param4,
      x: Math.round((x || 0) * 1e7),
      y: Math.round((y || 0) * 1e7),
      z: z,
      command: {
        type: mav_command,
      },
      target_system: this.currentSystemId,
      target_component: 1,
      frame: { type: MavFrame.MAV_FRAME_GLOBAL },
      current: 0,
      autocontinue: 0,
    }
    return this.sendCommand(commandMessage)
  }

  /**
   * Log outgoing messages
   * @param {Uint8Array} message
   */
  onOutgoingMessage(message: Uint8Array): void {
    const textDecoder = new TextDecoder()
    let mavlink_message: Package
    const text_message = textDecoder.decode(message)
    try {
      mavlink_message = JSON.parse(text_message) as Package
      this.onOutgoingMAVLinkMessage.emit_value(mavlink_message.message.type, mavlink_message)
    } catch (error) {
      const pattern = /Ok\((\d+)\)/
      const match = pattern.exec(text_message)
      if (match) return
      console.error(`Failed to parse mavlink message: ${text_message}`)
      return
    }
  }

  /**
   *  Decode incoming message
   * @param {Uint8Array} message
   */
  onIncomingMessage(message: Uint8Array): void {
    const textDecoder = new TextDecoder()
    let mavlink_message: Package
    const text_message = textDecoder.decode(message)
    try {
      mavlink_message = JSON.parse(text_message) as Package
    } catch (error) {
      const pattern = /Ok\((\d+)\)/
      const match = pattern.exec(text_message)
      if (match) return
      console.error(`Failed to parse mavlink message: ${text_message}`)
      return
    }

    const { system_id, component_id } = mavlink_message.header

    if (system_id !== this.currentSystemId || component_id !== 1) {
      // For non-main systems, only inject variables from the MAVLink messages into the DataLake if the user wants to
      if (this.shouldCreateDatalakeVariablesFromOtherSystems) {
        this.addPackageVariablesToDataLake(mavlink_message)
      }

      return
    }

    // For the main vehicle, always inject variables from the MAVLink messages into the DataLake
    this.addPackageVariablesToDataLake(mavlink_message)

    // Update our internal messages
    this._messages.set(mavlink_message.message.type, { ...mavlink_message.message, epoch: new Date().getTime() })

    // TODO: Maybe create a signal class to deal with MAVLink only
    // Where add will use the template argument type to define the lambda argument type
    this.onIncomingMAVLinkMessage.emit_value(mavlink_message.message.type, mavlink_message)

    switch (mavlink_message.message.type) {
      // command_ack
      case MAVLinkType.COMMAND_ACK: {
        const commandAck = mavlink_message.message as Message.CommandAck

        const ack = new CommandAck({
          command: commandAck.command,
          result: commandAck.result,
          progress: commandAck.progress,
          targetSystem: commandAck.targetSystem,
          targetComponent: commandAck.targetComponent,
        })

        // emit on command_ack
        this.onCommandAck.emit_value(ack)
        break
      }
      case MAVLinkType.AHRS2: {
        const ahrsMessage = mavlink_message.message as Message.Ahrs2
        this._altitude.msl = unit(ahrsMessage.altitude, 'm')
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
      case MAVLinkType.GIMBAL_DEVICE_ATTITUDE_STATUS: {
        const attitude = mavlink_message.message as Message.GimbalDeviceAttitudeStatus

        const x = attitude.q[0]
        const y = attitude.q[1]
        const z = attitude.q[2]
        const w = attitude.q[3]

        const sinp = 2 * (w * y - z * x)
        let pitch
        if (Math.abs(sinp) >= 1) {
          pitch = (Math.PI / 2) * Math.sign(sinp) // use 90 degrees if out of range
        } else {
          pitch = Math.asin(sinp)
        }
        setDataLakeVariableData(this.preDefinedDataLakeVariables.cameraTilt.id, degrees(pitch))
        setDataLakeVariableData(this.preDefinedDataLakeVariables.cameraTiltLegacy.id, degrees(pitch))
        break
      }
      case MAVLinkType.GLOBAL_POSITION_INT: {
        const position = mavlink_message.message as Message.GlobalPositionInt
        this._coordinates.precision = 1
        this._coordinates.altitude = position.alt / 1000 // (mm to meters)
        this._coordinates.latitude = position.lat / 1e7 // DegE7 to Deg
        this._coordinates.longitude = position.lon / 1e7 // DegE7 to Deg
        this.onPosition.emit()
        this._velocity.x = position.vx / 100 // Convert cm/s to m/s
        this._velocity.y = position.vy / 100 // Convert cm/s to m/s
        this._velocity.z = position.vz / 100 // Convert cm/s to m/s
        this._velocity.ground = Math.sqrt(this._velocity.x ** 2 + this._velocity.y ** 2)
        this._velocity.overall = Math.sqrt(this._velocity.x ** 2 + this._velocity.y ** 2 + this._velocity.z ** 2)
        this.onVelocity.emit()
        this._altitude.rel = position.relative_alt / 1000 // (mm to meters)
        this.onAltitude.emit()
        break
      }
      case MAVLinkType.GPS_RAW_INT: {
        const gpsMessage = mavlink_message.message as Message.GpsRawInt
        this._statusGPS.visibleSatellites = gpsMessage.satellites_visible
        this._statusGPS.HDOP = round(gpsMessage.eph / 100)
        this._statusGPS.VDOP = round(gpsMessage.epv / 100)
        const gpsFixTable = {
          [GpsFixType.GPS_FIX_TYPE_NO_GPS]: FixTypeGPS.NO_GPS,
          [GpsFixType.GPS_FIX_TYPE_NO_FIX]: FixTypeGPS.NO_FIX,
          [GpsFixType.GPS_FIX_TYPE_2D_FIX]: FixTypeGPS.FIX_2D,
          [GpsFixType.GPS_FIX_TYPE_3D_FIX]: FixTypeGPS.FIX_3D,
          [GpsFixType.GPS_FIX_TYPE_DGPS]: FixTypeGPS.DGPS,
          [GpsFixType.GPS_FIX_TYPE_RTK_FLOAT]: FixTypeGPS.RTK_FLOAT,
          [GpsFixType.GPS_FIX_TYPE_RTK_FIXED]: FixTypeGPS.RTK_FIXED,
          [GpsFixType.GPS_FIX_TYPE_STATIC]: FixTypeGPS.STATIC,
          [GpsFixType.GPS_FIX_TYPE_PPP]: FixTypeGPS.PPP,
        }
        this._statusGPS.fixType = gpsFixTable[(gpsMessage.fix_type as unknown as Type<GpsFixType>).type]
        this.onStatusGPS.emit()
        break
      }
      case MAVLinkType.HEARTBEAT: {
        const heartbeat = mavlink_message.message as Message.Heartbeat
        this._dateLastHeartbeat = new Date()

        this._isArmed = Boolean(heartbeat.base_mode.bits & MavModeFlag.MAV_MODE_FLAG_SAFETY_ARMED)
        this.onArm.emit()
        this._flying = heartbeat.system_status.type === MavState.MAV_STATE_ACTIVE
        this.onTakeoff.emit()
        break
      }
      case MAVLinkType.SYS_STATUS: {
        const sysStatus = mavlink_message.message as Message.SysStatus
        this._cpuLoad = sysStatus.load / 10 // Permille CPU usage
        this.onCpuLoad.emit()

        this._powerSupply.voltage = sysStatus.voltage_battery / 1000 // milliVolts to Volts
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

      case MAVLinkType.PARAM_VALUE: {
        const receivedMessage = mavlink_message.message as Message.ParamValue
        const param_name = receivedMessage.param_id.join('').replace(/\0/g, '')
        const { param_value, param_count } = receivedMessage
        // We need this due to mismatches between js 64-bit floats and REAL32 in MAVLink
        const trimmed_value = Math.round(param_value * 10000) / 10000

        this._lastParameter = { name: param_name, value: trimmed_value }
        this._totalParametersCount = Number(param_count)
        this.onParameter.emit()
        break
      }

      case MAVLinkType.STATUSTEXT: {
        const statusText = mavlink_message.message as Message.Statustext
        this._statusText.text = statusText.text.filter((char) => char.toString() !== '\u0000').join('')
        this._statusText.severity = alertLevelFromMavSeverity[statusText.severity.type]
        this.onStatusText.emit()
        break
      }

      default:
        break
    }

    this.onMAVLinkPackage(mavlink_message)
  }

  /**
   * Helper function to arm/disarm the vehicle
   * @param {boolean} arm
   * @param {boolean} force
   */
  async _arm(arm: boolean, force?: boolean): Promise<void> {
    await this.sendCommandLong(
      MavCmd.MAV_CMD_COMPONENT_ARM_DISARM,
      arm ? 1 : 0, // 0: Disarm, 1: ARM
      force ? 21196 : 0 // 21196: force arming/disarming (e.g. override preflight checks and disarming in flight)
    )
  }

  /**
   * Arm vehicle
   * @returns {Promise<void>}
   */
  async arm(): Promise<void> {
    await this._arm(true)
  }

  /**
   * Helper function for changing the altitude of the vehicle
   * @param {number} altitude (in meters)
   */
  _changeAltitude(altitude: number): void {
    const gotoMessage: Message.SetPositionTargetLocalNed = {
      time_boot_ms: 0,
      type: MAVLinkType.SET_POSITION_TARGET_LOCAL_NED,
      target_system: this.currentSystemId,
      target_component: 1,
      coordinate_frame: { type: MavFrame.MAV_FRAME_LOCAL_OFFSET_NED },
      type_mask: { bits: 0b0000111111111000 },
      x: 0,
      y: 0,
      z: altitude,
      vx: 0,
      vy: 0,
      vz: 0,
      afx: 0,
      afy: 0,
      afz: 0,
      yaw: 0,
      yaw_rate: 0,
    }

    sendMavlinkMessage(gotoMessage)
  }

  /**
   * Change altitude
   * @param {number} altitudeSetpoint
   * @returns {void}
   */
  changeAltitude(altitudeSetpoint: number): void {
    this._changeAltitude(altitudeSetpoint)
    return
  }

  /**
   * Helper function for commanding takeoff
   * @param {number} altitude (in meters)
   * @returns {Promise<void>} A promise that resolves if the takeoff command is accepted.
   */
  async _takeoff(altitude: number): Promise<void> {
    return await this.sendCommandLong(MavCmd.MAV_CMD_NAV_TAKEOFF, 0, 0, 0, 0, 0, 0, altitude)
  }

  /**
   * Takeoff
   * @param {number} altitudeSetpoint
   * @returns {Promise<void>}
   */
  async takeoff(altitudeSetpoint: number): Promise<void> {
    const guidedMode = this.modesAvailable().get('GUIDED')
    if (guidedMode === undefined) {
      throw new Error("Vehicle doesn't support GUIDED mode.")
    }

    await this.setMode(guidedMode as Modes)
    await this.arm()
    await this._takeoff(altitudeSetpoint)
    this.onTakeoff.emit()
    return
  }

  /**
   * Land
   * @returns {Promise<void>}
   */
  async land(): Promise<void> {
    const landMode = this.modesAvailable().get('LAND')
    if (landMode === undefined) {
      throw new Error("Vehicle doesn't support LAND mode.")
    }
    await this.setMode(landMode as Modes)
    return
  }

  /**
   * Goto position
   * @param {number} hold Hold time. (ignored by fixed wing, time to stay at waypoint for rotary wing)
   * @param {number} acceptanceRadius Acceptance radius (if the sphere with this radius is hit, the waypoint counts as reached)
   * @param {number} passRadius 0 to pass through the WP, if > 0 radius to pass by WP. Positive value for clockwise orbit, negative value for counter-clockwise orbit. Allows trajectory control.
   * @param {number} yaw Desired yaw angle at waypoint (rotary wing). NaN to use the current system yaw heading mode (e.g. yaw towards next waypoint, yaw to home, etc.).
   * @param {Coordinates} coordinates
   * @returns {Promise<void>} A promise that resolves when the command is sent
   */
  async goTo(
    hold: number,
    acceptanceRadius: number,
    passRadius: number,
    yaw: number,
    coordinates: Coordinates
  ): Promise<void> {
    await this.sendCommandInt(
      MavCmd.MAV_CMD_DO_REPOSITION,
      hold,
      acceptanceRadius,
      passRadius,
      yaw,
      coordinates.latitude,
      coordinates.longitude,
      coordinates.altitude
    )
  }

  /**
   * Get the date of the last heartbeat
   * @returns {Date}
   */
  dateLastHeartbeat(): Date | undefined {
    return this._dateLastHeartbeat
  }

  /**
   * Return vehicle altitude-related data
   * @returns {Altitude}
   */
  altitude(): Altitude {
    return this._altitude
  }

  /**
   * Return vehicle attitude
   * @returns {Attitude}
   */
  attitude(): Attitude {
    return this._attitude
  }

  /**
   * Get batteries status
   * @returns {Battery[]}
   */
  batteries(): Battery[] {
    return [new Battery({ cells: [0, 0, 0, 0, 0, 0], voltage: 0 })]
  }

  /**
   * Vehicle specific configuration pages
   * @returns {PageDescription[]}
   */
  configurationPages(): PageDescription[] {
    return []
  }

  /**
   * Get CPU load percentage
   * @returns {number}
   */
  cpuLoad(): number {
    return this._cpuLoad
  }

  /**
   * Disarm vehicle
   * @returns {Promise<void>}
   */
  async disarm(): Promise<void> {
    await this._arm(false)
  }

  /**
   * Check if vehicle is armed
   * @returns {boolean}
   */
  isArmed(): boolean {
    return this._isArmed
  }

  /**
   * Check if the vehicle is flying
   * @returns {boolean}
   */
  flying(): boolean {
    return this._flying
  }

  /**
   * Return vehicle position information
   * @returns {Coordinates}
   */
  position(): Coordinates {
    return this._coordinates
  }

  /**
   * Return vehicle velocity information
   * @returns {Velocity}
   */
  velocity(): Velocity {
    return this._velocity
  }

  /**
   * Return power supply information
   * @returns {PowerSupply}
   */
  powerSupply(): PowerSupply {
    return this._powerSupply
  }

  /**
   * Return power supply information
   * @returns {Parameter}
   */
  lastParameter(): Parameter {
    return this._lastParameter
  }

  /**
   * Return total amount of parameters in the vehicle
   * @returns {number}
   */
  totalParametersCount(): number | undefined {
    return this._totalParametersCount
  }

  /**
   * Return status text information
   * @returns {StatusText}
   */
  statusText(): StatusText {
    return this._statusText
  }

  /**
   * Return GPS status information
   * @returns {StatusGPS}
   */
  statusGPS(): StatusGPS {
    return this._statusGPS
  }

  /**
   * Send heartbeat from GCS
   */
  sendGcsHeartbeat(): void {
    const heartbeatMessage: Message.Heartbeat = {
      type: MAVLinkType.HEARTBEAT,
      custom_mode: 0,
      mavtype: { type: MavType.MAV_TYPE_GCS },
      autopilot: { type: MavAutopilot.MAV_AUTOPILOT_INVALID },
      base_mode: { bits: MavModeFlag.MAV_MODE_FLAG_SAFETY_ARMED | MavModeFlag.MAV_MODE_FLAG_MANUAL_INPUT_ENABLED },
      system_status: { type: MavState.MAV_STATE_ACTIVE },
      mavlink_version: 1,
    }

    sendMavlinkMessage(heartbeatMessage)
  }

  /**
   * Send system time from GCS
   */
  sendSystemTime(): void {
    const time_since_gcs_start_ms = performance.now()
    const systemTimeMessage: Message.SystemTime = {
      type: MAVLinkType.SYSTEM_TIME,
      time_unix_usec: Math.floor((performance.timeOrigin + time_since_gcs_start_ms) * 1000),
      time_boot_ms: Math.floor(time_since_gcs_start_ms),
    }
    sendMavlinkMessage(systemTimeMessage)
  }

  /**
   * Measure network latency to vehicle using TIMESYNC message
   * @returns {Promise<void>}
   */
  async measureLatency(): Promise<void> {
    const time_sent_ns = Math.floor(performance.now() * 1e6)
    let receivedTimesync = false
    let timeoutReached = false
    let latencyNs = 0
    const timeout = 5000

    const timesyncHandler = (pack: Package): void => {
      const timesync = pack.message as Message.Timesync
      if (timesync.ts1 === time_sent_ns) {
        const time_received_ns = Math.floor(performance.now() * 1e6)
        // we could use the tc1 value to calculate the latency, but I think that would give us the
        // GCS -> vehicle latency, not the round trip latency.
        latencyNs = (time_received_ns - time_sent_ns) / 2
        receivedTimesync = true
      }
    }

    const timeSyncMessage: Message.Timesync = {
      type: MAVLinkType.TIMESYNC,
      ts1: time_sent_ns,
      tc1: 0,
      target_system: this.currentSystemId,
      target_component: 1,
    }
    const startTime = performance.now()
    this.onIncomingMAVLinkMessage.add(MAVLinkType.TIMESYNC, timesyncHandler)

    sendMavlinkMessage(timeSyncMessage)

    while (!timeoutReached && !receivedTimesync) {
      await sleep(100)
      timeoutReached = performance.now() - startTime > timeout
    }

    this.onIncomingMAVLinkMessage.remove(MAVLinkType.TIMESYNC, timesyncHandler)

    if (!receivedTimesync) {
      console.warn(`No TIMESYNC response received before timeout (${timeout / 1000}s).`)
      latencyNs = 0
    }

    const latencyMs = latencyNs * 1e-6
    setDataLakeVariableData(this.preDefinedDataLakeVariables.networkLatencyMs.id, latencyMs)
  }

  /**
   * Set vehicle flight mode
   * @param {'Modes'} mode Custom vehicle mode
   */
  async setMode(mode: Modes): Promise<void> {
    await this.sendCommandLong(
      MavCmd.MAV_CMD_DO_SET_MODE,
      MavModeFlag.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
      Number(mode) // Custom mode, please refer to the individual autopilot specifications for details
    )
  }

  /**
   * Request parameters list from vehicle
   */
  requestParametersList(): void {
    const paramRequestMessage: Message.ParamRequestList = {
      type: MAVLinkType.PARAM_REQUEST_LIST,
      target_system: this.currentSystemId,
      target_component: 0,
    }
    sendMavlinkMessage(paramRequestMessage)
  }

  /**
   * Request parameters list from vehicle
   * @param { MAVLinkParameterSetData } settings Data used to set a parameter
   */
  setParameter(settings: MAVLinkParameterSetData): void {
    const param_name = [...settings.id]
    while (param_name.length < 16) {
      param_name.push('\0')
    }
    const paramSetMessage: Message.ParamSet = {
      type: MAVLinkType.PARAM_SET,
      target_system: this.currentSystemId,
      target_component: 0,
      // @ts-ignore: The correct type is indeed a char array
      param_id: param_name,
      param_value: settings.value,
      // @ts-ignore: The correct type is indeed a Type<MavParamType>
      param_type: settings.type ?? { type: MavParamType.MAV_PARAM_TYPE_UINT8 },
    }
    sendMavlinkMessage(paramSetMessage)
  }

  /**
   * Set the interval for a specific message type
   * @param { MAVLinkType } messageType
   * @param { number } intervalUs Interval in microseconds. -1 to disable the message. 0 to use the default interval (as configured by the vehicle or other sources).
   */
  async setMessageInterval(messageType: MAVLinkType, intervalUs: number): Promise<void> {
    if (intervalUs < 0 && intervalUs !== -1) {
      throw new Error('Cannot set a negative interval for a message interval.')
    }
    await this.sendCommandLong(MavCmd.MAV_CMD_SET_MESSAGE_INTERVAL, getMAVLinkMessageId(messageType), intervalUs)
  }

  /**
   * Configure message interval with options
   * @param { MAVLinkType } messageType
   * @param { MessageIntervalOptions } options
   */
  async setMessageFrequency(messageType: MAVLinkType, options: MessageIntervalOptions): Promise<void> {
    switch (options.intervalType) {
      case 'default':
        await this.setMessageInterval(messageType, 0)
        break
      case 'disabled':
        await this.setMessageInterval(messageType, -1)
        break
      case 'custom': {
        if (options.frequencyHz === undefined || options.frequencyHz <= 0) {
          throw new Error('Custom interval requires a positive frequency value.')
        }
        const intervalUs = round(frequencyHzToIntervalUs(options.frequencyHz), 0)
        await this.setMessageInterval(messageType, intervalUs)
        break
      }
      default:
        throw new Error(`Unknown interval type!`) // This should never happen
    }
  }

  /**
   * Request the vehicle to send a pre-defined list of messages, on it's data stream
   * Those are messages usually used by any Ardupilot vehicle
   */
  async requestDefaultMessages(): Promise<void> {
    // Get custom message intervals from BlueOS storage, fallback to defaults if not available
    const customMessageIntervalsStoredString = window.localStorage.getItem(MAVLINK_MESSAGE_INTERVALS_STORAGE_KEY)
    const cockpitDefaultMessageIntervals = defaultMessageIntervalsOptions

    let toBeSetIntervals: Record<string, MessageIntervalOptions> = {}
    if (customMessageIntervalsStoredString === null) {
      toBeSetIntervals = cockpitDefaultMessageIntervals
    } else {
      const customMessageIntervals = JSON.parse(customMessageIntervalsStoredString)
      toBeSetIntervals = { ...cockpitDefaultMessageIntervals, ...customMessageIntervals }
    }
    window.localStorage.setItem(MAVLINK_MESSAGE_INTERVALS_STORAGE_KEY, JSON.stringify(toBeSetIntervals))

    // Remove any message that was configured to not be touched
    Object.entries(toBeSetIntervals).forEach(([messageType, options]) => {
      if (options.intervalType === 'dontTouch') {
        delete toBeSetIntervals[messageType]
      }
    })

    const commandPromises = Object.entries(toBeSetIntervals).map(([messageType, options]) => {
      return this.setMessageFrequency(messageType as MAVLinkType, options as MessageIntervalOptions)
    })

    const results = await Promise.allSettled(commandPromises)

    const rejectedCommands = results.filter((result) => result.status !== 'fulfilled')
    if (rejectedCommands.length === 0) {
      console.log('Successfully requested all default messages from vehicle.')
      return
    }
    console.error('Failed to request one or more default messages from the vehicle.')
    rejectedCommands.forEach((result) => console.error((result as PromiseRejectedResult).reason))
  }

  /**
   * Send number of mission items that will be uploaded next
   * @param { number } itemsCount Number of mission items that will be sent
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  sendMissionCount(itemsCount: number, missionType: MavMissionType): void {
    const message: Message.MissionCount = {
      type: MAVLinkType.MISSION_COUNT,
      target_system: this.currentSystemId,
      target_component: 1,
      count: itemsCount,
      mission_type: { type: missionType },
    }

    sendMavlinkMessage(message)
  }

  /**
   * Request the list of mission items from the vehicle
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  requestMissionItemsList(missionType: MavMissionType): void {
    const message: Message.MissionRequestList = {
      type: MAVLinkType.MISSION_REQUEST_LIST,
      target_system: this.currentSystemId,
      target_component: 1,
      mission_type: { type: missionType },
    }

    sendMavlinkMessage(message)
  }

  /**
   * Request a mission item from the vehicle
   * @param { number } seq Number of the mission item to be requested
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  requestMissionItem(seq: number, missionType: MavMissionType): void {
    const message: Message.MissionRequestInt = {
      type: MAVLinkType.MISSION_REQUEST_INT,
      target_system: this.currentSystemId,
      target_component: 0,
      seq: seq,
      mission_type: { type: missionType },
    }

    sendMavlinkMessage(message)
  }

  /**
   * Send acknowledgment about mission items to the vehicle
   * @param { boolean } success Wheter the transferring of mission items was successful or not
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  sendMissionAck(success: boolean, missionType: MavMissionType): void {
    const message: Message.MissionAck = {
      type: MAVLinkType.MISSION_ACK,
      target_system: this.currentSystemId,
      target_component: 0,
      mavtype: { type: success ? MavMissionResult.MAV_MISSION_ACCEPTED : MavMissionResult.MAV_MISSION_DENIED },
      mission_type: { type: missionType },
    }

    sendMavlinkMessage(message)
  }

  /**
   * Send mission item
   * @param { number } waypointSeq
   * @param { MavFrame } frame
   * @param { MavCmd } command
   * @param { boolean } current
   * @param { boolean } autocontinue
   * @param { number } param1
   * @param { number } param2
   * @param { number } param3
   * @param { number } param4
   * @param { number } param5
   * @param { number } param6
   * @param { number } param7
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  sendMissionItem(
    waypointSeq: number,
    frame: MavFrame,
    command: MavCmd,
    current: boolean,
    autocontinue: boolean,
    param1: number,
    param2: number,
    param3: number,
    param4: number,
    param5: number,
    param6: number,
    param7: number,
    missionType: MavMissionType
  ): void {
    const message: Message.MissionItem = {
      type: MAVLinkType.MISSION_ITEM,
      target_system: this.currentSystemId,
      target_component: 1,
      seq: waypointSeq,
      frame: { type: frame },
      command: { type: command },
      current: current ? 1 : 0,
      autocontinue: autocontinue ? 1 : 0,
      param1: param1,
      param2: param2,
      param3: param3,
      param4: param4,
      x: param5,
      y: param6,
      z: param7,
      mission_type: { type: missionType },
    }

    sendMavlinkMessage(message)
  }

  /**
   * Fetch mission items from the vehicle
   * @param { MissionLoadingCallback } loadingCallback Callback that returns the state of the loading progress
   * @param { number } timeoutBetweenItems Timeout between mission items in milliseconds
   * @returns { Promise<Waypoint[]> } Mission items that were on the vehicle
   */
  async fetchMission(
    loadingCallback: MissionLoadingCallback = defaultLoadingCallback,
    timeoutBetweenItems = 10000
  ): Promise<Waypoint[]> {
    // Only deal with regular mission items for now
    const missionType = MavMissionType.MAV_MISSION_TYPE_MISSION

    // Get number of mission items to be downloaded
    const initTimeCount = new Date().getTime()
    let timeoutEpoch = new Date().getTime()

    // First of all, request the number of mission items to be downloaded
    console.debug('[Mission download] Requesting number of mission items to be downloaded...')
    let itemsCount: number | undefined = undefined
    this.requestMissionItemsList(missionType)
    while (itemsCount === undefined) {
      await sleep(250)
      const timeSinceLastTimeout = new Date().getTime() - timeoutEpoch
      if (timeSinceLastTimeout > timeoutBetweenItems) {
        const msg = `[Mission download] Timeout reached while fetching mission count.`
        console.error(msg)
        throw Error(msg)
      }

      const lastMissionCountMessage = this._messages.get(MAVLinkType.MISSION_COUNT)
      if (lastMissionCountMessage !== undefined && lastMissionCountMessage.epoch > initTimeCount) {
        itemsCount = lastMissionCountMessage.count
        console.debug(`[Mission download] Mission count received! ${itemsCount} items to be downloaded.`)

        // Reset the timeout epoch when the items count is received
        timeoutEpoch = new Date().getTime()

        break
      }

      console.debug(`[Mission download] Mission count not received yet. Waiting for it...`)
    }

    // If the items count is not received, throw an error
    if (itemsCount === undefined) {
      const msg = '[Mission download] Did not receive number of mission items from vehicle.'
      console.error(msg)
      throw Error(msg)
    }

    if (itemsCount === 0) {
      console.debug('[Mission download] No mission items to download.')
    }

    // Download all mission items from the vehicle
    console.debug(`[Mission download] Downloading ${itemsCount} mission items from vehicle...`)
    const missionItems: Message.MissionItemInt[] = []
    let allItemsDownloaded = itemsCount === 0
    let itemToDownload = 0
    let lastItemRequested = -1
    let epochLastItemRequested = -1
    const initTimeDownload = new Date().getTime()
    timeoutEpoch = new Date().getTime()
    while (!allItemsDownloaded) {
      await sleep(1)
      const timeSinceLastTimeout = new Date().getTime() - timeoutEpoch
      if (timeSinceLastTimeout > timeoutBetweenItems) {
        const msg = `[Mission download] Timeout reached while downloading mission items.`
        console.error(msg)
        throw Error(msg)
      }

      loadingCallback((100 * (itemToDownload + 1)) / itemsCount)

      // If the last item requested is the same as the current one, and the last request was made less than 250ms ago, wait for the item to be received
      if (lastItemRequested === itemToDownload && new Date().getTime() - epochLastItemRequested < 250) {
        continue
      } else if (lastItemRequested === itemToDownload) {
        console.debug(`[Mission download] Did not receive #${itemToDownload} in time. Requesting again...`)
      }

      // Request the next mission item (starting at 0)
      console.debug(`[Mission download] Requesting mission item #${itemToDownload}...`)
      this.requestMissionItem(itemToDownload, missionType)
      lastItemRequested = itemToDownload
      epochLastItemRequested = new Date().getTime()

      // Check if the last mission item received belongs to this fetch or is from an old fetch
      const lastMissionItemMessage = this._messages.get(MAVLinkType.MISSION_ITEM_INT)
      if (lastMissionItemMessage === undefined || lastMissionItemMessage.epoch < initTimeDownload) continue
      if (lastMissionItemMessage.seq === itemToDownload) {
        console.debug(`[Mission download] Mission item #${itemToDownload} received!`)
        const { ['epoch']: _, ...lastMissionItem } = lastMissionItemMessage // eslint-disable-line @typescript-eslint/no-unused-vars
        missionItems.push(lastMissionItem as Message.MissionItemInt)

        // Reset the timeout epoch when the last mission item is received
        timeoutEpoch = new Date().getTime()

        // Only request the next mission item if the previous one was already received
        itemToDownload += 1
        if (itemToDownload === itemsCount) {
          allItemsDownloaded = true
          console.debug('[Mission download] Successfully dowloaded all mission items.')
          loadingCallback(100)
          break
        }
      }
    }

    console.debug('[Mission download] Sending mission acknowledgment to vehicle...')
    this.sendMissionAck(allItemsDownloaded, missionType)
    this._currentMavlinkMissionItemsOnVehicle = missionItems
    return convertMavlinkWaypointsToCockpit(missionItems)
  }

  /**
   * Set home waypoint on the vehicle
   * @param { [number, number] } coordinates Coordinates of the home waypoint
   * @param { number } altitude Altitude of the home waypoint
   */
  async setHomeWaypoint(coordinates: [number, number], altitude: number): Promise<void> {
    await this.sendCommandLong(MavCmd.MAV_CMD_DO_SET_HOME, 0, 0, 0, 0, coordinates[0], coordinates[1], altitude)
  }

  /**
   * Set global origin on vehicle (sets the GNSS coordinates of the local origin)
   * @param { [number, number] } coordinates Coordinates of the origin (latitude, longitude)
   * @param { number } altitude Altitude of the origin (MSL)
   */
  setGlobalOrigin(coordinates: [number, number], altitude: number): void {
    sendMavlinkMessage({
      type: MAVLinkType.SET_GPS_GLOBAL_ORIGIN,
      latitude: coordinates[0],
      longitude: coordinates[1],
      altitude: altitude,
    })
  }

  /**
   * Fetch the home waypoint from the vehicle
   * and converts the message into a Waypoint.
   * @returns {Promise<Waypoint>} The home waypoint.
   */
  async fetchHomeWaypoint(): Promise<Waypoint> {
    await this.sendCommandLong(MavCmd.MAV_CMD_REQUEST_MESSAGE, getMAVLinkMessageId(MAVLinkType.HOME_POSITION))
    const startTime = new Date().getTime()
    let homePosition: Message.HomePosition | undefined = undefined
    while (!homePosition && new Date().getTime() - startTime < 5000) {
      await sleep(100)
      homePosition = this._messages.get(MAVLinkType.HOME_POSITION) as Message.HomePosition
    }
    if (!homePosition) {
      throw new Error('Home position not received from vehicle.')
    }
    const homeMissionItem: Message.MissionItemInt = {
      type: MAVLinkType.MISSION_ITEM_INT,
      target_system: this.currentSystemId,
      target_component: 1,
      seq: 0,
      frame: { type: MavFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT },
      command: { type: MavCmd.MAV_CMD_GET_HOME_POSITION },
      current: 1,
      autocontinue: 1,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      x: homePosition.latitude,
      y: homePosition.longitude,
      z: homePosition.altitude,
      mission_type: { type: MavMissionType.MAV_MISSION_TYPE_MISSION },
    }

    const waypoints = convertMavlinkWaypointsToCockpit([homeMissionItem])
    return waypoints[0]
  }

  /**
   * Clear mission that is on the vehicle
   */
  async clearMissions(): Promise<void> {
    const message: Message.MissionClearAll = {
      type: MAVLinkType.MISSION_CLEAR_ALL,
      target_system: this.currentSystemId,
      target_component: 1,
      mission_type: { type: MavMissionType.MAV_MISSION_TYPE_MISSION },
    }
    sendMavlinkMessage(message)
  }

  /**
   * Start mission that is on the vehicle
   */
  async startMission(): Promise<void> {
    // Start by reseting the current mode to LOITER (or ALT_HOLD for submarines)
    // This is necessary as the vehicle can be in a mission and will not answer until getting off of the AUTO mode
    let resetModeName = 'LOITER'
    if ([Vehicle.Type.Sub].includes(this._type)) {
      resetModeName = 'ALT_HOLD'
    }
    const resetMode = this.modesAvailable().get(resetModeName)
    if (resetMode === undefined) {
      throw Error(
        `${resetModeName} mode is not available.
        Please put the vehicle in ${resetModeName} mode manually so a new mission can be started.`
      )
    }
    await this.setMode(resetMode as Modes)

    // Check if the vehicle got off of the AUTO mode
    const initialTimeResetModeCheck = new Date().getTime()
    while (this.mode() !== resetMode && new Date().getTime() - initialTimeResetModeCheck < 10000) {
      await this.setMode(resetMode as Modes)
      await sleep(100)
    }
    if (this.mode() !== resetMode) {
      throw Error(`Could not put vehicle in ${resetModeName} mode. Please do it manually.`)
    }

    // Arming the vehicle is necessary to successfully start a mission
    const initialTimeArmCheck = new Date().getTime()
    while (!this.isArmed() && new Date().getTime() - initialTimeArmCheck < 5000) {
      await this.arm()
      await sleep(100)
    }
    if (!this.isArmed) {
      throw Error('Could not arm the vehicle. Please arm it manually.')
    }

    await this.sendCommandLong(MavCmd.MAV_CMD_MISSION_START, 0, 0)
  }

  /**
   * Upload mission items to vehicle
   * @param { Waypoint[] } items Mission items that will be sent
   * @param { MissionLoadingCallback } loadingCallback Callback that returns the state of the loading progress
   * @param { number } timeoutBetweenItems Timeout between mission items in milliseconds
   */
  async uploadMission(
    items: Waypoint[],
    loadingCallback: MissionLoadingCallback = defaultLoadingCallback,
    timeoutBetweenItems = 3000
  ): Promise<void> {
    // Convert from Cockpit waypoints to MAVLink waypoints
    const mavlinkWaypoints = convertCockpitWaypointsToMavlink(items, this.currentSystemId)

    console.debug(`[Mission upload] Cockpit waypoints: ${JSON.stringify(items, null, 2)}`)
    console.debug(`[Mission upload] MAVLink waypoints: ${JSON.stringify(mavlinkWaypoints, null, 2)}`)

    // Only deal with regular mission items for now
    const missionType = MavMissionType.MAV_MISSION_TYPE_MISSION

    // Say to the vehicle how many mission items we are going to send
    this.sendMissionCount(mavlinkWaypoints.length, missionType)
    console.debug(`[Mission upload] Sending ${mavlinkWaypoints.length} mission items.`)

    // Send the mission items one by one, only sending the next when explicitly requested by the vehicle
    let missionAck: MavMissionResult | undefined = undefined
    const initTimeUpload = new Date().getTime()
    let timeoutEpoch = new Date().getTime()
    let epochLastRequestAnswered = -1
    while (missionAck === undefined) {
      await sleep(1)

      // Check if the upload timeout has been reached
      const timeSinceLastTimeout = new Date().getTime() - timeoutEpoch
      console.debug(`[Mission upload] --------------------------------`)
      console.debug(`[Mission upload] Time since last timeout: ${timeSinceLastTimeout / 1000}s`)
      if (timeSinceLastTimeout > timeoutBetweenItems) {
        console.error('[Mission upload] Timeout reached while uploading mission.')
        throw Error(`Timeout reached while uploading mission.`)
      }

      // Check if the vehicle has requested a mission item
      const lastMissionItemRequestMessage =
        this._messages.get(MAVLinkType.MISSION_REQUEST) || this._messages.get(MAVLinkType.MISSION_REQUEST_INT)
      if (lastMissionItemRequestMessage === undefined) {
        console.debug(`[Mission upload] No mission item request message received.`)
        continue
      } else {
        console.debug(`[Mission upload] Received a request for mission item #${lastMissionItemRequestMessage.seq}.`)
      }

      // Check if the request is from another upload
      const requestFromOtherUpload = lastMissionItemRequestMessage.epoch < initTimeUpload
      if (requestFromOtherUpload) {
        console.debug(`[Mission upload] Request was from another upload. Skipping...`)
        continue
      }

      const requestAlreadyAnswered = epochLastRequestAnswered === lastMissionItemRequestMessage.epoch
      if (requestAlreadyAnswered && new Date().getTime() - lastMissionItemRequestMessage.epoch < 250) {
        console.debug(`[Mission upload] Request was already answered. Skipping...`)
        continue
      } else if (requestAlreadyAnswered) {
        console.debug(`[Mission upload] Didn't receive the mission item in time. Will send it again.`)
      } else {
        timeoutEpoch = new Date().getTime()
      }

      // If none of the above conditions are met, send the mission item
      console.debug(`[Mission upload] Sending mission item #${lastMissionItemRequestMessage.seq}`)
      sendMavlinkMessage(mavlinkWaypoints[lastMissionItemRequestMessage.seq])

      const percentageCompleted = Math.round((100 * (lastMissionItemRequestMessage.seq + 1)) / mavlinkWaypoints.length)
      console.debug(`[Mission upload] Progress: ${percentageCompleted}%.`)
      loadingCallback(percentageCompleted)

      // Update the epoch of the last request answered so we can check if the request was already answered
      epochLastRequestAnswered = lastMissionItemRequestMessage.epoch

      // Stop when the vehicle send a acknowledgement stating that all waypoints were successfully received or that the upload failed
      const lastMissionAckMessage = this._messages.get(MAVLinkType.MISSION_ACK)
      const ackReceived = lastMissionAckMessage !== undefined && lastMissionAckMessage.epoch > initTimeUpload
      if (ackReceived) {
        console.debug(`[Mission upload] Acknowledgment received: ${lastMissionAckMessage.mavtype.type}`)
        const missionUploadSucceeded = lastMissionAckMessage.mavtype.type === MavMissionResult.MAV_MISSION_ACCEPTED
        if (missionUploadSucceeded) {
          console.debug(`[Mission upload] Mission upload succeeded.`)
          missionAck = lastMissionAckMessage.mavtype.type
        } else {
          console.warn(`[Mission upload] Mission upload failed. Will continue trying until a timeout is reached.`)
          continue
        }
      }
    }

    if (missionAck === undefined) {
      console.error('[Mission upload] Mission acknowledgment is undefined. Upload failed.')
      throw Error('Did not receive acknowledgment of mission upload.')
    } else if (missionAck !== MavMissionResult.MAV_MISSION_ACCEPTED) {
      console.error('[Mission upload] Mission acknowledgment is not MAV_MISSION_ACCEPTED. Upload failed.')
      throw Error(`Failed uploading mission. Result received: ${missionAck}.`)
    }

    loadingCallback(100)
    console.debug('[Mission upload] Successfully sent all mission items.')
  }

  /**
   * Pre-defined data-lake variables related to the vehicle
   * @returns {Record<string, DataLakeVariable>} The variables
   */
  private get preDefinedDataLakeVariables(): Record<string, DataLakeVariable> {
    const vehiclePath = `/mavlink/${this.currentSystemId}/1`
    const vehicleName = `MAVLink / System: ${this.currentSystemId} / Component: 1`
    /* eslint-disable vue/max-len, prettier/prettier, max-len */
    return {
      cameraTiltLegacy: { id: 'cameraTiltDeg', name: '(Legacy) Camera Tilt Degrees', type: 'number' },
      autopilotSystemId: { id: 'autopilotSystemId', name: 'Autopilot System ID', type: 'number' },
      cameraTilt: { id: `${vehiclePath}/cameraTiltDeg`, name: `Camera Tilt [degrees] (${vehicleName})`, type: 'number' },
      networkLatencyMs: { id: `${vehiclePath}/networkLatencyMs`, name: `Network Latency [ms] (${vehicleName})`, type: 'number' },
    }
    /* eslint-enable vue/max-len, prettier/prettier, max-len */
  }

  /**
   * Create data-lake variables for the vehicle
   */
  createPredefinedDataLakeVariables(): void {
    // Register BlueOS variables in the data lake
    Object.values(this.preDefinedDataLakeVariables).forEach((variable) => {
      if (!Object.values(getAllDataLakeVariablesInfo()).find((v) => v.id === variable.id)) {
        // @ts-ignore: The type is right, only being incorrectly inferred by TS
        createDataLakeVariable({ ...variable, persistent: false, persistValue: false })
      }
    })

    // read-only clone of autopilotSystemId using old name, for legacy support
    try {
      const existsAlready = getAllTransformingFunctions().find((f) => f.id === 'ardupilotSystemId')
      if (!existsAlready) {
        createTransformingFunction(
          'ardupilotSystemId',
          '(Legacy) ArduPilot System ID',
          'number',
          '{{autopilotSystemId}}',
          "A read-only clone of the autopilot's system ID, for legacy support of the old variable name. New applications should use autopilotSystemId instead."
        )
      }
    } catch (error) {
      console.error('Error creating ArduPilot system ID fallback:', error)
    }
  }

  /**
   * Inject variable(s) from the MAVLink package into the DataLake
   * @param { Package } mavlinkPackage
   */
  private addPackageVariablesToDataLake(mavlinkPackage: Package): void {
    const messageType = mavlinkPackage.message.type
    const { system_id: messageSystemId, component_id: messageComponentId } = mavlinkPackage.header
    const prefix = `/mavlink/${messageSystemId}/${messageComponentId}`
    const suffix = `(MAVLink / System: ${messageSystemId} / Component: ${messageComponentId})`

    // Inject variables from the MAVLink messages into the DataLake
    if (['NAMED_VALUE_FLOAT', 'NAMED_VALUE_INT'].includes(messageType)) {
      // Special handling for NAMED_VALUE_FLOAT/NAMED_VALUE_INT messages
      const name = `${(mavlinkPackage.message.name as string[]).join('').replace(/\0/g, '')}`
      const path = `${prefix}/${messageType}/${name}`
      if (getDataLakeVariableInfo(path) === undefined) {
        createDataLakeVariable({ id: path, name: `${name} ${suffix}`, type: 'number' })
      }
      setDataLakeVariableData(path, mavlinkPackage.message.value)

      if (messageSystemId === this.currentSystemId && messageComponentId === 1) {
        // Create duplicated variables for legacy purposes (that was how they were stored in the old generic-variables system)
        const oldVariablePath = mavlinkPackage.message.name.join('').replaceAll('\x00', '')
        if (getDataLakeVariableInfo(oldVariablePath) === undefined) {
          createDataLakeVariable({ id: oldVariablePath, name: `(Legacy) ${oldVariablePath}`, type: 'number' })
        }
        setDataLakeVariableData(oldVariablePath, mavlinkPackage.message.value)
      }
    } else {
      // For all other messages, use the flattener
      const flattened = flattenData(mavlinkPackage.message)
      flattened.forEach(({ path, value }) => {
        if (value === null) return
        if (typeof value !== 'string' && typeof value !== 'number') return

        if (messageSystemId === this.currentSystemId && messageComponentId === 1) {
          // Create the variable in the old style path for legacy purposes (that was how they were stored in the old generic-variables system)
          const oldStylePath = `${path}`
          if (getDataLakeVariableInfo(oldStylePath) === undefined) {
            createDataLakeVariable({
              id: oldStylePath,
              name: `(Legacy) ${path}`,
              type: typeof value === 'string' ? 'string' : 'number',
            })
          }
          setDataLakeVariableData(oldStylePath, value)
        }

        // Create the variable in the new style path
        const newStylePath = `${prefix}/${path}`
        if (getDataLakeVariableInfo(newStylePath) === undefined) {
          createDataLakeVariable({
            id: newStylePath,
            name: `${path} ${suffix}`,
            type: typeof value === 'string' ? 'string' : 'number',
          })
        }
        setDataLakeVariableData(newStylePath, value)
      })
    }
  }
}
