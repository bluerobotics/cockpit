import { Type as VehicleType } from '../vehicle'

/**
 * Names for the modes of each vehicle type, keyed by the mode name reported by the vehicle.
 */
export type FlightModeNames = Partial<Record<VehicleType, Record<string, string>>>

// TODO: Ask the vehicle for its modes over the MAVLink Standard Modes protocol instead of hardcoding them here: https://mavlink.io/en/services/standard_modes.html
/**
 * Name Cockpit shows for each mode, following the ones ArduPilot uses in its parameter metadata: the mode selection
 * parameters (FLTMODE1 for Copter and Plane, MODE1 for Rover) and the joystick button functions (BTNx_FUNCTION) for
 * Sub, which is where ArduPilot names the Sub modes. Names ArduPilot writes as a single word, like AltHold or QRTL,
 * are spelled out here, since the pilot reading them mid-dive is not the one who wrote the firmware.
 */
export const defaultFlightModeNames: FlightModeNames = {
  [VehicleType.Sub]: {
    MANUAL: 'Manual',
    STABILIZE: 'Stabilize',
    ACRO: 'Acro',
    ALT_HOLD: 'Depth Hold',
    AUTO: 'Auto',
    GUIDED: 'Guided',
    CIRCLE: 'Circle',
    SURFACE: 'Surface',
    POSHOLD: 'Position Hold',
    MOTOR_DETECT: 'Motor Detection',
    SURFTRAK: 'Surface Track',
  },
  [VehicleType.Rover]: {
    MANUAL: 'Manual',
    ACRO: 'Acro',
    STEERING: 'Steering',
    HOLD: 'Hold',
    LOITER: 'Loiter',
    FOLLOW: 'Follow',
    SIMPLE: 'Simple',
    DOCK: 'Dock',
    CIRCLE: 'Circle',
    AUTO: 'Auto',
    RTL: 'RTL',
    SMART_RTL: 'Smart RTL',
    GUIDED: 'Guided',
    INITIALISING: 'Initialising',
  },
  [VehicleType.Copter]: {
    STABILIZE: 'Stabilize',
    ACRO: 'Acro',
    ALT_HOLD: 'Altitude Hold',
    AUTO: 'Auto',
    GUIDED: 'Guided',
    LOITER: 'Loiter',
    RTL: 'RTL',
    CIRCLE: 'Circle',
    LAND: 'Land',
    DRIFT: 'Drift',
    SPORT: 'Sport',
    FLIP: 'Flip',
    AUTOTUNE: 'Auto Tune',
    POSHOLD: 'Position Hold',
    BRAKE: 'Brake',
    THROW: 'Throw',
    AVOID_ADSB: 'Avoid ADSB',
    GUIDED_NOGPS: 'Guided No GPS',
    SMART_RTL: 'Smart RTL',
    FLOWHOLD: 'Flow Hold',
    FOLLOW: 'Follow',
    ZIGZAG: 'Zig Zag',
    SYSTEMID: 'System ID',
    AUTOROTATE: 'Heli Auto Rotate',
    AUTO_RTL: 'Auto RTL',
    TURTLE: 'Turtle',
  },
  [VehicleType.Plane]: {
    MANUAL: 'Manual',
    CIRCLE: 'Circle',
    STABILIZE: 'Stabilize',
    TRAINING: 'Training',
    ACRO: 'Acro',
    FLY_BY_WIRE_A: 'Fly-By-Wire A',
    FLY_BY_WIRE_B: 'Fly-By-Wire B',
    CRUISE: 'Cruise',
    AUTOTUNE: 'Auto Tune',
    AUTO: 'Auto',
    RTL: 'RTL',
    LOITER: 'Loiter',
    TAKEOFF: 'Takeoff',
    AVOID_ADSB: 'Avoid ADSB',
    GUIDED: 'Guided',
    INITIALISING: 'Initialising',
    QSTABILIZE: 'Q-Stabilize',
    QHOVER: 'Q-Hover',
    QLOITER: 'Q-Loiter',
    QLAND: 'Q-Land',
    QRTL: 'Q-RTL',
    QAUTOTUNE: 'Q-Auto Tune',
    QACRO: 'Q-Acro',
    THERMAL: 'Thermal',
    LOITER_ALT_QLAND: 'Loiter to Q-Land',
  },
}

/**
 * Get the name to show the user for a vehicle mode
 * @param {string} modeName - Mode name as reported by the vehicle, e.g. 'ALT_HOLD'
 * @param {VehicleType | undefined} vehicleType - Type of the vehicle the mode belongs to
 * @param {FlightModeNames} customNames - Names chosen by the user, which win over the ArduPilot ones
 * @returns {string} The name to display, falling back to the mode name itself when no name is known for it
 */
export const flightModeName = (
  modeName: string,
  vehicleType?: VehicleType,
  customNames: FlightModeNames = {}
): string => {
  if (vehicleType === undefined) return modeName
  const mode = modeName.toUpperCase()
  return customNames[vehicleType]?.[mode] ?? defaultFlightModeNames[vehicleType]?.[mode] ?? modeName
}
