import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavModeFlag } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import * as arduplane_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Plane-4.3/apm.pdef.json'

import * as Vehicle from '../vehicle'
import { ArduPilotVehicle } from './ardupilot'
import { PlaneMode as CustomMode } from './types/modes'

export { CustomMode }

/**
 * ArduPlane vehicle
 */
export class ArduPlane extends ArduPilotVehicle<CustomMode> {
  _mode: CustomMode = CustomMode.PRE_FLIGHT
  _metadata = arduplane_metadata

  /**
   * Create ArduPlane vehicle
   * @param {number} system_id
   */
  constructor(system_id: number) {
    super(Vehicle.Type.Plane, system_id, CustomMode)
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
