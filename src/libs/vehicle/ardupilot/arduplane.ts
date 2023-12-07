import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavModeFlag } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import * as arduplane_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Plane-4.3/apm.pdef.json'

import * as Vehicle from '../vehicle'
import { ArduPilotVehicle } from './ardupilot'

/**
 * Custom modes for Plane
 * There is no documentation from their source code
 */
export enum CustomMode {
  // Mode not set by vehicle yet
  PRE_FLIGHT = -1,
  MANUAL = 0,
  CIRCLE = 1,
  STABILIZE = 2,
  TRAINING = 3,
  ACRO = 4,
  FLY_BY_WIRE_A = 5,
  FLY_BY_WIRE_B = 6,
  CRUISE = 7,
  AUTOTUNE = 8,
  AUTO = 10,
  RTL = 11,
  LOITER = 12,
  TAKEOFF = 13,
  AVOID_ADSB = 14,
  GUIDED = 15,
  INITIALISING = 16,
  QSTABILIZE = 17,
  QHOVER = 18,
  QLOITER = 19,
  QLAND = 20,
  QRTL = 21,
  QAUTOTUNE = 22,
  QACRO = 23,
  THERMAL = 24,
  LOITER_ALT_QLAND = 25,
}

/**
 * ArduPlane vehicle
 */
export class ArduPlane extends ArduPilotVehicle<CustomMode> {
  _mode: CustomMode = CustomMode.PRE_FLIGHT
  _metadata = arduplane_metadata

  /**
   * Create ArduPlane vehicle
   */
  constructor() {
    super(Vehicle.Type.Plane)
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
   * Deal with MAVLink messages necessary for vehicles of type plane
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
