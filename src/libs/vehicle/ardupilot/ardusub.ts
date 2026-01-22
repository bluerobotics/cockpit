import { createDataLakeVariable, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavModeFlag } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import * as ardusub_metadata from '@/libs/vehicle/ardupilot/ParameterRepository/Sub-4.5/apm.pdef.json'

import * as Vehicle from '../vehicle'
import { ArduPilotVehicle } from './ardupilot'
import { SubMode as CustomMode } from './types/modes'

export { CustomMode }

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
        break
      }
      case MAVLinkType.SCALED_PRESSURE3: {
        // Create a nice alias for when the user has a Celsius temperature sensor
        const scaled_pressure3 = mavlink.message as Message.ScaledPressure3

        // It's only a Celsius if the pressures are set to 0
        if (scaled_pressure3.press_abs !== 0 || scaled_pressure3.press_diff !== 0) return
        const { system_id: messageSystemId, component_id: messageComponentId } = mavlink.header
        // Special names are only for the primary vehicle
        if (messageSystemId !== this.currentSystemId || messageComponentId !== 1) return
        const aliasId = 'celsius-temperature'
        if (getDataLakeVariableInfo(aliasId) === undefined) {
          createDataLakeVariable({ id: aliasId, name: `Celsius Temperature (Probably)`, type: 'number' })
        }
        setDataLakeVariableData(aliasId, scaled_pressure3.temperature)
        break
      }
    }
  }
}
