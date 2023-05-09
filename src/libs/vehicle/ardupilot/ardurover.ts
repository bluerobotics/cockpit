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
}
