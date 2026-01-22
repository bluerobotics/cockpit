/**
 * Custom modes for Rover
 */
export enum RoverMode {
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
  CIRCLE = 9,
  AUTO = 10,
  RTL = 11,
  SMART_RTL = 12,
  GUIDED = 15,
  INITIALISING = 16,
}

/**
 * Custom modes for Sub
 */
export enum SubMode {
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
 * Custom modes for Copter
 */
export enum CopterMode {
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
 * Custom modes for Plane
 */
export enum PlaneMode {
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
 * Custom modes for Blimp
 */
export enum BlimpMode {
  // Mode not set by vehicle yet
  PRE_FLIGHT = -1,
  // Stop moving
  LAND = 0,
  MANUAL = 1,
  VELOCITY = 2,
  LOITER = 3,
  RTL = 4,
}
