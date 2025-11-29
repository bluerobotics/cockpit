import * as MAVLinkVehicle from '../mavlink/vehicle'
import * as Vehicle from '../vehicle'

/**
 * Custom modes for PX4
 */
export enum CustomMode {
  // Manual airframe angle with manual throttle
  MANUAL = 1,
  // Altitude control
  ALTCTL = 2,
  // Position control
  POSCTL = 3,
  // Automatic control
  AUTO = 4,
  // Acro Mode
  ACRO = 5,
  // Offboard Mode
  OFFBOARD = 6,
  // Stabilized Mode
  STABILIZED = 7,
  // Rattitude Legacy Mode
  RATTITUDE_LEGACY = 8,
  // Unused, but reserved for future use
  SIMPLE = 9,
  // Termination Mode
  TERMINATION = 10,
}

/**
 * PX4 vehicle
 */
export class PX4 extends MAVLinkVehicle.MAVLinkVehicle<CustomMode> {
  _mode: CustomMode = CustomMode.MANUAL

  protected currentSystemId = 1

  /**
   * Returns the current system ID
   * @returns {number}
   */
  get systemId(): number {
    return this.currentSystemId
  }

  /**
   * Create PX4 vehicle
   * @param {Vehicle.Type} type
   * @param {number} system_id
   */
  constructor(type: Vehicle.Type, system_id: number) {
    super(Vehicle.Firmware.PX4, type, system_id)
    this.currentSystemId = system_id
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
