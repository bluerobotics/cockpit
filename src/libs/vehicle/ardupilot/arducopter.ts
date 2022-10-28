import * as Vehicle from '../vehicle'
import { ArduPilotVehicle } from './ardupilot'

/**
 * Custom modes for Copter
 */
export enum CustomMode {
  // Mode not set by vehicle yet
  PRE_FLIGHT = -1,
  // Manual airframe angle with manual throttle
  STABILIZE = 0,
  // Manual body-frame angular rate with manual throttle
  ACRO = 1,
  // Manual airframe angle with automatic throttle
  ALT_HOLD = 2,
  // Fully automatic waypoint control using mission commands
  AUTO = 3,
  // Fully automatic fly to coordinate or fly at velocity/direction using GCS immediate commands
  GUIDED = 4,
  // Automatic horizontal acceleration with automatic throttle
  LOITER = 5,
  // Automatic return to launching point
  RTL = 6,
  // Automatic circular flight with automatic throttle
  CIRCLE = 7,
  // Automatic landing with horizontal position control
  LAND = 9,
  // Semi-autonomous position, yaw and throttle control
  DRIFT = 11,
  // Manual earth-frame angular rate control with manual throttle
  SPORT = 13,
  // Automatically flip the vehicle on the roll axis
  FLIP = 14,
  // Automatically tune the vehicle's roll and pitch gains
  AUTOTUNE = 15,
  // Automatic position hold with manual override, with automatic throttle
  POSHOLD = 16,
  // Full-brake using inertial/GPS system, no pilot input
  BRAKE = 17,
  // Throw to launch mode using inertial/GPS system, no pilot input
  THROW = 18,
  // Automatic avoidance of obstacles in the macro scale - e.g. full-sized aircraft
  AVOID_ADSB = 19,
  // Guided mode but only accepts attitude and altitude
  GUIDED_NOGPS = 20,
  // Smart_Rtl returns to home by retracing its steps
  SMART_RTL = 21,
  // Flowhold holds position with optical flow without rangefinder
  FLOWHOLD = 22,
  // Follow attempts to follow another vehicle or ground station
  FOLLOW = 23,
  // Zigzag mode is able to fly in a zigzag manner with predefined point A and point B
  ZIGZAG = 24,
  // System ID mode produces automated system identification signals in the controllers
  SYSTEMID = 25,
  // Autonomous autorotation
  AUTOROTATE = 26,
  // Auto RTL, this is not a true mode
  // Auto will report as this mode if entered to perform a DO_LAND_START Landing sequence
  AUTO_RTL = 27,
  // Flip over after crash
  TURTLE = 28,
}

/**
 * ArduCopter vehicle
 */
export class ArduCopter extends ArduPilotVehicle<CustomMode> {
  _mode: CustomMode = CustomMode.PRE_FLIGHT

  /**
   * Create ArduCopter vehicle
   */
  constructor() {
    super(Vehicle.Type.Copter)
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
    Object.entries(CustomMode).forEach(([key, value]) => {
      modeMap.set(key, value)
    })
    return modeMap
  }
}
