import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavModeFlag } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import * as ardusub_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Sub-4.5/apm.pdef.json'

import * as Vehicle from '../vehicle'
import { ArduPilotVehicle } from './ardupilot'

/**
 * Custom modes for Sub
 */
export enum CustomMode {
  // Mode not set by vehicle yet
  PRE_FLIGHT = -1,
  // Manual angle with manual depth/throttle
  STABILIZE = 0,
  // Manual body-frame angular rate with manual depth/throttle
  ACRO = 1,
  // Manual angle with automatic depth/throttle
  ALT_HOLD = 2,
  // Fully automatic waypoint control using mission commands
  AUTO = 3,
  // Fully automatic fly to coordinate or fly at velocity/direction using GCS immediate commands
  GUIDED = 4,
  // Automatic circular flight with automatic throttle
  CIRCLE = 7,
  // Automatically return to surface, pilot maintains horizontal control
  SURFACE = 9,
  // Automatic position hold with manual override, with automatic throttle
  POSHOLD = 16,
  // Pass-through input with no stabilization
  MANUAL = 19,
  // Automatically detect motors orientation
  MOTOR_DETECT = 20,
  // Manual angle with automatic depth/throttle (from rangefinder altitude)
  SURFTRAK = 21,
}

/**
 * ArduSub vehicle
 */
export class ArduSub extends ArduPilotVehicle<CustomMode> {
  _mode: CustomMode = CustomMode.PRE_FLIGHT
  _metadata = ardusub_metadata

  /**
   * Create ArduSub vehicle
   * @param {number} system_id
   */
  constructor(system_id: number) {
    super(Vehicle.Type.Sub, system_id)
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
   * Deal with MAVLink messages necessary for vehicles of type sub
   * @param {Package} mavlink
   */
  onMAVLinkPackage(mavlink: Package): void {
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
