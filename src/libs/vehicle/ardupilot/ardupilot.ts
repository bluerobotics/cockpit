import { ConnectionManager } from '@/libs/connection/connection-manager'
import type {
  MAVLinkMessageDictionary,
  Message as MavMessage,
  Package,
  Type,
} from '@/libs/connection/m2r/messages/mavlink2rest'
import {
  GpsFixType,
  MavAutopilot,
  MavCmd,
  MavComponent,
  MAVLinkType,
  MavMissionResult,
  MavMissionType,
  MavModeFlag,
  MavParamType,
  MavState,
  MavType,
} from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { MavFrame } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { MavlinkControllerState } from '@/libs/joystick/protocols'
import { SignalTyped } from '@/libs/signal'
import { round } from '@/libs/utils'
import {
  type ArduPilotParameterSetData,
  alertLevelFromMavSeverity,
  convertCockpitWaypointsToMavlink,
  convertMavlinkWaypointsToCockpit,
} from '@/libs/vehicle/ardupilot/types'
import {
  type PageDescription,
  Altitude,
  Attitude,
  Battery,
  Coordinates,
  FixTypeGPS,
  Parameter,
  PowerSupply,
  StatusGPS,
  StatusText,
  Velocity,
} from '@/libs/vehicle/types'
import { ProtocolControllerState } from '@/types/joystick'
import { type MissionLoadingCallback, type Waypoint, defaultLoadingCallback } from '@/types/mission'

import * as Vehicle from '../vehicle'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArduPilot = ArduPilotVehicle<any>

/**
 * Generic ArduPilot vehicle
 */
export abstract class ArduPilotVehicle<Modes> extends Vehicle.AbstractVehicle<Modes> {
  _altitude = new Altitude({ msl: 0 })
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
  _currentCockpitMissionItemsOnPlanning: Waypoint[] = []
  _currentMavlinkMissionItemsOnVehicle: Message.MissionItemInt[] = []
  _statusText = new StatusText()
  _statusGPS = new StatusGPS()
  _vehicleSpecificErrors = [0, 0, 0, 0]

  _messages: MAVLinkMessageDictionary = new Map()

  onMAVLinkMessage = new SignalTyped()

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
   * Construct a new generic ArduPilot type
   * @param {Vehicle.Type} type
   */
  constructor(type: Vehicle.Type) {
    super(Vehicle.Firmware.ArduPilot, type)
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
    this._messages.set(mavlink_message.message.type, { ...mavlink_message.message, epoch: new Date().getTime() })

    const mavlinkIdentificationKeys = [
      'cam_idx',
      'camera_id',
      'compass_id',
      'gcs_system_id',
      'gimbal_device_id',
      'gps_id',
      'hw_unique_id',
      'id',
      'idx',
      'rtk_receiver_id',
      'sensor_id',
      'storage_id',
      'stream_id',
      'uas_id',
    ]

    /**
     * Allows handling messages that are shared by multiple devices, splitting them out by detected device IDs.
     * @param { Record<string, unknown> } obj The object to be searched for
     * @param { Record<string, unknown> } acc The destination object for the variables found
     * @param { string } baseKey A string to be added in front of the actual object keys. Used for deep nested key-value pairs
     */
    const getDeepVariables = (obj: Record<string, unknown>, acc: Record<string, unknown>, baseKey?: string): void => {
      Object.entries(obj).forEach(([k, v]) => {
        if (v instanceof Object) {
          let identifier: string | undefined = undefined
          Object.keys(v).forEach((subKey) => {
            if (mavlinkIdentificationKeys.includes(subKey)) {
              identifier = subKey
            }
          })
          if (identifier === undefined) {
            getDeepVariables(v as Record<string, unknown>, acc, k)
          } else {
            getDeepVariables(v as Record<string, unknown>, acc, `${k}.ID${v[identifier]}`)
          }
        } else {
          if (baseKey === undefined) {
            acc[k] = v
          } else {
            acc[`${baseKey}.${k}`] = v
          }
        }
      })
    }

    getDeepVariables(Object.fromEntries(this._messages), this._genericVariables)

    // TODO: Maybe create a signal class to deal with MAVLink only
    // Where add will use the template argument type to define the lambda argument type
    this.onMAVLinkMessage.emit_value(mavlink_message.message.type, mavlink_message)

    switch (mavlink_message.message.type) {
      case MAVLinkType.AHRS2: {
        const ahrsMessage = mavlink_message.message as Message.Ahrs2
        this._altitude.msl = ahrsMessage.altitude
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
        this._velocity.x = position.vx / 100 // Convert cm/s to m/s
        this._velocity.y = position.vy / 100 // Convert cm/s to m/s
        this._velocity.z = position.vz / 100 // Convert cm/s to m/s
        this._velocity.ground = Math.sqrt(this._velocity.x ** 2 + this._velocity.y ** 2)
        this._velocity.overall = Math.sqrt(this._velocity.x ** 2 + this._velocity.y ** 2 + this._velocity.z ** 2)
        this.onVelocity.emit()
        break
      }
      case MAVLinkType.GPS_RAW_INT: {
        const gpsMessage = mavlink_message.message as Message.GpsRawInt
        this._statusGPS.visibleSatellites = gpsMessage.satellites_visible
        this._statusGPS.HDOP = round(gpsMessage.eph / 100)
        this._statusGPS.VDOP = round(gpsMessage.epv / 100)
        const arduPilotGPSFixTable = {
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
        this._statusGPS.fixType = arduPilotGPSFixTable[(gpsMessage.fix_type as unknown as Type<GpsFixType>).type]
        this.onStatusGPS.emit()
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
        const { param_value } = receivedMessage
        // We need this due to mismatches between js 64-bit floats and REAL32 in MAVLink
        const trimmed_value = Math.round(param_value * 10000) / 10000

        this._lastParameter = { name: param_name, value: trimmed_value }
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

      case MAVLinkType.NAMED_VALUE_FLOAT: {
        const namedValueFloatMessage = mavlink_message.message as Message.NamedValueFloat
        const messageName = namedValueFloatMessage.name.join('').replaceAll('\x00', '')
        this._genericVariables[messageName] = namedValueFloatMessage.value
        this.onGenericVariables.emit()
        break
      }

      case MAVLinkType.NAMED_VALUE_INT: {
        const namedValueIntMessage = mavlink_message.message as Message.NamedValueInt
        const messageName = namedValueIntMessage.name.join('').replaceAll('\x00', '')
        this._genericVariables[messageName] = namedValueIntMessage.value
        this.onGenericVariables.emit()
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
  _arm(arm: boolean, force?: boolean): void {
    this.sendCommandLong(
      MavCmd.MAV_CMD_COMPONENT_ARM_DISARM,
      arm ? 1 : 0, // 0: Disarm, 1: ARM
      force ? 21196 : 0 // 21196: force arming/disarming (e.g. override preflight checks and disarming in flight)
    )
  }

  /**
   * Arm vehicle
   * @returns {boolean}
   */
  arm(): boolean {
    this._arm(true)
    return true
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
   * @returns {boolean}
   */
  disarm(): boolean {
    this._arm(false)
    return true
  }

  /**
   * Check if vehicle is armed
   * @returns {boolean}
   */
  isArmed(): boolean {
    return this._isArmed
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
   * Send manual control
   * @param {'ProtocolControllerState'} controllerState Current state of the controller
   */
  sendManualControl(controllerState: ProtocolControllerState): void {
    const state = controllerState as MavlinkControllerState
    const manualControlMessage: Message.ManualControl = {
      type: MAVLinkType.MANUAL_CONTROL,
      x: state.x,
      y: state.y,
      z: state.z,
      r: state.r,
      buttons: state.buttons,
      target: 1,
    }
    this.write(manualControlMessage)
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
      base_mode: { bits: 192 },
      system_status: { type: MavState.MAV_STATE_ACTIVE },
      mavlink_version: 1,
    }

    this.write(heartbeatMessage)
  }

  /**
   * Set vehicle flight mode
   * @param {'Modes'} mode Custom vehicle mode
   */
  setMode(mode: Modes): void {
    this.sendCommandLong(
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
      target_system: 0,
      target_component: 0,
    }
    this.write(paramRequestMessage)
  }

  /**
   * Request parameters list from vehicle
   * @param { ArduPilotParameterSetData } settings Data used to set a parameter
   */
  setParameter(settings: ArduPilotParameterSetData): void {
    const param_name = [...settings.id]
    while (param_name.length < 16) {
      param_name.push('\0')
    }
    const paramSetMessage: Message.ParamSet = {
      type: MAVLinkType.PARAM_SET,
      target_system: 0,
      target_component: 0,
      // @ts-ignore: The correct type is indeed a char array
      param_id: param_name,
      param_value: settings.value,
      // @ts-ignore: The correct type is indeed a Type<MavParamType>
      param_type: settings.type ?? { type: MavParamType.MAV_PARAM_TYPE_UINT8 },
    }
    this.write(paramSetMessage)
  }

  /**
   * Send number of mission items that will be uploaded next
   * @param { number } itemsCount Number of mission items that will be sent
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  sendMissionCount(itemsCount: number, missionType: MavMissionType): void {
    const message: Message.MissionCount = {
      type: MAVLinkType.MISSION_COUNT,
      target_system: 1,
      target_component: 1,
      count: itemsCount,
      mission_type: { type: missionType },
    }

    this.write(message)
  }

  /**
   * Request the list of mission items from the vehicle
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  requestMissionItemsList(missionType: MavMissionType): void {
    const message: Message.MissionRequestList = {
      type: MAVLinkType.MISSION_REQUEST_LIST,
      target_system: 1,
      target_component: 1,
      mission_type: { type: missionType },
    }

    this.write(message)
  }

  /**
   * Request a mission item from the vehicle
   * @param { number } seq Number of the mission item to be requested
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  requestMissionItem(seq: number, missionType: MavMissionType): void {
    const message: Message.MissionRequestInt = {
      type: MAVLinkType.MISSION_REQUEST_INT,
      target_system: 0,
      target_component: 0,
      seq: seq,
      mission_type: { type: missionType },
    }

    this.write(message)
  }

  /**
   * Send acknowledgment about mission items to the vehicle
   * @param { boolean } success Wheter the transferring of mission items was successful or not
   * @param { MavMissionType } missionType Type of mission to be executed
   */
  sendMissionAck(success: boolean, missionType: MavMissionType): void {
    const message: Message.MissionAck = {
      type: MAVLinkType.MISSION_ACK,
      target_system: 0,
      target_component: 0,
      mavtype: { type: success ? MavMissionResult.MAV_MISSION_ACCEPTED : MavMissionResult.MAV_MISSION_DENIED },
      mission_type: { type: missionType },
    }

    this.write(message)
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
      target_system: 1,
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

    this.write(message)
  }

  /**
   * Fetch mission items from the vehicle
   * @param { MissionLoadingCallback } loadingCallback Callback that returns the state of the loading progress
   * @returns { Promise<Waypoint[]> } Mission items that were on the vehicle
   */
  async fetchMission(loadingCallback: MissionLoadingCallback = defaultLoadingCallback): Promise<Waypoint[]> {
    // Only deal with regular mission items for now
    const missionType = MavMissionType.MAV_MISSION_TYPE_MISSION

    // Get number of mission items to be downloaded
    const initTimeCount = new Date().getTime()
    let timeoutReachedCount = false
    let itemsCount: number | undefined = undefined
    this.requestMissionItemsList(missionType)
    while (itemsCount === undefined && !timeoutReachedCount) {
      const lastMissionCountMessage = this._messages.get(MAVLinkType.MISSION_COUNT)
      if (lastMissionCountMessage !== undefined && lastMissionCountMessage.epoch > initTimeCount) {
        itemsCount = lastMissionCountMessage.count
        break
      }
      await new Promise((r) => setTimeout(r, 100))
      timeoutReachedCount = new Date().getTime() - initTimeCount > 10000
    }
    if (itemsCount === undefined) {
      throw Error('Did not receive number of mission items from vehicle.')
    }

    // Download all mission items from the vehicle
    const missionItems: Message.MissionItemInt[] = []
    let allItemsDownloaded = false
    let itemToDownload = 0
    const initTimeDown = new Date().getTime()
    let timeoutReachedDownload = false
    while (!allItemsDownloaded && !timeoutReachedDownload) {
      await new Promise((r) => setTimeout(r, 100))
      timeoutReachedDownload = new Date().getTime() - initTimeDown > 10000
      loadingCallback((100 * itemToDownload) / itemsCount)

      // Request the next mission item (starting at 0)
      this.requestMissionItem(itemToDownload, missionType)

      // Check if the last mission item received belongs to this fetch or is from an old fetch
      const lastMissionItemMessage = this._messages.get(MAVLinkType.MISSION_ITEM_INT)
      if (lastMissionItemMessage === undefined || lastMissionItemMessage.epoch < initTimeDown) continue
      if (lastMissionItemMessage.seq === itemToDownload) {
        const { ['epoch']: _, ...lastMissionItem } = lastMissionItemMessage // eslint-disable-line @typescript-eslint/no-unused-vars
        missionItems.push(lastMissionItem as Message.MissionItemInt)
        // Only request the next mission item if the previous one was already received
        itemToDownload += 1
        if (itemToDownload === itemsCount) {
          allItemsDownloaded = true
          console.debug('Successfully dowloaded all mission items.')
          loadingCallback(100)
        }
      }
    }
    this.sendMissionAck(allItemsDownloaded, missionType)
    this._currentMavlinkMissionItemsOnVehicle = missionItems
    return convertMavlinkWaypointsToCockpit(missionItems)
  }

  /**
   * Clear mission that is on the vehicle
   */
  async clearMissions(): Promise<void> {
    this.uploadMission([])
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
    this.setMode(resetMode as Modes)

    // Check if the vehicle got off of the AUTO mode
    const initialTimeResetModeCheck = new Date().getTime()
    while (this.mode() !== resetMode && new Date().getTime() - initialTimeResetModeCheck < 10000) {
      this.setMode(resetMode as Modes)
      await new Promise((r) => setTimeout(r, 100))
    }
    if (this.mode() !== resetMode) {
      throw Error(`Could not put vehicle in ${resetModeName} mode. Please do it manually.`)
    }

    // Arming the vehicle is necessary to successfully start a mission
    const initialTimeArmCheck = new Date().getTime()
    while (!this.isArmed() && new Date().getTime() - initialTimeArmCheck < 5000) {
      this.arm()
      await new Promise((r) => setTimeout(r, 100))
    }
    if (!this.isArmed) {
      throw Error('Could not arm the vehicle. Please arm it manually.')
    }

    this.sendCommandLong(MavCmd.MAV_CMD_MISSION_START, 0, 0)
  }

  /**
   * Upload mission items to vehicle
   * @param { Waypoint[] } items Mission items that will be sent
   * @param { MissionLoadingCallback } loadingCallback Callback that returns the state of the loading progress
   */
  async uploadMission(
    items: Waypoint[],
    loadingCallback: MissionLoadingCallback = defaultLoadingCallback
  ): Promise<void> {
    // Convert from Cockpit waypoints to MAVLink waypoints
    this._currentCockpitMissionItemsOnPlanning = items
    const mavlinkWaypoints = convertCockpitWaypointsToMavlink(items)

    // Only deal with regular mission items for now
    const missionType = MavMissionType.MAV_MISSION_TYPE_MISSION

    // Say to the vehicle how many mission items we are going to send
    this.sendMissionCount(mavlinkWaypoints.length, missionType)

    // Send the mission items one by one, only sending the next when explicitly requested by the vehicle
    let missionAck: MavMissionResult | undefined = undefined
    const initTimeUpload = new Date().getTime()
    let timeoutReachedUpload = false
    let epochLastRequestAnswered = -1
    let lastSeqRequested = -1
    while (missionAck === undefined && !timeoutReachedUpload) {
      await new Promise((r) => setTimeout(r, 10))
      timeoutReachedUpload = new Date().getTime() - initTimeUpload > 10000
      const lastMissionItemRequestMessage =
        this._messages.get(MAVLinkType.MISSION_REQUEST) || this._messages.get(MAVLinkType.MISSION_REQUEST_INT)
      if (lastMissionItemRequestMessage === undefined) continue
      const requestFromOtherUpload = lastMissionItemRequestMessage.epoch < initTimeUpload
      const requestAlreadyAnswered = epochLastRequestAnswered === lastMissionItemRequestMessage.epoch
      const lastItemRequested = lastSeqRequested === mavlinkWaypoints.length - 1
      if ((requestFromOtherUpload || requestAlreadyAnswered) && !lastItemRequested) continue
      this.write(mavlinkWaypoints[lastMissionItemRequestMessage.seq])
      epochLastRequestAnswered = lastMissionItemRequestMessage.epoch
      lastSeqRequested = lastMissionItemRequestMessage.seq

      // Stop when the vehicle send a acknowledgement stating that all waypoints were successfully received or that the upload failed
      const lastMissionAckMessage = this._messages.get(MAVLinkType.MISSION_ACK)
      const ackReceived = lastMissionAckMessage !== undefined && lastMissionAckMessage.epoch > initTimeUpload
      if (ackReceived) {
        missionAck = lastMissionAckMessage.mavtype.type
      }
      loadingCallback((100 * lastMissionItemRequestMessage.seq) / mavlinkWaypoints.length)
    }

    if (missionAck === undefined) {
      throw Error('Did not receive acknowledgment of mission upload.')
    } else if (missionAck !== MavMissionResult.MAV_MISSION_ACCEPTED) {
      throw Error(`Failed uploading mission. Result received: ${missionAck}.`)
    }

    loadingCallback(100)
    console.debug('Successfully sent all mission items.')
  }
}
