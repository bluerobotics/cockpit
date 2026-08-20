import { Type as VehicleType } from '../vehicle'

/**
 * Names for the modes of each vehicle type, keyed by the mode name reported by the vehicle.
 */
export type FlightModeNames = Partial<Record<VehicleType, Record<string, string>>>

/**
 * Names ArduPilot itself gives to each mode, taken from its parameter metadata: the mode selection parameters
 * (FLTMODE1 for Copter and Plane, MODE1 for Rover) and the joystick button functions (BTNx_FUNCTION) for Sub, which
 * is where ArduPilot names the Sub modes. Modes absent from those lists are named after the mode documentation of
 * their vehicle, and underscores are turned into spaces.
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
    POSHOLD: 'PosHold',
    MOTOR_DETECT: 'Motor Detect',
    SURFTRAK: 'Surftrak',
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
    SMART_RTL: 'SmartRTL',
    GUIDED: 'Guided',
    INITIALISING: 'Initialising',
  },
  [VehicleType.Copter]: {
    STABILIZE: 'Stabilize',
    ACRO: 'Acro',
    ALT_HOLD: 'AltHold',
    AUTO: 'Auto',
    GUIDED: 'Guided',
    LOITER: 'Loiter',
    RTL: 'RTL',
    CIRCLE: 'Circle',
    LAND: 'Land',
    DRIFT: 'Drift',
    SPORT: 'Sport',
    FLIP: 'Flip',
    AUTOTUNE: 'AutoTune',
    POSHOLD: 'PosHold',
    BRAKE: 'Brake',
    THROW: 'Throw',
    AVOID_ADSB: 'Avoid ADSB',
    GUIDED_NOGPS: 'Guided NoGPS',
    SMART_RTL: 'Smart RTL',
    FLOWHOLD: 'FlowHold',
    FOLLOW: 'Follow',
    ZIGZAG: 'ZigZag',
    SYSTEMID: 'SystemID',
    AUTOROTATE: 'Heli Autorotate',
    AUTO_RTL: 'Auto RTL',
    TURTLE: 'Turtle',
  },
  [VehicleType.Plane]: {
    MANUAL: 'Manual',
    CIRCLE: 'Circle',
    STABILIZE: 'Stabilize',
    TRAINING: 'Training',
    ACRO: 'Acro',
    FLY_BY_WIRE_A: 'FBWA',
    FLY_BY_WIRE_B: 'FBWB',
    CRUISE: 'Cruise',
    AUTOTUNE: 'AutoTune',
    AUTO: 'Auto',
    RTL: 'RTL',
    LOITER: 'Loiter',
    TAKEOFF: 'Takeoff',
    AVOID_ADSB: 'Avoid ADSB',
    GUIDED: 'Guided',
    INITIALISING: 'Initialising',
    QSTABILIZE: 'QStabilize',
    QHOVER: 'QHover',
    QLOITER: 'QLoiter',
    QLAND: 'QLand',
    QRTL: 'QRTL',
    QAUTOTUNE: 'QAutoTune',
    QACRO: 'QAcro',
    THERMAL: 'Thermal',
    LOITER_ALT_QLAND: 'Loiter to QLand',
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
