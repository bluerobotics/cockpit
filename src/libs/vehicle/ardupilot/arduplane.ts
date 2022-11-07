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

  /**
   * Create ArduPlane vehicle
   */
  constructor() {
    super(Vehicle.Type.Plane)
  }

  /**
   * Get vehicle flight mode
   *
   * @returns {CustomMode}
   */
  mode(): CustomMode {
    return this._mode
  }

  /**
   * Get a list of available modes
   *
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
