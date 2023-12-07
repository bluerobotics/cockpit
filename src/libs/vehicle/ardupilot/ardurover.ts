import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavModeFlag } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import * as ardurover_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Rover-4.2/apm.pdef.json'

import * as Vehicle from '../vehicle'
import { ArduPilotVehicle } from './ardupilot'

/**
 * Custom modes for Rover
 * There is no documentation from their source code
 */
export enum CustomMode {
  // Mode not set by vehicle yet
  PRE_FLIGHT = -1,
  MANUAL = 0,
  ACRO = 1,
  STEERING = 3,
  HOLD = 4,
  LOITER = 5,
  FOLLOW = 6,
  SIMPLE = 7,
  DOCK = 8,
  AUTO = 10,
  RTL = 11,
  SMART_RTL = 12,
  GUIDED = 15,
  INITIALISING = 16,
}

/**
 * ArduRover vehicle
 */
export class ArduRover extends ArduPilotVehicle<CustomMode> {
  _mode: CustomMode = CustomMode.PRE_FLIGHT
  _metadata = ardurover_metadata

  /**
   * Create ArduRover vehicle
   */
  constructor() {
    super(Vehicle.Type.Rover)
  }

  /**
   * Get vehicle flight mode
   * @returns {CustomMode}
   */
  mode(): CustomMode {
    return this._mode
  }

  /**
   * Get a list of available modes
   * @returns {Map<string, CustomMode>}
   */
  modesAvailable(): Map<string, CustomMode> {
    const modeMap = new Map()
    Object.entries(CustomMode)
      .filter(([key]) => isNaN(Number(key)))
      .forEach(([key, value]) => {
        modeMap.set(key, value)
      })
    return modeMap
  }

  /**
   * Deal with MAVLink messages necessary for vehicles of type rover
   * @param {Package} mavlink
   */
  onMAVLinkPackage(mavlink: Package): void {
    const { system_id, component_id } = mavlink.header
    if (system_id != 1 || component_id !== 1) {
      return
    }

    switch (mavlink.message.type) {
      case MAVLinkType.HEARTBEAT: {
        const heartbeat = mavlink.message as Message.Heartbeat

        // The special case where base_mode was not set by the vehicle
        if ((heartbeat.base_mode.bits as number) === 0) {
          this._mode = CustomMode.PRE_FLIGHT
          this.onMode.emit()
          return
        }

        // We only deal with the custom modes since this is how ArduPilot works
        if (!(heartbeat.base_mode.bits & MavModeFlag.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED)) {
          console.log(`no custom: ${JSON.stringify(heartbeat.base_mode)}`)
          return
        }

        this._mode = heartbeat.custom_mode as CustomMode
        this.onMode.emit()
      }
    }
  }
}
