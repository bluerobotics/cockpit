/**
 * Based over: https://mavlink.io/en/messages/common.html and https://mavlink.io/en/messages/ardupilotmega.html
 *
 */
/* eslint-disable max-len */
/**
 * Micro air vehicle / autopilot classes. This identifies the individual model.
 */
export enum MavAutopilot {
  // Generic autopilot, full support for everything
  MAV_AUTOPILOT_GENERIC = 'MAV_AUTOPILOT_GENERIC',
  // Reserved for future use.
  MAV_AUTOPILOT_RESERVED = 'MAV_AUTOPILOT_RESERVED',
  // SLUGS autopilot, http://slugsuav.soe.ucsc.edu
  MAV_AUTOPILOT_SLUGS = 'MAV_AUTOPILOT_SLUGS',
  // ArduPilot - Plane/Copter/Rover/Sub/Tracker, https://ardupilot.org
  MAV_AUTOPILOT_ARDUPILOTMEGA = 'MAV_AUTOPILOT_ARDUPILOTMEGA',
  // OpenPilot, http://openpilot.org
  MAV_AUTOPILOT_OPENPILOT = 'MAV_AUTOPILOT_OPENPILOT',
  // Generic autopilot only supporting simple waypoints
  MAV_AUTOPILOT_GENERIC_WAYPOINTS_ONLY = 'MAV_AUTOPILOT_GENERIC_WAYPOINTS_ONLY',
  // Generic autopilot supporting waypoints and other simple navigation commands
  MAV_AUTOPILOT_GENERIC_WAYPOINTS_AND_SIMPLE_NAVIGATION_ONLY = 'MAV_AUTOPILOT_GENERIC_WAYPOINTS_AND_SIMPLE_NAVIGATION_ONLY',
  // Generic autopilot supporting the full mission command set
  MAV_AUTOPILOT_GENERIC_MISSION_FULL = 'MAV_AUTOPILOT_GENERIC_MISSION_FULL',
  // No valid autopilot, e.g. a GCS or other MAVLink component
  MAV_AUTOPILOT_INVALID = 'MAV_AUTOPILOT_INVALID',
  // PPZ UAV - http://nongnu.org/paparazzi
  MAV_AUTOPILOT_PPZ = 'MAV_AUTOPILOT_PPZ',
  // UAV Dev Board
  MAV_AUTOPILOT_UDB = 'MAV_AUTOPILOT_UDB',
  // FlexiPilot
  MAV_AUTOPILOT_FP = 'MAV_AUTOPILOT_FP',
  // PX4 Autopilot - http://px4.io/
  MAV_AUTOPILOT_PX4 = 'MAV_AUTOPILOT_PX4',
  // SMACCMPilot - http://smaccmpilot.org
  MAV_AUTOPILOT_SMACCMPILOT = 'MAV_AUTOPILOT_SMACCMPILOT',
  // AutoQuad -- http://autoquad.org
  MAV_AUTOPILOT_AUTOQUAD = 'MAV_AUTOPILOT_AUTOQUAD',
  // Armazila -- http://armazila.com
  MAV_AUTOPILOT_ARMAZILA = 'MAV_AUTOPILOT_ARMAZILA',
  // Aerob -- http://aerob.ru
  MAV_AUTOPILOT_AEROB = 'MAV_AUTOPILOT_AEROB',
  // ASLUAV autopilot -- http://www.asl.ethz.ch
  MAV_AUTOPILOT_ASLUAV = 'MAV_AUTOPILOT_ASLUAV',
  // SmartAP Autopilot - http://sky-drones.com
  MAV_AUTOPILOT_SMARTAP = 'MAV_AUTOPILOT_SMARTAP',
  // AirRails - http://uaventure.com
  MAV_AUTOPILOT_AIRRAILS = 'MAV_AUTOPILOT_AIRRAILS',
}

/**
 * MAVLINK component type reported in HEARTBEAT message.
 * Flight controllers must report the type of the vehicle on which they are mounted (e.g. MAV_TYPE_OCTOROTOR).
 * All other components must report a value appropriate for their type (e.g. a camera must use MAV_TYPE_CAMERA).
 */
export enum MavType {
  // Generic micro air vehicle
  MAV_TYPE_GENERIC = 'MAV_TYPE_GENERIC',
  // Fixed wing aircraft.
  MAV_TYPE_FIXED_WING = 'MAV_TYPE_FIXED_WING',
  // Quadrotor
  MAV_TYPE_QUADROTOR = 'MAV_TYPE_QUADROTOR',
  // Coaxial helicopter
  MAV_TYPE_COAXIAL = 'MAV_TYPE_COAXIAL',
  // Normal helicopter with tail rotor.
  MAV_TYPE_HELICOPTER = 'MAV_TYPE_HELICOPTER',
  // Ground installation
  MAV_TYPE_ANTENNA_TRACKER = 'MAV_TYPE_ANTENNA_TRACKER',
  // Operator control unit / ground control station
  MAV_TYPE_GCS = 'MAV_TYPE_GCS',
  // Airship, controlled
  MAV_TYPE_AIRSHIP = 'MAV_TYPE_AIRSHIP',
  // Free balloon, uncontrolled
  MAV_TYPE_FREE_BALLOON = 'MAV_TYPE_FREE_BALLOON',
  // Rocket
  MAV_TYPE_ROCKET = 'MAV_TYPE_ROCKET',
  // Ground rover
  MAV_TYPE_GROUND_ROVER = 'MAV_TYPE_GROUND_ROVER',
  // Surface vessel, boat, ship
  MAV_TYPE_SURFACE_BOAT = 'MAV_TYPE_SURFACE_BOAT',
  // Submarine
  MAV_TYPE_SUBMARINE = 'MAV_TYPE_SUBMARINE',
  // Hexarotor
  MAV_TYPE_HEXAROTOR = 'MAV_TYPE_HEXAROTOR',
  // Octorotor
  MAV_TYPE_OCTOROTOR = 'MAV_TYPE_OCTOROTOR',
  // Tricopter
  MAV_TYPE_TRICOPTER = 'MAV_TYPE_TRICOPTER',
  // Flapping wing
  MAV_TYPE_FLAPPING_WING = 'MAV_TYPE_FLAPPING_WING',
  // Kite
  MAV_TYPE_KITE = 'MAV_TYPE_KITE',
  // Onboard companion controller
  MAV_TYPE_ONBOARD_CONTROLLER = 'MAV_TYPE_ONBOARD_CONTROLLER',
  // Two-rotor VTOL using control surfaces in vertical operation in addition. Tailsitter.
  MAV_TYPE_VTOL_DUOROTOR = 'MAV_TYPE_VTOL_DUOROTOR',
  // Quad-rotor VTOL using a V-shaped quad config in vertical operation. Tailsitter.
  MAV_TYPE_VTOL_QUADROTOR = 'MAV_TYPE_VTOL_QUADROTOR',
  // Tiltrotor VTOL
  MAV_TYPE_VTOL_TILTROTOR = 'MAV_TYPE_VTOL_TILTROTOR',
  // VTOL reserved 2
  MAV_TYPE_VTOL_RESERVED2 = 'MAV_TYPE_VTOL_RESERVED2',
  // VTOL reserved 3
  MAV_TYPE_VTOL_RESERVED3 = 'MAV_TYPE_VTOL_RESERVED3',
  // VTOL reserved 4
  MAV_TYPE_VTOL_RESERVED4 = 'MAV_TYPE_VTOL_RESERVED4',
  // VTOL reserved 5
  MAV_TYPE_VTOL_RESERVED5 = 'MAV_TYPE_VTOL_RESERVED5',
  // Gimbal
  MAV_TYPE_GIMBAL = 'MAV_TYPE_GIMBAL',
  // ADSB system
  MAV_TYPE_ADSB = 'MAV_TYPE_ADSB',
  // Steerable, nonrigid airfoil
  MAV_TYPE_PARAFOIL = 'MAV_TYPE_PARAFOIL',
  // Dodecarotor
  MAV_TYPE_DODECAROTOR = 'MAV_TYPE_DODECAROTOR',
  // Camera
  MAV_TYPE_CAMERA = 'MAV_TYPE_CAMERA',
  // Charging station
  MAV_TYPE_CHARGING_STATION = 'MAV_TYPE_CHARGING_STATION',
  // FLARM collision avoidance system
  MAV_TYPE_FLARM = 'MAV_TYPE_FLARM',
  // Servo
  MAV_TYPE_SERVO = 'MAV_TYPE_SERVO',
  // Open Drone ID. See https://mavlink.io/en/services/opendroneid.html.
  MAV_TYPE_ODID = 'MAV_TYPE_ODID',
}

/**
 * These values define the type of firmware release.
 * These values indicate the first version or release of this type.
 * For example the first alpha release would be 64, the second would be 65.
 */
export enum FirmwareVersionType {
  // development release
  FIRMWARE_VERSION_TYPE_DEV = 'FIRMWARE_VERSION_TYPE_DEV',
  // alpha release
  FIRMWARE_VERSION_TYPE_ALPHA = 'FIRMWARE_VERSION_TYPE_ALPHA',
  // beta release
  FIRMWARE_VERSION_TYPE_BETA = 'FIRMWARE_VERSION_TYPE_BETA',
  // release candidate
  FIRMWARE_VERSION_TYPE_RC = 'FIRMWARE_VERSION_TYPE_RC',
  // official stable release
  FIRMWARE_VERSION_TYPE_OFFICIAL = 'FIRMWARE_VERSION_TYPE_OFFICIAL',
}

/**
 * These values encode the bit positions of the decode position.
 * These values can be used to read the value of a flag bit by combining the base_mode variable with AND with the flag position value.
 * The result will be either 0 or 1, depending on if the flag is set or not.
 */
export enum MavModeFlagDecodePosition {
  // First bit:  10000000
  MAV_MODE_FLAG_DECODE_POSITION_SAFETY = 'MAV_MODE_FLAG_DECODE_POSITION_SAFETY',
  // Second bit: 01000000
  MAV_MODE_FLAG_DECODE_POSITION_MANUAL = 'MAV_MODE_FLAG_DECODE_POSITION_MANUAL',
  // Third bit:  00100000
  MAV_MODE_FLAG_DECODE_POSITION_HIL = 'MAV_MODE_FLAG_DECODE_POSITION_HIL',
  // Fourth bit: 00010000
  MAV_MODE_FLAG_DECODE_POSITION_STABILIZE = 'MAV_MODE_FLAG_DECODE_POSITION_STABILIZE',
  // Fifth bit:  00001000
  MAV_MODE_FLAG_DECODE_POSITION_GUIDED = 'MAV_MODE_FLAG_DECODE_POSITION_GUIDED',
  // Sixth bit:   00000100
  MAV_MODE_FLAG_DECODE_POSITION_AUTO = 'MAV_MODE_FLAG_DECODE_POSITION_AUTO',
  // Seventh bit: 00000010
  MAV_MODE_FLAG_DECODE_POSITION_TEST = 'MAV_MODE_FLAG_DECODE_POSITION_TEST',
  // Eighth bit: 00000001
  MAV_MODE_FLAG_DECODE_POSITION_CUSTOM_MODE = 'MAV_MODE_FLAG_DECODE_POSITION_CUSTOM_MODE',
}

/**
 * Actions that may be specified in MAV_CMD_OVERRIDE_GOTO to override mission execution.
 */
export enum MavGoto {
  // Hold at the current position.
  MAV_GOTO_DO_HOLD = 'MAV_GOTO_DO_HOLD',
  // Continue with the next item in mission execution.
  MAV_GOTO_DO_CONTINUE = 'MAV_GOTO_DO_CONTINUE',
  // Hold at the current position of the system
  MAV_GOTO_HOLD_AT_CURRENT_POSITION = 'MAV_GOTO_HOLD_AT_CURRENT_POSITION',
  // Hold at the position specified in the parameters of the DO_HOLD action
  MAV_GOTO_HOLD_AT_SPECIFIED_POSITION = 'MAV_GOTO_HOLD_AT_SPECIFIED_POSITION',
}

/**
 * These encode the sensors whose status is sent as part of the SYS_STATUS message.
 */
export enum MavSysStatusSensor {
  // 3D gyro
  MAV_SYS_STATUS_SENSOR_3D_GYRO = 0x01,
  // 3D accelerometer
  MAV_SYS_STATUS_SENSOR_3D_ACCEL = 0x02,
  // 3D magnetometer
  MAV_SYS_STATUS_SENSOR_3D_MAG = 0x04,
  // Absolute pressure
  MAV_SYS_STATUS_SENSOR_ABSOLUTE_PRESSURE = 0x08,
  // Differential pressure
  MAV_SYS_STATUS_SENSOR_DIFFERENTIAL_PRESSURE = 0x10,
  // GPS
  MAV_SYS_STATUS_SENSOR_GPS = 0x20,
  // Optical flow
  MAV_SYS_STATUS_SENSOR_OPTICAL_FLOW = 0x40,
  // Computer vision position
  MAV_SYS_STATUS_SENSOR_VISION_POSITION = 0x80,
  // Laser based position
  MAV_SYS_STATUS_SENSOR_LASER_POSITION = 0x100,
  // External ground truth (Vicon or Leica)
  MAV_SYS_STATUS_SENSOR_EXTERNAL_GROUND_TRUTH = 0x200,
  // 3D angular rate control
  MAV_SYS_STATUS_SENSOR_ANGULAR_RATE_CONTROL = 0x400,
  // Attitude stabilization
  MAV_SYS_STATUS_SENSOR_ATTITUDE_STABILIZATION = 0x800,
  // Yaw position
  MAV_SYS_STATUS_SENSOR_YAW_POSITION = 0x1000,
  // Z/altitude control
  MAV_SYS_STATUS_SENSOR_Z_ALTITUDE_CONTROL = 0x2000,
  // x/y position control
  MAV_SYS_STATUS_SENSOR_XY_POSITION_CONTROL = 0x4000,
  // Motor outputs / control
  MAV_SYS_STATUS_SENSOR_MOTOR_OUTPUTS = 0x8000,
  // Rc receiver
  MAV_SYS_STATUS_SENSOR_RC_RECEIVER = 0x10000,
  // 2nd 3D gyro
  MAV_SYS_STATUS_SENSOR_3D_GYRO2 = 0x20000,
  // 2nd 3D accelerometer
  MAV_SYS_STATUS_SENSOR_3D_ACCEL2 = 0x40000,
  // 2nd 3D magnetometer
  MAV_SYS_STATUS_SENSOR_3D_MAG2 = 0x80000,
  // Geofence
  MAV_SYS_STATUS_GEOFENCE = 0x100000,
  // AHRS subsystem health
  MAV_SYS_STATUS_AHRS = 0x200000,
  // Terrain subsystem health
  MAV_SYS_STATUS_TERRAIN = 0x400000,
  // Motors are reversed
  MAV_SYS_STATUS_REVERSE_MOTOR = 0x800000,
  // Logging
  MAV_SYS_STATUS_LOGGING = 0x1000000,
  // Battery
  MAV_SYS_STATUS_SENSOR_BATTERY = 0x2000000,
  // Proximity
  MAV_SYS_STATUS_SENSOR_PROXIMITY = 0x4000000,
  // Satellite Communication
  MAV_SYS_STATUS_SENSOR_SATCOM = 0x8000000,
  // Pre-arm check status. Always healthy when armed
  MAV_SYS_STATUS_PREARM_CHECK = 0x10000000,
  // Avoidance/collision prevention
  MAV_SYS_STATUS_OBSTACLE_AVOIDANCE = 0x20000000,
  // Propulsion (actuator, esc, motor or propellor)
  MAV_SYS_STATUS_SENSOR_PROPULSION = 0x40000000,
  // Extended bit-field are used for further sensor status bits (needs to be set in onboard_control_sensors_present only)
  MAV_SYS_STATUS_EXTENSION_USED = 0x80000000,
}

/**
 * These defines are predefined OR-combined mode flags.
 * There is no need to use values from this enum, but it simplifies the use of the mode flags.
 * Note that manual input is enabled in all modes as a safety override.
 */
export enum MavMode {
  // System is not ready to fly, booting, calibrating, etc. No flag is set.
  MAV_MODE_PREFLIGHT = 'MAV_MODE_PREFLIGHT',
  // System is allowed to be active, under assisted RC control.
  MAV_MODE_STABILIZE_DISARMED = 'MAV_MODE_STABILIZE_DISARMED',
  // System is allowed to be active, under assisted RC control.
  MAV_MODE_STABILIZE_ARMED = 'MAV_MODE_STABILIZE_ARMED',
  // System is allowed to be active, under manual (RC) control, no stabilization
  MAV_MODE_MANUAL_DISARMED = 'MAV_MODE_MANUAL_DISARMED',
  // System is allowed to be active, under manual (RC) control, no stabilization
  MAV_MODE_MANUAL_ARMED = 'MAV_MODE_MANUAL_ARMED',
  // System is allowed to be active, under autonomous control, manual setpoint
  MAV_MODE_GUIDED_DISARMED = 'MAV_MODE_GUIDED_DISARMED',
  // System is allowed to be active, under autonomous control, manual setpoint
  MAV_MODE_GUIDED_ARMED = 'MAV_MODE_GUIDED_ARMED',
  // System is allowed to be active, under autonomous control and navigation (the trajectory is decided onboard and not pre-programmed by waypoints)
  MAV_MODE_AUTO_DISARMED = 'MAV_MODE_AUTO_DISARMED',
  // System is allowed to be active, under autonomous control and navigation (the trajectory is decided onboard and not pre-programmed by waypoints)
  MAV_MODE_AUTO_ARMED = 'MAV_MODE_AUTO_ARMED',
  // UNDEFINED mode. This solely depends on the autopilot - use with caution, intended for developers only.
  MAV_MODE_TEST_DISARMED = 'MAV_MODE_TEST_DISARMED',
  // UNDEFINED mode. This solely depends on the autopilot - use with caution, intended for developers only.
  MAV_MODE_TEST_ARMED = 'MAV_MODE_TEST_ARMED',
}

/**
 * State of the vehicle
 */
export enum MavState {
  // Uninitialized system, state is unknown.
  MAV_STATE_UNINIT = 'MAV_STATE_UNINIT',
  // System is booting up.
  MAV_STATE_BOOT = 'MAV_STATE_BOOT',
  // System is calibrating and not flight-ready.
  MAV_STATE_CALIBRATING = 'MAV_STATE_CALIBRATING',
  // System is grounded and on standby. It can be launched any time.
  MAV_STATE_STANDBY = 'MAV_STATE_STANDBY',
  // System is active and might be already airborne. Motors are engaged.
  MAV_STATE_ACTIVE = 'MAV_STATE_ACTIVE',
  // System is in a non-normal flight mode. It can however still navigate.
  MAV_STATE_CRITICAL = 'MAV_STATE_CRITICAL',
  // System is in a non-normal flight mode. It lost control over parts or over the whole airframe. It is in mayday and going down.
  MAV_STATE_EMERGENCY = 'MAV_STATE_EMERGENCY',
  // System just initialized its power-down sequence, will shut down now.
  MAV_STATE_POWEROFF = 'MAV_STATE_POWEROFF',
  // System is terminating itself.
  MAV_STATE_FLIGHT_TERMINATION = 'MAV_STATE_FLIGHT_TERMINATION',
}

/**
 * Component ids (values) for the different types and instances of onboard hardware/software that might make up a MAVLink system (autopilot, cameras, servos, GPS systems, avoidance systems etc.).
 * Components must use the appropriate ID in their source address when sending messages.
 * Components can also use IDs to determine if they are the intended recipient of an incoming message.
 * The MAV_COMP_ID_ALL value is used to indicate messages that must be processed by all components.
 * When creating new entries, components that can have multiple instances (e.g. cameras, servos etc.)
 * should be allocated sequential values. An appropriate number of values should be left free after these components to allow the number of instances to be expanded.
 */
export enum MavComponent {
  // Target id (target_component) used to broadcast messages to all components of the receiving system. Components should attempt to process messages with this component ID and forward to components on any other interfaces. Note: This is not a valid *source* component id for a message.
  MAV_COMP_ID_ALL = 'MAV_COMP_ID_ALL',
  // System flight controller component ("autopilot"). Only one autopilot is expected in a particular system.
  MAV_COMP_ID_AUTOPILOT1 = 'MAV_COMP_ID_AUTOPILOT1',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER1 = 'MAV_COMP_ID_USER1',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER2 = 'MAV_COMP_ID_USER2',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER3 = 'MAV_COMP_ID_USER3',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER4 = 'MAV_COMP_ID_USER4',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER5 = 'MAV_COMP_ID_USER5',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER6 = 'MAV_COMP_ID_USER6',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER7 = 'MAV_COMP_ID_USER7',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER8 = 'MAV_COMP_ID_USER8',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER9 = 'MAV_COMP_ID_USER9',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER10 = 'MAV_COMP_ID_USER10',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER11 = 'MAV_COMP_ID_USER11',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER12 = 'MAV_COMP_ID_USER12',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER13 = 'MAV_COMP_ID_USER13',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER14 = 'MAV_COMP_ID_USER14',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER15 = 'MAV_COMP_ID_USER15',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER16 = 'MAV_COMP_ID_USER16',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER17 = 'MAV_COMP_ID_USER17',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER18 = 'MAV_COMP_ID_USER18',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER19 = 'MAV_COMP_ID_USER19',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER20 = 'MAV_COMP_ID_USER20',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER21 = 'MAV_COMP_ID_USER21',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER22 = 'MAV_COMP_ID_USER22',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER23 = 'MAV_COMP_ID_USER23',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER24 = 'MAV_COMP_ID_USER24',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER25 = 'MAV_COMP_ID_USER25',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER26 = 'MAV_COMP_ID_USER26',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER27 = 'MAV_COMP_ID_USER27',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER28 = 'MAV_COMP_ID_USER28',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER29 = 'MAV_COMP_ID_USER29',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER30 = 'MAV_COMP_ID_USER30',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER31 = 'MAV_COMP_ID_USER31',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER32 = 'MAV_COMP_ID_USER32',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER33 = 'MAV_COMP_ID_USER33',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER34 = 'MAV_COMP_ID_USER34',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER35 = 'MAV_COMP_ID_USER35',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER36 = 'MAV_COMP_ID_USER36',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER37 = 'MAV_COMP_ID_USER37',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER38 = 'MAV_COMP_ID_USER38',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER39 = 'MAV_COMP_ID_USER39',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER40 = 'MAV_COMP_ID_USER40',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER41 = 'MAV_COMP_ID_USER41',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER42 = 'MAV_COMP_ID_USER42',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER43 = 'MAV_COMP_ID_USER43',
  // Telemetry radio (e.g. SiK radio, or other component that emits RADIO_STATUS messages).
  MAV_COMP_ID_TELEMETRY_RADIO = 'MAV_COMP_ID_TELEMETRY_RADIO',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER45 = 'MAV_COMP_ID_USER45',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER46 = 'MAV_COMP_ID_USER46',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER47 = 'MAV_COMP_ID_USER47',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER48 = 'MAV_COMP_ID_USER48',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER49 = 'MAV_COMP_ID_USER49',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER50 = 'MAV_COMP_ID_USER50',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER51 = 'MAV_COMP_ID_USER51',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER52 = 'MAV_COMP_ID_USER52',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER53 = 'MAV_COMP_ID_USER53',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER54 = 'MAV_COMP_ID_USER54',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER55 = 'MAV_COMP_ID_USER55',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER56 = 'MAV_COMP_ID_USER56',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER57 = 'MAV_COMP_ID_USER57',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER58 = 'MAV_COMP_ID_USER58',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER59 = 'MAV_COMP_ID_USER59',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER60 = 'MAV_COMP_ID_USER60',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER61 = 'MAV_COMP_ID_USER61',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER62 = 'MAV_COMP_ID_USER62',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER63 = 'MAV_COMP_ID_USER63',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER64 = 'MAV_COMP_ID_USER64',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER65 = 'MAV_COMP_ID_USER65',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER66 = 'MAV_COMP_ID_USER66',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER67 = 'MAV_COMP_ID_USER67',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER68 = 'MAV_COMP_ID_USER68',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER69 = 'MAV_COMP_ID_USER69',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER70 = 'MAV_COMP_ID_USER70',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER71 = 'MAV_COMP_ID_USER71',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER72 = 'MAV_COMP_ID_USER72',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER73 = 'MAV_COMP_ID_USER73',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER74 = 'MAV_COMP_ID_USER74',
  // Id for a component on privately managed MAVLink network. Can be used for any purpose but may not be published by components outside of the private network.
  MAV_COMP_ID_USER75 = 'MAV_COMP_ID_USER75',
  // Camera #1.
  MAV_COMP_ID_CAMERA = 'MAV_COMP_ID_CAMERA',
  // Camera #2.
  MAV_COMP_ID_CAMERA2 = 'MAV_COMP_ID_CAMERA2',
  // Camera #3.
  MAV_COMP_ID_CAMERA3 = 'MAV_COMP_ID_CAMERA3',
  // Camera #4.
  MAV_COMP_ID_CAMERA4 = 'MAV_COMP_ID_CAMERA4',
  // Camera #5.
  MAV_COMP_ID_CAMERA5 = 'MAV_COMP_ID_CAMERA5',
  // Camera #6.
  MAV_COMP_ID_CAMERA6 = 'MAV_COMP_ID_CAMERA6',
  // Servo #1.
  MAV_COMP_ID_SERVO1 = 'MAV_COMP_ID_SERVO1',
  // Servo #2.
  MAV_COMP_ID_SERVO2 = 'MAV_COMP_ID_SERVO2',
  // Servo #3.
  MAV_COMP_ID_SERVO3 = 'MAV_COMP_ID_SERVO3',
  // Servo #4.
  MAV_COMP_ID_SERVO4 = 'MAV_COMP_ID_SERVO4',
  // Servo #5.
  MAV_COMP_ID_SERVO5 = 'MAV_COMP_ID_SERVO5',
  // Servo #6.
  MAV_COMP_ID_SERVO6 = 'MAV_COMP_ID_SERVO6',
  // Servo #7.
  MAV_COMP_ID_SERVO7 = 'MAV_COMP_ID_SERVO7',
  // Servo #8.
  MAV_COMP_ID_SERVO8 = 'MAV_COMP_ID_SERVO8',
  // Servo #9.
  MAV_COMP_ID_SERVO9 = 'MAV_COMP_ID_SERVO9',
  // Servo #10.
  MAV_COMP_ID_SERVO10 = 'MAV_COMP_ID_SERVO10',
  // Servo #11.
  MAV_COMP_ID_SERVO11 = 'MAV_COMP_ID_SERVO11',
  // Servo #12.
  MAV_COMP_ID_SERVO12 = 'MAV_COMP_ID_SERVO12',
  // Servo #13.
  MAV_COMP_ID_SERVO13 = 'MAV_COMP_ID_SERVO13',
  // Servo #14.
  MAV_COMP_ID_SERVO14 = 'MAV_COMP_ID_SERVO14',
  // Gimbal #1.
  MAV_COMP_ID_GIMBAL = 'MAV_COMP_ID_GIMBAL',
  // Logging component.
  MAV_COMP_ID_LOG = 'MAV_COMP_ID_LOG',
  // Automatic Dependent Surveillance-Broadcast (ADS-B) component.
  MAV_COMP_ID_ADSB = 'MAV_COMP_ID_ADSB',
  // On Screen Display (OSD) devices for video links.
  MAV_COMP_ID_OSD = 'MAV_COMP_ID_OSD',
  // Generic autopilot peripheral component ID. Meant for devices that do not implement the parameter microservice.
  MAV_COMP_ID_PERIPHERAL = 'MAV_COMP_ID_PERIPHERAL',
  // Gimbal ID for QX1.
  MAV_COMP_ID_QX1_GIMBAL = 'MAV_COMP_ID_QX1_GIMBAL',
  // FLARM collision alert component.
  MAV_COMP_ID_FLARM = 'MAV_COMP_ID_FLARM',
  // Gimbal #2.
  MAV_COMP_ID_GIMBAL2 = 'MAV_COMP_ID_GIMBAL2',
  // Gimbal #3.
  MAV_COMP_ID_GIMBAL3 = 'MAV_COMP_ID_GIMBAL3',
  // Gimbal #4
  MAV_COMP_ID_GIMBAL4 = 'MAV_COMP_ID_GIMBAL4',
  // Gimbal #5.
  MAV_COMP_ID_GIMBAL5 = 'MAV_COMP_ID_GIMBAL5',
  // Gimbal #6.
  MAV_COMP_ID_GIMBAL6 = 'MAV_COMP_ID_GIMBAL6',
  // Component that can generate/supply a mission flight plan (e.g. GCS or developer API).
  MAV_COMP_ID_MISSIONPLANNER = 'MAV_COMP_ID_MISSIONPLANNER',
  // Component that finds an optimal path between points based on a certain constraint (e.g. minimum snap, shortest path, cost, etc.).
  MAV_COMP_ID_PATHPLANNER = 'MAV_COMP_ID_PATHPLANNER',
  // Component that plans a collision free path between two points.
  MAV_COMP_ID_OBSTACLE_AVOIDANCE = 'MAV_COMP_ID_OBSTACLE_AVOIDANCE',
  // Component that provides position estimates using VIO techniques.
  MAV_COMP_ID_VISUAL_INERTIAL_ODOMETRY = 'MAV_COMP_ID_VISUAL_INERTIAL_ODOMETRY',
  // Component that manages pairing of vehicle and GCS.
  MAV_COMP_ID_PAIRING_MANAGER = 'MAV_COMP_ID_PAIRING_MANAGER',
  // Inertial Measurement Unit (IMU) #1.
  MAV_COMP_ID_IMU = 'MAV_COMP_ID_IMU',
  // Inertial Measurement Unit (IMU) #2.
  MAV_COMP_ID_IMU_2 = 'MAV_COMP_ID_IMU_2',
  // Inertial Measurement Unit (IMU) #3.
  MAV_COMP_ID_IMU_3 = 'MAV_COMP_ID_IMU_3',
  // GPS #1.
  MAV_COMP_ID_GPS = 'MAV_COMP_ID_GPS',
  // GPS #2.
  MAV_COMP_ID_GPS2 = 'MAV_COMP_ID_GPS2',
  // Open Drone ID transmitter/receiver (Bluetooth/WiFi/Internet).
  MAV_COMP_ID_ODID_TXRX_1 = 'MAV_COMP_ID_ODID_TXRX_1',
  // Open Drone ID transmitter/receiver (Bluetooth/WiFi/Internet).
  MAV_COMP_ID_ODID_TXRX_2 = 'MAV_COMP_ID_ODID_TXRX_2',
  // Open Drone ID transmitter/receiver (Bluetooth/WiFi/Internet).
  MAV_COMP_ID_ODID_TXRX_3 = 'MAV_COMP_ID_ODID_TXRX_3',
  // Component to bridge MAVLink to UDP (i.e. from a UART).
  MAV_COMP_ID_UDP_BRIDGE = 'MAV_COMP_ID_UDP_BRIDGE',
  // Component to bridge to UART (i.e. from UDP).
  MAV_COMP_ID_UART_BRIDGE = 'MAV_COMP_ID_UART_BRIDGE',
  // Component handling TUNNEL messages (e.g. vendor specific GUI of a component).
  MAV_COMP_ID_TUNNEL_NODE = 'MAV_COMP_ID_TUNNEL_NODE',
  // Component for handling system messages (e.g. to ARM, takeoff, etc.).
  MAV_COMP_ID_SYSTEM_CONTROL = 'MAV_COMP_ID_SYSTEM_CONTROL',
}

/**
 * Vehicle frame
 */
export enum MavFrame {
  // Global (WGS84) coordinate frame + MSL altitude. First value / x: latitude, second value / y: longitude, third value / z: positive altitude over mean sea level (MSL).
  MAV_FRAME_GLOBAL = 'MAV_FRAME_GLOBAL',
  // Local coordinate frame, Z-down (x: North, y: East, z: Down).
  MAV_FRAME_LOCAL_NED = 'MAV_FRAME_LOCAL_NED',
  // NOT a coordinate frame, indicates a mission command.
  MAV_FRAME_MISSION = 'MAV_FRAME_MISSION',
  // Global (WGS84) coordinate frame + altitude relative to the home position. First value / x: latitude, second value / y: longitude, third value / z: positive altitude with 0 being at the altitude of the home location.
  MAV_FRAME_GLOBAL_RELATIVE_ALT = 'MAV_FRAME_GLOBAL_RELATIVE_ALT',
  // Local coordinate frame, Z-up (x: East, y: North, z: Up).
  MAV_FRAME_LOCAL_ENU = 'MAV_FRAME_LOCAL_ENU',
  // Global (WGS84) coordinate frame (scaled) + MSL altitude. First value / x: latitude in degrees*1.0e-7, second value / y: longitude in degrees*1.0e-7, third value / z: positive altitude over mean sea level (MSL).
  MAV_FRAME_GLOBAL_INT = 'MAV_FRAME_GLOBAL_INT',
  // Global (WGS84) coordinate frame (scaled) + altitude relative to the home position. First value / x: latitude in degrees*10e-7, second value / y: longitude in degrees*10e-7, third value / z: positive altitude with 0 being at the altitude of the home location.
  MAV_FRAME_GLOBAL_RELATIVE_ALT_INT = 'MAV_FRAME_GLOBAL_RELATIVE_ALT_INT',
  // Offset to the current local frame. Anything expressed in this frame should be added to the current local frame position.
  MAV_FRAME_LOCAL_OFFSET_NED = 'MAV_FRAME_LOCAL_OFFSET_NED',
  // Setpoint in body NED frame. This makes sense if all position control is externalized - e.g. useful to command 2 m/s^2 acceleration to the right.
  MAV_FRAME_BODY_NED = 'MAV_FRAME_BODY_NED',
  // Offset in body NED frame. This makes sense if adding setpoints to the current flight path, to avoid an obstacle - e.g. useful to command 2 m/s^2 acceleration to the east.
  MAV_FRAME_BODY_OFFSET_NED = 'MAV_FRAME_BODY_OFFSET_NED',
  // Global (WGS84) coordinate frame with AGL altitude (at the waypoint coordinate). First value / x: latitude in degrees, second value / y: longitude in degrees, third value / z: positive altitude in meters with 0 being at ground level in terrain model.
  MAV_FRAME_GLOBAL_TERRAIN_ALT = 'MAV_FRAME_GLOBAL_TERRAIN_ALT',
  // Global (WGS84) coordinate frame (scaled) with AGL altitude (at the waypoint coordinate). First value / x: latitude in degrees*10e-7, second value / y: longitude in degrees*10e-7, third value / z: positive altitude in meters with 0 being at ground level in terrain model.
  MAV_FRAME_GLOBAL_TERRAIN_ALT_INT = 'MAV_FRAME_GLOBAL_TERRAIN_ALT_INT',
  // Body fixed frame of reference, Z-down (x: Forward, y: Right, z: Down).
  MAV_FRAME_BODY_FRD = 'MAV_FRAME_BODY_FRD',
  // MAV_FRAME_BODY_FLU - Body fixed frame of reference, Z-up (x: Forward, y: Left, z: Up).
  MAV_FRAME_RESERVED_13 = 'MAV_FRAME_RESERVED_13',
  // MAV_FRAME_MOCAP_NED - Odometry local coordinate frame of data given by a motion capture system, Z-down (x: North, y: East, z: Down).
  MAV_FRAME_RESERVED_14 = 'MAV_FRAME_RESERVED_14',
  // MAV_FRAME_MOCAP_ENU - Odometry local coordinate frame of data given by a motion capture system, Z-up (x: East, y: North, z: Up).
  MAV_FRAME_RESERVED_15 = 'MAV_FRAME_RESERVED_15',
  // MAV_FRAME_VISION_NED - Odometry local coordinate frame of data given by a vision estimation system, Z-down (x: North, y: East, z: Down).
  MAV_FRAME_RESERVED_16 = 'MAV_FRAME_RESERVED_16',
  // MAV_FRAME_VISION_ENU - Odometry local coordinate frame of data given by a vision estimation system, Z-up (x: East, y: North, z: Up).
  MAV_FRAME_RESERVED_17 = 'MAV_FRAME_RESERVED_17',
  // MAV_FRAME_ESTIM_NED - Odometry local coordinate frame of data given by an estimator running onboard the vehicle, Z-down (x: North, y: East, z: Down).
  MAV_FRAME_RESERVED_18 = 'MAV_FRAME_RESERVED_18',
  // MAV_FRAME_ESTIM_ENU - Odometry local coordinate frame of data given by an estimator running onboard the vehicle, Z-up (x: East, y: North, z: Up).
  MAV_FRAME_RESERVED_19 = 'MAV_FRAME_RESERVED_19',
  // Forward, Right, Down coordinate frame. This is a local frame with Z-down and arbitrary F/R alignment (i.e. not aligned with NED/earth frame).
  MAV_FRAME_LOCAL_FRD = 'MAV_FRAME_LOCAL_FRD',
  // Forward, Left, Up coordinate frame. This is a local frame with Z-up and arbitrary F/L alignment (i.e. not aligned with ENU/earth frame).
  MAV_FRAME_LOCAL_FLU = 'MAV_FRAME_LOCAL_FLU',
}

/**
 * Data stream type
 */
export enum MavlinkDataStreamType {
  MAVLINK_DATA_STREAM_IMG_JPEG = 'MAVLINK_DATA_STREAM_IMG_JPEG',
  MAVLINK_DATA_STREAM_IMG_BMP = 'MAVLINK_DATA_STREAM_IMG_BMP',
  MAVLINK_DATA_STREAM_IMG_RAW8U = 'MAVLINK_DATA_STREAM_IMG_RAW8U',
  MAVLINK_DATA_STREAM_IMG_RAW32U = 'MAVLINK_DATA_STREAM_IMG_RAW32U',
  MAVLINK_DATA_STREAM_IMG_PGM = 'MAVLINK_DATA_STREAM_IMG_PGM',
  MAVLINK_DATA_STREAM_IMG_PNG = 'MAVLINK_DATA_STREAM_IMG_PNG',
}

/**
 * Fence action
 */
export enum FenceAction {
  // Disable fenced mode
  FENCE_ACTION_NONE = 'FENCE_ACTION_NONE',
  // Switched to guided mode to return point (fence point 0)
  FENCE_ACTION_GUIDED = 'FENCE_ACTION_GUIDED',
  // Report fence breach, but don't take action
  FENCE_ACTION_REPORT = 'FENCE_ACTION_REPORT',
  // Switched to guided mode to return point (fence point 0) with manual throttle control
  FENCE_ACTION_GUIDED_THR_PASS = 'FENCE_ACTION_GUIDED_THR_PASS',
  // Switch to RTL (return to launch) mode and head for the return point.
  FENCE_ACTION_RTL = 'FENCE_ACTION_RTL',
}

/**
 * Fence breach
 */
export enum FenceBreach {
  // No last fence breach
  FENCE_BREACH_NONE = 'FENCE_BREACH_NONE',
  // Breached minimum altitude
  FENCE_BREACH_MINALT = 'FENCE_BREACH_MINALT',
  // Breached maximum altitude
  FENCE_BREACH_MAXALT = 'FENCE_BREACH_MAXALT',
  // Breached fence boundary
  FENCE_BREACH_BOUNDARY = 'FENCE_BREACH_BOUNDARY',
}

/**
 * Actions being taken to mitigate/prevent fence breach
 */
export enum FenceMitigate {
  // Unknown
  FENCE_MITIGATE_UNKNOWN = 'FENCE_MITIGATE_UNKNOWN',
  // No actions being taken
  FENCE_MITIGATE_NONE = 'FENCE_MITIGATE_NONE',
  // Velocity limiting active to prevent breach
  FENCE_MITIGATE_VEL_LIMIT = 'FENCE_MITIGATE_VEL_LIMIT',
}

/**
 * Enumeration of possible mount operation modes. This message is used by obsolete/deprecated gimbal messages.
 */
export enum MavMountMode {
  // Load and keep safe position (Roll,Pitch,Yaw) from permant memory and stop stabilization
  MAV_MOUNT_MODE_RETRACT = 'MAV_MOUNT_MODE_RETRACT',
  // Load and keep neutral position (Roll,Pitch,Yaw) from permanent memory.
  MAV_MOUNT_MODE_NEUTRAL = 'MAV_MOUNT_MODE_NEUTRAL',
  // Load neutral position and start MAVLink Roll,Pitch,Yaw control with stabilization
  MAV_MOUNT_MODE_MAVLINK_TARGETING = 'MAV_MOUNT_MODE_MAVLINK_TARGETING',
  // Load neutral position and start RC Roll,Pitch,Yaw control with stabilization
  MAV_MOUNT_MODE_RC_TARGETING = 'MAV_MOUNT_MODE_RC_TARGETING',
  // Load neutral position and start to point to Lat,Lon,Alt
  MAV_MOUNT_MODE_GPS_POINT = 'MAV_MOUNT_MODE_GPS_POINT',
  // Gimbal tracks system with specified system ID
  MAV_MOUNT_MODE_SYSID_TARGET = 'MAV_MOUNT_MODE_SYSID_TARGET',
}

/**
 * Flags for gimbal device (lower level) operation.
 */
export enum GimbalDeviceFlags {
  // Set to retracted safe position (no stabilization), takes presedence over all other flags.
  GIMBAL_DEVICE_FLAGS_RETRACT = 'GIMBAL_DEVICE_FLAGS_RETRACT',
  // Set to neutral position (horizontal, forward looking, with stabiliziation), takes presedence over all other flags except RETRACT.
  GIMBAL_DEVICE_FLAGS_NEUTRAL = 'GIMBAL_DEVICE_FLAGS_NEUTRAL',
  // Lock roll angle to absolute angle relative to horizon (not relative to drone). This is generally the default with a stabilizing gimbal.
  GIMBAL_DEVICE_FLAGS_ROLL_LOCK = 'GIMBAL_DEVICE_FLAGS_ROLL_LOCK',
  // Lock pitch angle to absolute angle relative to horizon (not relative to drone). This is generally the default.
  GIMBAL_DEVICE_FLAGS_PITCH_LOCK = 'GIMBAL_DEVICE_FLAGS_PITCH_LOCK',
  // Lock yaw angle to absolute angle relative to North (not relative to drone). If this flag is set, the quaternion is in the Earth frame with the x-axis pointing North (yaw absolute). If this flag is not set, the quaternion frame is in the Earth frame rotated so that the x-axis is pointing forward (yaw relative to vehicle).
  GIMBAL_DEVICE_FLAGS_YAW_LOCK = 'GIMBAL_DEVICE_FLAGS_YAW_LOCK',
}

/**
 * Flags for high level gimbal manager operation The first 16 bytes are identical to the GIMBAL_DEVICE_FLAGS.
 */
export enum GimbalManagerFlags {
  // Based on GIMBAL_DEVICE_FLAGS_RETRACT
  GIMBAL_MANAGER_FLAGS_RETRACT = 'GIMBAL_MANAGER_FLAGS_RETRACT',
  // Based on GIMBAL_DEVICE_FLAGS_NEUTRAL
  GIMBAL_MANAGER_FLAGS_NEUTRAL = 'GIMBAL_MANAGER_FLAGS_NEUTRAL',
  // Based on GIMBAL_DEVICE_FLAGS_ROLL_LOCK
  GIMBAL_MANAGER_FLAGS_ROLL_LOCK = 'GIMBAL_MANAGER_FLAGS_ROLL_LOCK',
  // Based on GIMBAL_DEVICE_FLAGS_PITCH_LOCK
  GIMBAL_MANAGER_FLAGS_PITCH_LOCK = 'GIMBAL_MANAGER_FLAGS_PITCH_LOCK',
  // Based on GIMBAL_DEVICE_FLAGS_YAW_LOCK
  GIMBAL_MANAGER_FLAGS_YAW_LOCK = 'GIMBAL_MANAGER_FLAGS_YAW_LOCK',
  // Scale angular velocity relative to focal length. This means the gimbal moves slower if it is zoomed in.
  GIMBAL_MANAGER_FLAGS_ANGULAR_VELOCITY_RELATIVE_TO_FOCAL_LENGTH = 'GIMBAL_MANAGER_FLAGS_ANGULAR_VELOCITY_RELATIVE_TO_FOCAL_LENGTH',
  // Interpret attitude control on top of pointing to a location or tracking. If this flag is set, the quaternion is relative to the existing tracking angle.
  GIMBAL_MANAGER_FLAGS_NUDGE = 'GIMBAL_MANAGER_FLAGS_NUDGE',
  // Completely override pointing to a location or tracking. If this flag is set, the quaternion is (as usual) according to GIMBAL_MANAGER_FLAGS_YAW_LOCK.
  GIMBAL_MANAGER_FLAGS_OVERRIDE = 'GIMBAL_MANAGER_FLAGS_OVERRIDE',
  // This flag can be set to give up control previously set using MAV_CMD_DO_GIMBAL_MANAGER_ATTITUDE. This flag must not be combined with other flags.
  GIMBAL_MANAGER_FLAGS_NONE = 'GIMBAL_MANAGER_FLAGS_NONE',
}

/**
 * Generalized UAVCAN node health
 */
export enum UavcanNodeHealth {
  // The node is functioning properly.
  UAVCAN_NODE_HEALTH_OK = 'UAVCAN_NODE_HEALTH_OK',
  // A critical parameter went out of range or the node has encountered a minor failure.
  UAVCAN_NODE_HEALTH_WARNING = 'UAVCAN_NODE_HEALTH_WARNING',
  // The node has encountered a major failure.
  UAVCAN_NODE_HEALTH_ERROR = 'UAVCAN_NODE_HEALTH_ERROR',
  // The node has suffered a fatal malfunction.
  UAVCAN_NODE_HEALTH_CRITICAL = 'UAVCAN_NODE_HEALTH_CRITICAL',
}

/**
 * Generalized UAVCAN node mode
 */
export enum UavcanNodeMode {
  // The node is performing its primary functions.
  UAVCAN_NODE_MODE_OPERATIONAL = 'UAVCAN_NODE_MODE_OPERATIONAL',
  // The node is initializing; this mode is entered immediately after startup.
  UAVCAN_NODE_MODE_INITIALIZATION = 'UAVCAN_NODE_MODE_INITIALIZATION',
  // The node is under maintenance.
  UAVCAN_NODE_MODE_MAINTENANCE = 'UAVCAN_NODE_MODE_MAINTENANCE',
  // The node is in the process of updating its software.
  UAVCAN_NODE_MODE_SOFTWARE_UPDATE = 'UAVCAN_NODE_MODE_SOFTWARE_UPDATE',
  // The node is no longer available online.
  UAVCAN_NODE_MODE_OFFLINE = 'UAVCAN_NODE_MODE_OFFLINE',
}

/**
 * Flags to indicate the status of camera storage.
 */
export enum StorageStatus {
  // Storage is missing (no microSD card loaded for example.)
  STORAGE_STATUS_EMPTY = 'STORAGE_STATUS_EMPTY',
  // Storage present but unformatted.
  STORAGE_STATUS_UNFORMATTED = 'STORAGE_STATUS_UNFORMATTED',
  // Storage present and ready.
  STORAGE_STATUS_READY = 'STORAGE_STATUS_READY',
  // Camera does not supply storage status information. Capacity information in STORAGE_INFORMATION fields will be ignored.
  STORAGE_STATUS_NOT_SUPPORTED = 'STORAGE_STATUS_NOT_SUPPORTED',
}

/**
 * Yaw behaviour during orbit flight.
 */
export enum OrbitYawBehaviour {
  // Vehicle front points to the center (default).
  ORBIT_YAW_BEHAVIOUR_HOLD_FRONT_TO_CIRCLE_CENTER = 'ORBIT_YAW_BEHAVIOUR_HOLD_FRONT_TO_CIRCLE_CENTER',
  // Vehicle front holds heading when message received.
  ORBIT_YAW_BEHAVIOUR_HOLD_INITIAL_HEADING = 'ORBIT_YAW_BEHAVIOUR_HOLD_INITIAL_HEADING',
  // Yaw uncontrolled.
  ORBIT_YAW_BEHAVIOUR_UNCONTROLLED = 'ORBIT_YAW_BEHAVIOUR_UNCONTROLLED',
  // Vehicle front follows flight path (tangential to circle).
  ORBIT_YAW_BEHAVIOUR_HOLD_FRONT_TANGENT_TO_CIRCLE = 'ORBIT_YAW_BEHAVIOUR_HOLD_FRONT_TANGENT_TO_CIRCLE',
  // Yaw controlled by RC input.
  ORBIT_YAW_BEHAVIOUR_RC_CONTROLLED = 'ORBIT_YAW_BEHAVIOUR_RC_CONTROLLED',
}

/**
 * Possible responses from a WIFI_CONFIG_AP message.
 */
export enum WifiConfigApResponse {
  // Undefined response. Likely an indicative of a system that doesn't support this request.
  WIFI_CONFIG_AP_RESPONSE_UNDEFINED = 'WIFI_CONFIG_AP_RESPONSE_UNDEFINED',
  // Changes accepted.
  WIFI_CONFIG_AP_RESPONSE_ACCEPTED = 'WIFI_CONFIG_AP_RESPONSE_ACCEPTED',
  // Changes rejected.
  WIFI_CONFIG_AP_RESPONSE_REJECTED = 'WIFI_CONFIG_AP_RESPONSE_REJECTED',
  // Invalid Mode.
  WIFI_CONFIG_AP_RESPONSE_MODE_ERROR = 'WIFI_CONFIG_AP_RESPONSE_MODE_ERROR',
  // Invalid SSID.
  WIFI_CONFIG_AP_RESPONSE_SSID_ERROR = 'WIFI_CONFIG_AP_RESPONSE_SSID_ERROR',
  // Invalid Password.
  WIFI_CONFIG_AP_RESPONSE_PASSWORD_ERROR = 'WIFI_CONFIG_AP_RESPONSE_PASSWORD_ERROR',
}

/**
 * Possible responses from a CELLULAR_CONFIG message.
 */
export enum CellularConfigResponse {
  // Changes accepted.
  CELLULAR_CONFIG_RESPONSE_ACCEPTED = 'CELLULAR_CONFIG_RESPONSE_ACCEPTED',
  // Invalid APN.
  CELLULAR_CONFIG_RESPONSE_APN_ERROR = 'CELLULAR_CONFIG_RESPONSE_APN_ERROR',
  // Invalid PIN.
  CELLULAR_CONFIG_RESPONSE_PIN_ERROR = 'CELLULAR_CONFIG_RESPONSE_PIN_ERROR',
  // Changes rejected.
  CELLULAR_CONFIG_RESPONSE_REJECTED = 'CELLULAR_CONFIG_RESPONSE_REJECTED',
}

/**
 * WiFi Mode.
 */
export enum WifiConfigApMode {
  // WiFi mode is undefined.
  WIFI_CONFIG_AP_MODE_UNDEFINED = 'WIFI_CONFIG_AP_MODE_UNDEFINED',
  // WiFi configured as an access point.
  WIFI_CONFIG_AP_MODE_AP = 'WIFI_CONFIG_AP_MODE_AP',
  // WiFi configured as a station connected to an existing local WiFi network.
  WIFI_CONFIG_AP_MODE_STATION = 'WIFI_CONFIG_AP_MODE_STATION',
  // WiFi disabled.
  WIFI_CONFIG_AP_MODE_DISABLED = 'WIFI_CONFIG_AP_MODE_DISABLED',
}

/**
 * Possible values for COMPONENT_INFORMATION.comp_metadata_type.
 */
export enum CompMetadataType {
  // Version information which also includes information on other optional supported COMP_METADATA_TYPE's. Must be supported. Only downloadable from vehicle.
  COMP_METADATA_TYPE_VERSION = 'COMP_METADATA_TYPE_VERSION',
  // Parameter meta data.
  COMP_METADATA_TYPE_PARAMETER = 'COMP_METADATA_TYPE_PARAMETER',
}

/**
 * Commands to be executed by the MAV. They can be executed on user request, or as part of a mission script. If the action is used in a mission, the parameter mapping to the waypoint/mission message is as follows: Param 1, Param 2, Param 3, Param 4, X: Param 5, Y:Param 6, Z:Param 7. This command list is similar what ARINC 424 is for commercial aircraft: A data format how to interpret waypoint/mission data. NaN and INT32_MAX may be used in float/integer params (respectively) to indicate optional/default values (e.g. to use the component's current yaw or latitude rather than a specific value). See https://mavlink.io/en/guide/xml_schema.html#MAV_CMD for information about the structure of the MAV_CMD entries
 */
export enum MavCmd {
  // Navigate to waypoint.
  MAV_CMD_NAV_WAYPOINT = 'MAV_CMD_NAV_WAYPOINT',
  // Loiter around this waypoint an unlimited amount of time
  MAV_CMD_NAV_LOITER_UNLIM = 'MAV_CMD_NAV_LOITER_UNLIM',
  // Loiter around this waypoint for X turns
  MAV_CMD_NAV_LOITER_TURNS = 'MAV_CMD_NAV_LOITER_TURNS',
  // Loiter at the specified latitude, longitude and altitude for a certain amount of time. Multicopter vehicles stop at the point (within a vehicle-specific acceptance radius). Forward-only moving vehicles (e.g. fixed-wing) circle the point with the specified radius/direction. If the Heading Required parameter (2) is non-zero forward moving aircraft will only leave the loiter circle once heading towards the next waypoint.
  MAV_CMD_NAV_LOITER_TIME = 'MAV_CMD_NAV_LOITER_TIME',
  // Return to launch location
  MAV_CMD_NAV_RETURN_TO_LAUNCH = 'MAV_CMD_NAV_RETURN_TO_LAUNCH',
  // Land at location.
  MAV_CMD_NAV_LAND = 'MAV_CMD_NAV_LAND',
  // Takeoff from ground / hand. Vehicles that support multiple takeoff modes (e.g. VTOL quadplane) should take off using the currently configured mode.
  MAV_CMD_NAV_TAKEOFF = 'MAV_CMD_NAV_TAKEOFF',
  // Land at local position (local frame only)
  MAV_CMD_NAV_LAND_LOCAL = 'MAV_CMD_NAV_LAND_LOCAL',
  // Takeoff from local position (local frame only)
  MAV_CMD_NAV_TAKEOFF_LOCAL = 'MAV_CMD_NAV_TAKEOFF_LOCAL',
  // Vehicle following, i.e. this waypoint represents the position of a moving vehicle
  MAV_CMD_NAV_FOLLOW = 'MAV_CMD_NAV_FOLLOW',
  // Continue on the current course and climb/descend to specified altitude.  When the altitude is reached continue to the next command (i.e., don't proceed to the next command until the desired altitude is reached.
  MAV_CMD_NAV_CONTINUE_AND_CHANGE_ALT = 'MAV_CMD_NAV_CONTINUE_AND_CHANGE_ALT',
  // Begin loiter at the specified Latitude and Longitude.  If Lat=Lon=0, then loiter at the current position.  Don't consider the navigation command complete (don't leave loiter) until the altitude has been reached. Additionally, if the Heading Required parameter is non-zero the aircraft will not leave the loiter until heading toward the next waypoint.
  MAV_CMD_NAV_LOITER_TO_ALT = 'MAV_CMD_NAV_LOITER_TO_ALT',
  // Begin following a target
  MAV_CMD_DO_FOLLOW = 'MAV_CMD_DO_FOLLOW',
  // Reposition the MAV after a follow target command has been sent
  MAV_CMD_DO_FOLLOW_REPOSITION = 'MAV_CMD_DO_FOLLOW_REPOSITION',
  // Start orbiting on the circumference of a circle defined by the parameters. Setting any value NaN results in using defaults.
  MAV_CMD_DO_ORBIT = 'MAV_CMD_DO_ORBIT',
  // Sets the region of interest (ROI) for a sensor set or the vehicle itself. This can then be used by the vehicle's control system to control the vehicle attitude and the attitude of various sensors such as cameras.
  MAV_CMD_NAV_ROI = 'MAV_CMD_NAV_ROI',
  // Control autonomous path planning on the MAV.
  MAV_CMD_NAV_PATHPLANNING = 'MAV_CMD_NAV_PATHPLANNING',
  // Navigate to waypoint using a spline path.
  MAV_CMD_NAV_SPLINE_WAYPOINT = 'MAV_CMD_NAV_SPLINE_WAYPOINT',
  // Takeoff from ground using VTOL mode, and transition to forward flight with specified heading. The command should be ignored by vehicles that dont support both VTOL and fixed-wing flight (multicopters, boats,etc.).
  MAV_CMD_NAV_VTOL_TAKEOFF = 'MAV_CMD_NAV_VTOL_TAKEOFF',
  // Land using VTOL mode
  MAV_CMD_NAV_VTOL_LAND = 'MAV_CMD_NAV_VTOL_LAND',
  // hand control over to an external controller
  MAV_CMD_NAV_GUIDED_ENABLE = 'MAV_CMD_NAV_GUIDED_ENABLE',
  // Delay the next navigation command a number of seconds or until a specified time
  MAV_CMD_NAV_DELAY = 'MAV_CMD_NAV_DELAY',
  // Descend and place payload. Vehicle moves to specified location, descends until it detects a hanging payload has reached the ground, and then releases the payload. If ground is not detected before the reaching the maximum descent value (param1), the command will complete without releasing the payload.
  MAV_CMD_NAV_PAYLOAD_PLACE = 'MAV_CMD_NAV_PAYLOAD_PLACE',
  // NOP - This command is only used to mark the upper limit of the NAV/ACTION commands in the enumeration
  MAV_CMD_NAV_LAST = 'MAV_CMD_NAV_LAST',
  // Delay mission state machine.
  MAV_CMD_CONDITION_DELAY = 'MAV_CMD_CONDITION_DELAY',
  // Ascend/descend to target altitude at specified rate. Delay mission state machine until desired altitude reached.
  MAV_CMD_CONDITION_CHANGE_ALT = 'MAV_CMD_CONDITION_CHANGE_ALT',
  // Delay mission state machine until within desired distance of next NAV point.
  MAV_CMD_CONDITION_DISTANCE = 'MAV_CMD_CONDITION_DISTANCE',
  // Reach a certain target angle.
  MAV_CMD_CONDITION_YAW = 'MAV_CMD_CONDITION_YAW',
  // NOP - This command is only used to mark the upper limit of the CONDITION commands in the enumeration
  MAV_CMD_CONDITION_LAST = 'MAV_CMD_CONDITION_LAST',
  // Set system mode.
  MAV_CMD_DO_SET_MODE = 'MAV_CMD_DO_SET_MODE',
  // Jump to the desired command in the mission list.  Repeat this action only the specified number of times
  MAV_CMD_DO_JUMP = 'MAV_CMD_DO_JUMP',
  // Change speed and/or throttle set points.
  MAV_CMD_DO_CHANGE_SPEED = 'MAV_CMD_DO_CHANGE_SPEED',
  // Changes the home location either to the current location or a specified location.
  MAV_CMD_DO_SET_HOME = 'MAV_CMD_DO_SET_HOME',
  // Set a system parameter.  Caution!  Use of this command requires knowledge of the numeric enumeration value of the parameter.
  MAV_CMD_DO_SET_PARAMETER = 'MAV_CMD_DO_SET_PARAMETER',
  // Set a relay to a condition.
  MAV_CMD_DO_SET_RELAY = 'MAV_CMD_DO_SET_RELAY',
  // Cycle a relay on and off for a desired number of cycles with a desired period.
  MAV_CMD_DO_REPEAT_RELAY = 'MAV_CMD_DO_REPEAT_RELAY',
  // Set a servo to a desired PWM value.
  MAV_CMD_DO_SET_SERVO = 'MAV_CMD_DO_SET_SERVO',
  // Cycle a between its nominal setting and a desired PWM for a desired number of cycles with a desired period.
  MAV_CMD_DO_REPEAT_SERVO = 'MAV_CMD_DO_REPEAT_SERVO',
  // Terminate flight immediately
  MAV_CMD_DO_FLIGHTTERMINATION = 'MAV_CMD_DO_FLIGHTTERMINATION',
  // Change altitude set point.
  MAV_CMD_DO_CHANGE_ALTITUDE = 'MAV_CMD_DO_CHANGE_ALTITUDE',
  // Sets actuators (e.g. servos) to a desired value. The actuator numbers are mapped to specific outputs (e.g. on any MAIN or AUX PWM or UAVCAN) using a flight-stack specific mechanism (i.e. a parameter).
  MAV_CMD_DO_SET_ACTUATOR = 'MAV_CMD_DO_SET_ACTUATOR',
  // Mission command to perform a landing. This is used as a marker in a mission to tell the autopilot where a sequence of mission items that represents a landing starts. It may also be sent via a COMMAND_LONG to trigger a landing, in which case the nearest (geographically) landing sequence in the mission will be used. The Latitude/Longitude is optional, and may be set to 0 if not needed. If specified then it will be used to help find the closest landing sequence.
  MAV_CMD_DO_LAND_START = 'MAV_CMD_DO_LAND_START',
  // Mission command to perform a landing from a rally point.
  MAV_CMD_DO_RALLY_LAND = 'MAV_CMD_DO_RALLY_LAND',
  // Mission command to safely abort an autonomous landing.
  MAV_CMD_DO_GO_AROUND = 'MAV_CMD_DO_GO_AROUND',
  // Reposition the vehicle to a specific WGS84 global position.
  MAV_CMD_DO_REPOSITION = 'MAV_CMD_DO_REPOSITION',
  // If in a GPS controlled position mode, hold the current position or continue.
  MAV_CMD_DO_PAUSE_CONTINUE = 'MAV_CMD_DO_PAUSE_CONTINUE',
  // Set moving direction to forward or reverse.
  MAV_CMD_DO_SET_REVERSE = 'MAV_CMD_DO_SET_REVERSE',
  // Sets the region of interest (ROI) to a location. This can then be used by the vehicle's control system to control the vehicle attitude and the attitude of various sensors such as cameras. This command can be sent to a gimbal manager but not to a gimbal device. A gimbal is not to react to this message.
  MAV_CMD_DO_SET_ROI_LOCATION = 'MAV_CMD_DO_SET_ROI_LOCATION',
  // Sets the region of interest (ROI) to be toward next waypoint, with optional pitch/roll/yaw offset. This can then be used by the vehicle's control system to control the vehicle attitude and the attitude of various sensors such as cameras. This command can be sent to a gimbal manager but not to a gimbal device. A gimbal device is not to react to this message.
  MAV_CMD_DO_SET_ROI_WPNEXT_OFFSET = 'MAV_CMD_DO_SET_ROI_WPNEXT_OFFSET',
  // Cancels any previous ROI command returning the vehicle/sensors to default flight characteristics. This can then be used by the vehicle's control system to control the vehicle attitude and the attitude of various sensors such as cameras. This command can be sent to a gimbal manager but not to a gimbal device. A gimbal device is not to react to this message. After this command the gimbal manager should go back to manual input if available, and otherwise assume a neutral position.
  MAV_CMD_DO_SET_ROI_NONE = 'MAV_CMD_DO_SET_ROI_NONE',
  // Mount tracks system with specified system ID. Determination of target vehicle position may be done with GLOBAL_POSITION_INT or any other means. This command can be sent to a gimbal manager but not to a gimbal device. A gimbal device is not to react to this message.
  MAV_CMD_DO_SET_ROI_SYSID = 'MAV_CMD_DO_SET_ROI_SYSID',
  // Control onboard camera system.
  MAV_CMD_DO_CONTROL_VIDEO = 'MAV_CMD_DO_CONTROL_VIDEO',
  // Sets the region of interest (ROI) for a sensor set or the vehicle itself. This can then be used by the vehicle's control system to control the vehicle attitude and the attitude of various sensors such as cameras.
  MAV_CMD_DO_SET_ROI = 'MAV_CMD_DO_SET_ROI',
  // Configure digital camera. This is a fallback message for systems that have not yet implemented PARAM_EXT_XXX messages and camera definition files (see https://mavlink.io/en/services/camera_def.html ).
  MAV_CMD_DO_DIGICAM_CONFIGURE = 'MAV_CMD_DO_DIGICAM_CONFIGURE',
  // Control digital camera. This is a fallback message for systems that have not yet implemented PARAM_EXT_XXX messages and camera definition files (see https://mavlink.io/en/services/camera_def.html ).
  MAV_CMD_DO_DIGICAM_CONTROL = 'MAV_CMD_DO_DIGICAM_CONTROL',
  // Mission command to configure a camera or antenna mount
  MAV_CMD_DO_MOUNT_CONFIGURE = 'MAV_CMD_DO_MOUNT_CONFIGURE',
  // Mission command to control a camera or antenna mount
  MAV_CMD_DO_MOUNT_CONTROL = 'MAV_CMD_DO_MOUNT_CONTROL',
  // Mission command to set camera trigger distance for this flight. The camera is triggered each time this distance is exceeded. This command can also be used to set the shutter integration time for the camera.
  MAV_CMD_DO_SET_CAM_TRIGG_DIST = 'MAV_CMD_DO_SET_CAM_TRIGG_DIST',
  // Mission command to enable the geofence
  MAV_CMD_DO_FENCE_ENABLE = 'MAV_CMD_DO_FENCE_ENABLE',
  // Mission item/command to release a parachute or enable/disable auto release.
  MAV_CMD_DO_PARACHUTE = 'MAV_CMD_DO_PARACHUTE',
  // Mission command to perform motor test.
  MAV_CMD_DO_MOTOR_TEST = 'MAV_CMD_DO_MOTOR_TEST',
  // Change to/from inverted flight.
  MAV_CMD_DO_INVERTED_FLIGHT = 'MAV_CMD_DO_INVERTED_FLIGHT',
  // Sets a desired vehicle turn angle and speed change.
  MAV_CMD_NAV_SET_YAW_SPEED = 'MAV_CMD_NAV_SET_YAW_SPEED',
  // Mission command to set camera trigger interval for this flight. If triggering is enabled, the camera is triggered each time this interval expires. This command can also be used to set the shutter integration time for the camera.
  MAV_CMD_DO_SET_CAM_TRIGG_INTERVAL = 'MAV_CMD_DO_SET_CAM_TRIGG_INTERVAL',
  // Mission command to control a camera or antenna mount, using a quaternion as reference.
  MAV_CMD_DO_MOUNT_CONTROL_QUAT = 'MAV_CMD_DO_MOUNT_CONTROL_QUAT',
  // set id of master controller
  MAV_CMD_DO_GUIDED_MASTER = 'MAV_CMD_DO_GUIDED_MASTER',
  // Set limits for external control
  MAV_CMD_DO_GUIDED_LIMITS = 'MAV_CMD_DO_GUIDED_LIMITS',
  // Control vehicle engine. This is interpreted by the vehicles engine controller to change the target engine state. It is intended for vehicles with internal combustion engines
  MAV_CMD_DO_ENGINE_CONTROL = 'MAV_CMD_DO_ENGINE_CONTROL',
  // Set the mission item with sequence number seq as current item. This means that the MAV will continue to this mission item on the shortest path (not following the mission items in-between).
  MAV_CMD_DO_SET_MISSION_CURRENT = 'MAV_CMD_DO_SET_MISSION_CURRENT',
  // NOP - This command is only used to mark the upper limit of the DO commands in the enumeration
  MAV_CMD_DO_LAST = 'MAV_CMD_DO_LAST',
  // Trigger calibration. This command will be only accepted if in pre-flight mode. Except for Temperature Calibration, only one sensor should be set in a single message and all others should be zero.
  MAV_CMD_PREFLIGHT_CALIBRATION = 'MAV_CMD_PREFLIGHT_CALIBRATION',
  // Set sensor offsets. This command will be only accepted if in pre-flight mode.
  MAV_CMD_PREFLIGHT_SET_SENSOR_OFFSETS = 'MAV_CMD_PREFLIGHT_SET_SENSOR_OFFSETS',
  // Trigger UAVCAN config. This command will be only accepted if in pre-flight mode.
  MAV_CMD_PREFLIGHT_UAVCAN = 'MAV_CMD_PREFLIGHT_UAVCAN',
  // Request storage of different parameter values and logs. This command will be only accepted if in pre-flight mode.
  MAV_CMD_PREFLIGHT_STORAGE = 'MAV_CMD_PREFLIGHT_STORAGE',
  // Request the reboot or shutdown of system components.
  MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN = 'MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN',
  // Request a target system to start an upgrade of one (or all) of its components. For example, the command might be sent to a companion computer to cause it to upgrade a connected flight controller. The system doing the upgrade will report progress using the normal command protocol sequence for a long running operation. Command protocol information: https://mavlink.io/en/services/command.html.
  MAV_CMD_DO_UPGRADE = 'MAV_CMD_DO_UPGRADE',
  // Override current mission with command to pause mission, pause mission and move to position, continue/resume mission. When param 1 indicates that the mission is paused (MAV_GOTO_DO_HOLD), param 2 defines whether it holds in place or moves to another position.
  MAV_CMD_OVERRIDE_GOTO = 'MAV_CMD_OVERRIDE_GOTO',
  // start running a mission
  MAV_CMD_MISSION_START = 'MAV_CMD_MISSION_START',
  // Arms / Disarms a component
  MAV_CMD_COMPONENT_ARM_DISARM = 'MAV_CMD_COMPONENT_ARM_DISARM',
  // Turns illuminators ON/OFF. An illuminator is a light source that is used for lighting up dark areas external to the sytstem: e.g. a torch or searchlight (as opposed to a light source for illuminating the system itself, e.g. an indicator light).
  MAV_CMD_ILLUMINATOR_ON_OFF = 'MAV_CMD_ILLUMINATOR_ON_OFF',
  // Request the home position from the vehicle.
  MAV_CMD_GET_HOME_POSITION = 'MAV_CMD_GET_HOME_POSITION',
  // Inject artificial failure for testing purposes. Note that autopilots should implement an additional protection before accepting this command such as a specific param setting.
  MAV_CMD_INJECT_FAILURE = 'MAV_CMD_INJECT_FAILURE',
  // Starts receiver pairing.
  MAV_CMD_START_RX_PAIR = 'MAV_CMD_START_RX_PAIR',
  // Request the interval between messages for a particular MAVLink message ID. The receiver should ACK the command and then emit its response in a MESSAGE_INTERVAL message.
  MAV_CMD_GET_MESSAGE_INTERVAL = 'MAV_CMD_GET_MESSAGE_INTERVAL',
  // Set the interval between messages for a particular MAVLink message ID. This interface replaces REQUEST_DATA_STREAM.
  MAV_CMD_SET_MESSAGE_INTERVAL = 'MAV_CMD_SET_MESSAGE_INTERVAL',
  // Request the target system(s) emit a single instance of a specified message (i.e. a "one-shot" version of MAV_CMD_SET_MESSAGE_INTERVAL).
  MAV_CMD_REQUEST_MESSAGE = 'MAV_CMD_REQUEST_MESSAGE',
  // Request MAVLink protocol version compatibility. All receivers should ACK the command and then emit their capabilities in an PROTOCOL_VERSION message
  MAV_CMD_REQUEST_PROTOCOL_VERSION = 'MAV_CMD_REQUEST_PROTOCOL_VERSION',
  // Request autopilot capabilities. The receiver should ACK the command and then emit its capabilities in an AUTOPILOT_VERSION message
  MAV_CMD_REQUEST_AUTOPILOT_CAPABILITIES = 'MAV_CMD_REQUEST_AUTOPILOT_CAPABILITIES',
  // Request camera information (CAMERA_INFORMATION).
  MAV_CMD_REQUEST_CAMERA_INFORMATION = 'MAV_CMD_REQUEST_CAMERA_INFORMATION',
  // Request camera settings (CAMERA_SETTINGS).
  MAV_CMD_REQUEST_CAMERA_SETTINGS = 'MAV_CMD_REQUEST_CAMERA_SETTINGS',
  // Request storage information (STORAGE_INFORMATION). Use the command's target_component to target a specific component's storage.
  MAV_CMD_REQUEST_STORAGE_INFORMATION = 'MAV_CMD_REQUEST_STORAGE_INFORMATION',
  // Format a storage medium. Once format is complete, a STORAGE_INFORMATION message is sent. Use the command's target_component to target a specific component's storage.
  MAV_CMD_STORAGE_FORMAT = 'MAV_CMD_STORAGE_FORMAT',
  // Request camera capture status (CAMERA_CAPTURE_STATUS)
  MAV_CMD_REQUEST_CAMERA_CAPTURE_STATUS = 'MAV_CMD_REQUEST_CAMERA_CAPTURE_STATUS',
  // Request flight information (FLIGHT_INFORMATION)
  MAV_CMD_REQUEST_FLIGHT_INFORMATION = 'MAV_CMD_REQUEST_FLIGHT_INFORMATION',
  // Reset all camera settings to Factory Default
  MAV_CMD_RESET_CAMERA_SETTINGS = 'MAV_CMD_RESET_CAMERA_SETTINGS',
  // Set camera running mode. Use NaN for reserved values. GCS will send a MAV_CMD_REQUEST_VIDEO_STREAM_STATUS command after a mode change if the camera supports video streaming.
  MAV_CMD_SET_CAMERA_MODE = 'MAV_CMD_SET_CAMERA_MODE',
  // Set camera zoom. Camera must respond with a CAMERA_SETTINGS message (on success).
  MAV_CMD_SET_CAMERA_ZOOM = 'MAV_CMD_SET_CAMERA_ZOOM',
  // Set camera focus. Camera must respond with a CAMERA_SETTINGS message (on success).
  MAV_CMD_SET_CAMERA_FOCUS = 'MAV_CMD_SET_CAMERA_FOCUS',
  // Tagged jump target. Can be jumped to with MAV_CMD_DO_JUMP_TAG.
  MAV_CMD_JUMP_TAG = 'MAV_CMD_JUMP_TAG',
  // Jump to the matching tag in the mission list. Repeat this action for the specified number of times. A mission should contain a single matching tag for each jump. If this is not the case then a jump to a missing tag should complete the mission, and a jump where there are multiple matching tags should always select the one with the lowest mission sequence number.
  MAV_CMD_DO_JUMP_TAG = 'MAV_CMD_DO_JUMP_TAG',
  // High level setpoint to be sent to a gimbal manager to set a gimbal attitude. It is possible to set combinations of the values below. E.g. an angle as well as a desired angular rate can be used to get to this angle at a certain angular rate, or an angular rate only will result in continuous turning. NaN is to be used to signal unset. Note: a gimbal is never to react to this command but only the gimbal manager.
  MAV_CMD_DO_GIMBAL_MANAGER_TILTPAN = 'MAV_CMD_DO_GIMBAL_MANAGER_TILTPAN',
  // If the gimbal manager supports visual tracking (GIMBAL_MANAGER_CAP_FLAGS_HAS_TRACKING_POINT is set), this command allows to initiate the tracking. Such a tracking gimbal manager would usually be an integrated camera/gimbal, or alternatively a companion computer connected to a camera.
  MAV_CMD_DO_GIMBAL_MANAGER_TRACK_POINT = 'MAV_CMD_DO_GIMBAL_MANAGER_TRACK_POINT',
  // If the gimbal supports visual tracking (GIMBAL_MANAGER_CAP_FLAGS_HAS_TRACKING_RECTANGLE is set), this command allows to initiate the tracking. Such a tracking gimbal manager would usually be an integrated camera/gimbal, or alternatively a companion computer connected to a camera.
  MAV_CMD_DO_GIMBAL_MANAGER_TRACK_RECTANGLE = 'MAV_CMD_DO_GIMBAL_MANAGER_TRACK_RECTANGLE',
  // Start image capture sequence. Sends CAMERA_IMAGE_CAPTURED after each capture. Use NaN for reserved values.
  MAV_CMD_IMAGE_START_CAPTURE = 'MAV_CMD_IMAGE_START_CAPTURE',
  // Stop image capture sequence Use NaN for reserved values.
  MAV_CMD_IMAGE_STOP_CAPTURE = 'MAV_CMD_IMAGE_STOP_CAPTURE',
  // Re-request a CAMERA_IMAGE_CAPTURED message.
  MAV_CMD_REQUEST_CAMERA_IMAGE_CAPTURE = 'MAV_CMD_REQUEST_CAMERA_IMAGE_CAPTURE',
  // Enable or disable on-board camera triggering system.
  MAV_CMD_DO_TRIGGER_CONTROL = 'MAV_CMD_DO_TRIGGER_CONTROL',
  // Starts video capture (recording).
  MAV_CMD_VIDEO_START_CAPTURE = 'MAV_CMD_VIDEO_START_CAPTURE',
  // Stop the current video capture (recording).
  MAV_CMD_VIDEO_STOP_CAPTURE = 'MAV_CMD_VIDEO_STOP_CAPTURE',
  // Start video streaming
  MAV_CMD_VIDEO_START_STREAMING = 'MAV_CMD_VIDEO_START_STREAMING',
  // Stop the given video stream
  MAV_CMD_VIDEO_STOP_STREAMING = 'MAV_CMD_VIDEO_STOP_STREAMING',
  // Request video stream information (VIDEO_STREAM_INFORMATION)
  MAV_CMD_REQUEST_VIDEO_STREAM_INFORMATION = 'MAV_CMD_REQUEST_VIDEO_STREAM_INFORMATION',
  // Request video stream status (VIDEO_STREAM_STATUS)
  MAV_CMD_REQUEST_VIDEO_STREAM_STATUS = 'MAV_CMD_REQUEST_VIDEO_STREAM_STATUS',
  // Request to start streaming logging data over MAVLink (see also LOGGING_DATA message)
  MAV_CMD_LOGGING_START = 'MAV_CMD_LOGGING_START',
  // Request to stop streaming log data over MAVLink
  MAV_CMD_LOGGING_STOP = 'MAV_CMD_LOGGING_STOP',
  MAV_CMD_AIRFRAME_CONFIGURATION = 'MAV_CMD_AIRFRAME_CONFIGURATION',
  // Request to start/stop transmitting over the high latency telemetry
  MAV_CMD_CONTROL_HIGH_LATENCY = 'MAV_CMD_CONTROL_HIGH_LATENCY',
  // Create a panorama at the current position
  MAV_CMD_PANORAMA_CREATE = 'MAV_CMD_PANORAMA_CREATE',
  // Request VTOL transition
  MAV_CMD_DO_VTOL_TRANSITION = 'MAV_CMD_DO_VTOL_TRANSITION',
  // Request authorization to arm the vehicle to a external entity, the arm authorizer is responsible to request all data that is needs from the vehicle before authorize or deny the request. If approved the progress of command_ack message should be set with period of time that this authorization is valid in seconds or in case it was denied it should be set with one of the reasons in ARM_AUTH_DENIED_REASON.
  MAV_CMD_ARM_AUTHORIZATION_REQUEST = 'MAV_CMD_ARM_AUTHORIZATION_REQUEST',
  // This command sets the submode to standard guided when vehicle is in guided mode. The vehicle holds position and altitude and the user can input the desired velocities along all three axes.
  MAV_CMD_SET_GUIDED_SUBMODE_STANDARD = 'MAV_CMD_SET_GUIDED_SUBMODE_STANDARD',
  // This command sets submode circle when vehicle is in guided mode. Vehicle flies along a circle facing the center of the circle. The user can input the velocity along the circle and change the radius. If no input is given the vehicle will hold position.
  MAV_CMD_SET_GUIDED_SUBMODE_CIRCLE = 'MAV_CMD_SET_GUIDED_SUBMODE_CIRCLE',
  // Delay mission state machine until gate has been reached.
  MAV_CMD_CONDITION_GATE = 'MAV_CMD_CONDITION_GATE',
  // Fence return point. There can only be one fence return point.
  MAV_CMD_NAV_FENCE_RETURN_POINT = 'MAV_CMD_NAV_FENCE_RETURN_POINT',
  // Fence vertex for an inclusion polygon (the polygon must not be self-intersecting). The vehicle must stay within this area. Minimum of 3 vertices required.
  MAV_CMD_NAV_FENCE_POLYGON_VERTEX_INCLUSION = 'MAV_CMD_NAV_FENCE_POLYGON_VERTEX_INCLUSION',
  // Fence vertex for an exclusion polygon (the polygon must not be self-intersecting). The vehicle must stay outside this area. Minimum of 3 vertices required.
  MAV_CMD_NAV_FENCE_POLYGON_VERTEX_EXCLUSION = 'MAV_CMD_NAV_FENCE_POLYGON_VERTEX_EXCLUSION',
  // Circular fence area. The vehicle must stay inside this area.
  MAV_CMD_NAV_FENCE_CIRCLE_INCLUSION = 'MAV_CMD_NAV_FENCE_CIRCLE_INCLUSION',
  // Circular fence area. The vehicle must stay outside this area.
  MAV_CMD_NAV_FENCE_CIRCLE_EXCLUSION = 'MAV_CMD_NAV_FENCE_CIRCLE_EXCLUSION',
  // Rally point. You can have multiple rally points defined.
  MAV_CMD_NAV_RALLY_POINT = 'MAV_CMD_NAV_RALLY_POINT',
  // Commands the vehicle to respond with a sequence of messages UAVCAN_NODE_INFO, one message per every UAVCAN node that is online. Note that some of the response messages can be lost, which the receiver can detect easily by checking whether every received UAVCAN_NODE_STATUS has a matching message UAVCAN_NODE_INFO received earlier; if not, this command should be sent again in order to request re-transmission of the node information messages.
  MAV_CMD_UAVCAN_GET_NODE_INFO = 'MAV_CMD_UAVCAN_GET_NODE_INFO',
  // Deploy payload on a Lat / Lon / Alt position. This includes the navigation to reach the required release position and velocity.
  MAV_CMD_PAYLOAD_PREPARE_DEPLOY = 'MAV_CMD_PAYLOAD_PREPARE_DEPLOY',
  // Control the payload deployment.
  MAV_CMD_PAYLOAD_CONTROL_DEPLOY = 'MAV_CMD_PAYLOAD_CONTROL_DEPLOY',
  // User defined waypoint item. Ground Station will show the Vehicle as flying through this item.
  MAV_CMD_WAYPOINT_USER_1 = 'MAV_CMD_WAYPOINT_USER_1',
  // User defined waypoint item. Ground Station will show the Vehicle as flying through this item.
  MAV_CMD_WAYPOINT_USER_2 = 'MAV_CMD_WAYPOINT_USER_2',
  // User defined waypoint item. Ground Station will show the Vehicle as flying through this item.
  MAV_CMD_WAYPOINT_USER_3 = 'MAV_CMD_WAYPOINT_USER_3',
  // User defined waypoint item. Ground Station will show the Vehicle as flying through this item.
  MAV_CMD_WAYPOINT_USER_4 = 'MAV_CMD_WAYPOINT_USER_4',
  // User defined waypoint item. Ground Station will show the Vehicle as flying through this item.
  MAV_CMD_WAYPOINT_USER_5 = 'MAV_CMD_WAYPOINT_USER_5',
  // User defined spatial item. Ground Station will not show the Vehicle as flying through this item. Example: ROI item.
  MAV_CMD_SPATIAL_USER_1 = 'MAV_CMD_SPATIAL_USER_1',
  // User defined spatial item. Ground Station will not show the Vehicle as flying through this item. Example: ROI item.
  MAV_CMD_SPATIAL_USER_2 = 'MAV_CMD_SPATIAL_USER_2',
  // User defined spatial item. Ground Station will not show the Vehicle as flying through this item. Example: ROI item.
  MAV_CMD_SPATIAL_USER_3 = 'MAV_CMD_SPATIAL_USER_3',
  // User defined spatial item. Ground Station will not show the Vehicle as flying through this item. Example: ROI item.
  MAV_CMD_SPATIAL_USER_4 = 'MAV_CMD_SPATIAL_USER_4',
  // User defined spatial item. Ground Station will not show the Vehicle as flying through this item. Example: ROI item.
  MAV_CMD_SPATIAL_USER_5 = 'MAV_CMD_SPATIAL_USER_5',
  // User defined command. Ground Station will not show the Vehicle as flying through this item. Example: MAV_CMD_DO_SET_PARAMETER item.
  MAV_CMD_USER_1 = 'MAV_CMD_USER_1',
  // User defined command. Ground Station will not show the Vehicle as flying through this item. Example: MAV_CMD_DO_SET_PARAMETER item.
  MAV_CMD_USER_2 = 'MAV_CMD_USER_2',
  // User defined command. Ground Station will not show the Vehicle as flying through this item. Example: MAV_CMD_DO_SET_PARAMETER item.
  MAV_CMD_USER_3 = 'MAV_CMD_USER_3',
  // User defined command. Ground Station will not show the Vehicle as flying through this item. Example: MAV_CMD_DO_SET_PARAMETER item.
  MAV_CMD_USER_4 = 'MAV_CMD_USER_4',
  // User defined command. Ground Station will not show the Vehicle as flying through this item. Example: MAV_CMD_DO_SET_PARAMETER item.
  MAV_CMD_USER_5 = 'MAV_CMD_USER_5',
  // From ArduPilotMega
  // Mission command to operate EPM gripper.
  MAV_CMD_DO_GRIPPER = 'MAV_CMD_DO_GRIPPER',
  // Enable/disable autotune.
  MAV_CMD_DO_AUTOTUNE_ENABLE = 'MAV_CMD_DO_AUTOTUNE_ENABLE',
  // Set the distance to be repeated on mission resume
  MAV_CMD_DO_SET_RESUME_REPEAT_DIST = 'MAV_CMD_DO_SET_RESUME_REPEAT_DIST',
  // Mission command to wait for an altitude or downwards vertical speed. This is meant for high altitude balloon launches, allowing the aircraft to be idle until either an altitude is reached or a negative vertical speed is reached (indicating early balloon burst). The wiggle time is how often to wiggle the control surfaces to prevent them seizing up.
  MAV_CMD_NAV_ALTITUDE_WAIT = 'MAV_CMD_NAV_ALTITUDE_WAIT',
  // A system wide power-off event has been initiated.
  MAV_CMD_POWER_OFF_INITIATED = 'MAV_CMD_POWER_OFF_INITIATED',
  // FLY button has been clicked.
  MAV_CMD_SOLO_BTN_FLY_CLICK = 'MAV_CMD_SOLO_BTN_FLY_CLICK',
  // FLY button has been held for 1.5 seconds.
  MAV_CMD_SOLO_BTN_FLY_HOLD = 'MAV_CMD_SOLO_BTN_FLY_HOLD',
  // PAUSE button has been clicked.
  MAV_CMD_SOLO_BTN_PAUSE_CLICK = 'MAV_CMD_SOLO_BTN_PAUSE_CLICK',
  // Magnetometer calibration based on fixed position         in earth field given by inclination, declination and intensity.
  MAV_CMD_FIXED_MAG_CAL = 'MAV_CMD_FIXED_MAG_CAL',
  // Magnetometer calibration based on fixed expected field values in milliGauss.
  MAV_CMD_FIXED_MAG_CAL_FIELD = 'MAV_CMD_FIXED_MAG_CAL_FIELD',
  // Magnetometer calibration based on provided known yaw. This allows for fast calibration using WMM field tables in the vehicle, given only the known yaw of the vehicle. If Latitude and longitude are both zero then use the current vehicle location.
  MAV_CMD_FIXED_MAG_CAL_YAW = 'MAV_CMD_FIXED_MAG_CAL_YAW',
  // Initiate a magnetometer calibration.
  MAV_CMD_DO_START_MAG_CAL = 'MAV_CMD_DO_START_MAG_CAL',
  // Initiate a magnetometer calibration.
  MAV_CMD_DO_ACCEPT_MAG_CAL = 'MAV_CMD_DO_ACCEPT_MAG_CAL',
  // Cancel a running magnetometer calibration.
  MAV_CMD_DO_CANCEL_MAG_CAL = 'MAV_CMD_DO_CANCEL_MAG_CAL',
  // Used when doing accelerometer calibration. When sent to the GCS tells it what position to put the vehicle in. When sent to the vehicle says what position the vehicle is in.
  MAV_CMD_ACCELCAL_VEHICLE_POS = 'MAV_CMD_ACCELCAL_VEHICLE_POS',
  // Reply with the version banner.
  MAV_CMD_DO_SEND_BANNER = 'MAV_CMD_DO_SEND_BANNER',
  // Command autopilot to get into factory test/diagnostic mode.
  MAV_CMD_SET_FACTORY_TEST_MODE = 'MAV_CMD_SET_FACTORY_TEST_MODE',
  // Causes the gimbal to reset and boot as if it was just powered on.
  MAV_CMD_GIMBAL_RESET = 'MAV_CMD_GIMBAL_RESET',
  // Reports progress and success or failure of gimbal axis calibration procedure.
  MAV_CMD_GIMBAL_AXIS_CALIBRATION_STATUS = 'MAV_CMD_GIMBAL_AXIS_CALIBRATION_STATUS',
  // Starts commutation calibration on the gimbal.
  MAV_CMD_GIMBAL_REQUEST_AXIS_CALIBRATION = 'MAV_CMD_GIMBAL_REQUEST_AXIS_CALIBRATION',
  // Erases gimbal application and parameters.
  MAV_CMD_GIMBAL_FULL_RESET = 'MAV_CMD_GIMBAL_FULL_RESET',
  // Command to operate winch.
  MAV_CMD_DO_WINCH = 'MAV_CMD_DO_WINCH',
  // Update the bootloader
  MAV_CMD_FLASH_BOOTLOADER = 'MAV_CMD_FLASH_BOOTLOADER',
  // Reset battery capacity for batteries that accumulate consumed battery via integration.
  MAV_CMD_BATTERY_RESET = 'MAV_CMD_BATTERY_RESET',
  // Issue a trap signal to the autopilot process, presumably to enter the debugger.
  MAV_CMD_DEBUG_TRAP = 'MAV_CMD_DEBUG_TRAP',
  // Control onboard scripting.
  MAV_CMD_SCRIPTING = 'MAV_CMD_SCRIPTING',
}

/**
 *
 */
export enum MavDataStream {
  // Enable all data streams
  MAV_DATA_STREAM_ALL = 'MAV_DATA_STREAM_ALL',
  // Enable IMU_RAW, GPS_RAW, GPS_STATUS packets.
  MAV_DATA_STREAM_RAW_SENSORS = 'MAV_DATA_STREAM_RAW_SENSORS',
  // Enable GPS_STATUS, CONTROL_STATUS, AUX_STATUS
  MAV_DATA_STREAM_EXTENDED_STATUS = 'MAV_DATA_STREAM_EXTENDED_STATUS',
  // Enable RC_CHANNELS_SCALED, RC_CHANNELS_RAW, SERVO_OUTPUT_RAW
  MAV_DATA_STREAM_RC_CHANNELS = 'MAV_DATA_STREAM_RC_CHANNELS',
  // Enable ATTITUDE_CONTROLLER_OUTPUT, POSITION_CONTROLLER_OUTPUT, NAV_CONTROLLER_OUTPUT.
  MAV_DATA_STREAM_RAW_CONTROLLER = 'MAV_DATA_STREAM_RAW_CONTROLLER',
  // Enable LOCAL_POSITION, GLOBAL_POSITION/GLOBAL_POSITION_INT messages.
  MAV_DATA_STREAM_POSITION = 'MAV_DATA_STREAM_POSITION',
  // Dependent on the autopilot
  MAV_DATA_STREAM_EXTRA1 = 'MAV_DATA_STREAM_EXTRA1',
  // Dependent on the autopilot
  MAV_DATA_STREAM_EXTRA2 = 'MAV_DATA_STREAM_EXTRA2',
  // Dependent on the autopilot
  MAV_DATA_STREAM_EXTRA3 = 'MAV_DATA_STREAM_EXTRA3',
}

/**
 * A data stream is not a fixed set of messages, but rather a      recommendation to the autopilot software. Individual autopilots may or may not obey      the recommended messages.
 */
export enum MavRoi {
  // No region of interest.
  MAV_ROI_NONE = 'MAV_ROI_NONE',
  // Point toward next waypoint, with optional pitch/roll/yaw offset.
  MAV_ROI_WPNEXT = 'MAV_ROI_WPNEXT',
  // Point toward given waypoint.
  MAV_ROI_WPINDEX = 'MAV_ROI_WPINDEX',
  // Point toward fixed location.
  MAV_ROI_LOCATION = 'MAV_ROI_LOCATION',
  // Point toward of given id.
  MAV_ROI_TARGET = 'MAV_ROI_TARGET',
}

/**
 * ACK / NACK / ERROR values as a result of MAV_CMDs and for mission item transmission.
 */
export enum MavCmdAck {
  // Command / mission item is ok.
  MAV_CMD_ACK_OK = 'MAV_CMD_ACK_OK',
  // Generic error message if none of the other reasons fails or if no detailed error reporting is implemented.
  MAV_CMD_ACK_ERR_FAIL = 'MAV_CMD_ACK_ERR_FAIL',
  // The system is refusing to accept this command from this source / communication partner.
  MAV_CMD_ACK_ERR_ACCESS_DENIED = 'MAV_CMD_ACK_ERR_ACCESS_DENIED',
  // Command or mission item is not supported, other commands would be accepted.
  MAV_CMD_ACK_ERR_NOT_SUPPORTED = 'MAV_CMD_ACK_ERR_NOT_SUPPORTED',
  // The coordinate frame of this command / mission item is not supported.
  MAV_CMD_ACK_ERR_COORDINATE_FRAME_NOT_SUPPORTED = 'MAV_CMD_ACK_ERR_COORDINATE_FRAME_NOT_SUPPORTED',
  // The coordinate frame of this command is ok, but he coordinate values exceed the safety limits of this system. This is a generic error, please use the more specific error messages below if possible.
  MAV_CMD_ACK_ERR_COORDINATES_OUT_OF_RANGE = 'MAV_CMD_ACK_ERR_COORDINATES_OUT_OF_RANGE',
  // The X or latitude value is out of range.
  MAV_CMD_ACK_ERR_X_LAT_OUT_OF_RANGE = 'MAV_CMD_ACK_ERR_X_LAT_OUT_OF_RANGE',
  // The Y or longitude value is out of range.
  MAV_CMD_ACK_ERR_Y_LON_OUT_OF_RANGE = 'MAV_CMD_ACK_ERR_Y_LON_OUT_OF_RANGE',
  // The Z or altitude value is out of range.
  MAV_CMD_ACK_ERR_Z_ALT_OUT_OF_RANGE = 'MAV_CMD_ACK_ERR_Z_ALT_OUT_OF_RANGE',
}

/**
 * Specifies the datatype of a MAVLink parameter.
 */
export enum MavParamType {
  // 8-bit unsigned integer
  MAV_PARAM_TYPE_UINT8 = 'MAV_PARAM_TYPE_UINT8',
  // 8-bit signed integer
  MAV_PARAM_TYPE_INT8 = 'MAV_PARAM_TYPE_INT8',
  // 16-bit unsigned integer
  MAV_PARAM_TYPE_UINT16 = 'MAV_PARAM_TYPE_UINT16',
  // 16-bit signed integer
  MAV_PARAM_TYPE_INT16 = 'MAV_PARAM_TYPE_INT16',
  // 32-bit unsigned integer
  MAV_PARAM_TYPE_UINT32 = 'MAV_PARAM_TYPE_UINT32',
  // 32-bit signed integer
  MAV_PARAM_TYPE_INT32 = 'MAV_PARAM_TYPE_INT32',
  // 64-bit unsigned integer
  MAV_PARAM_TYPE_UINT64 = 'MAV_PARAM_TYPE_UINT64',
  // 64-bit signed integer
  MAV_PARAM_TYPE_INT64 = 'MAV_PARAM_TYPE_INT64',
  // 32-bit floating-point
  MAV_PARAM_TYPE_REAL32 = 'MAV_PARAM_TYPE_REAL32',
  // 64-bit floating-point
  MAV_PARAM_TYPE_REAL64 = 'MAV_PARAM_TYPE_REAL64',
}

/**
 * Specifies the datatype of a MAVLink extended parameter.
 */
export enum MavParamExtType {
  // 8-bit unsigned integer
  MAV_PARAM_EXT_TYPE_UINT8 = 'MAV_PARAM_EXT_TYPE_UINT8',
  // 8-bit signed integer
  MAV_PARAM_EXT_TYPE_INT8 = 'MAV_PARAM_EXT_TYPE_INT8',
  // 16-bit unsigned integer
  MAV_PARAM_EXT_TYPE_UINT16 = 'MAV_PARAM_EXT_TYPE_UINT16',
  // 16-bit signed integer
  MAV_PARAM_EXT_TYPE_INT16 = 'MAV_PARAM_EXT_TYPE_INT16',
  // 32-bit unsigned integer
  MAV_PARAM_EXT_TYPE_UINT32 = 'MAV_PARAM_EXT_TYPE_UINT32',
  // 32-bit signed integer
  MAV_PARAM_EXT_TYPE_INT32 = 'MAV_PARAM_EXT_TYPE_INT32',
  // 64-bit unsigned integer
  MAV_PARAM_EXT_TYPE_UINT64 = 'MAV_PARAM_EXT_TYPE_UINT64',
  // 64-bit signed integer
  MAV_PARAM_EXT_TYPE_INT64 = 'MAV_PARAM_EXT_TYPE_INT64',
  // 32-bit floating-point
  MAV_PARAM_EXT_TYPE_REAL32 = 'MAV_PARAM_EXT_TYPE_REAL32',
  // 64-bit floating-point
  MAV_PARAM_EXT_TYPE_REAL64 = 'MAV_PARAM_EXT_TYPE_REAL64',
  // Custom Type
  MAV_PARAM_EXT_TYPE_CUSTOM = 'MAV_PARAM_EXT_TYPE_CUSTOM',
}

/**
 * Result from a MAVLink command (MAV_CMD)
 */
export enum MavResult {
  // Command is valid (is supported and has valid parameters), and was executed.
  MAV_RESULT_ACCEPTED = 'MAV_RESULT_ACCEPTED',
  // Command is valid, but cannot be executed at this time. This is used to indicate a problem that should be fixed just by waiting (e.g. a state machine is busy, can't arm because have not got GPS lock, etc.). Retrying later should work.
  MAV_RESULT_TEMPORARILY_REJECTED = 'MAV_RESULT_TEMPORARILY_REJECTED',
  // Command is invalid (is supported but has invalid parameters). Retrying same command and parameters will not work.
  MAV_RESULT_DENIED = 'MAV_RESULT_DENIED',
  // Command is not supported (unknown).
  MAV_RESULT_UNSUPPORTED = 'MAV_RESULT_UNSUPPORTED',
  // Command is valid, but execution has failed. This is used to indicate any non-temporary or unexpected problem, i.e. any problem that must be fixed before the command can succeed/be retried. For example, attempting to write a file when out of memory, attempting to arm when sensors are not calibrated, etc.
  MAV_RESULT_FAILED = 'MAV_RESULT_FAILED',
  // Command is valid and is being executed. This will be followed by further progress updates, i.e. the component may send further COMMAND_ACK messages with result MAV_RESULT_IN_PROGRESS (at a rate decided by the implementation), and must terminate by sending a COMMAND_ACK message with final result of the operation. The COMMAND_ACK.progress field can be used to indicate the progress of the operation.
  MAV_RESULT_IN_PROGRESS = 'MAV_RESULT_IN_PROGRESS',
  // Command has been cancelled (as a result of receiving a COMMAND_CANCEL message).
  MAV_RESULT_CANCELLED = 'MAV_RESULT_CANCELLED',
}

/**
 * Result of mission operation (in a MISSION_ACK message).
 */
export enum MavMissionResult {
  // mission accepted OK
  MAV_MISSION_ACCEPTED = 'MAV_MISSION_ACCEPTED',
  // Generic error / not accepting mission commands at all right now.
  MAV_MISSION_ERROR = 'MAV_MISSION_ERROR',
  // Coordinate frame is not supported.
  MAV_MISSION_UNSUPPORTED_FRAME = 'MAV_MISSION_UNSUPPORTED_FRAME',
  // Command is not supported.
  MAV_MISSION_UNSUPPORTED = 'MAV_MISSION_UNSUPPORTED',
  // Mission items exceed storage space.
  MAV_MISSION_NO_SPACE = 'MAV_MISSION_NO_SPACE',
  // One of the parameters has an invalid value.
  MAV_MISSION_INVALID = 'MAV_MISSION_INVALID',
  // param1 has an invalid value.
  MAV_MISSION_INVALID_PARAM1 = 'MAV_MISSION_INVALID_PARAM1',
  // param2 has an invalid value.
  MAV_MISSION_INVALID_PARAM2 = 'MAV_MISSION_INVALID_PARAM2',
  // param3 has an invalid value.
  MAV_MISSION_INVALID_PARAM3 = 'MAV_MISSION_INVALID_PARAM3',
  // param4 has an invalid value.
  MAV_MISSION_INVALID_PARAM4 = 'MAV_MISSION_INVALID_PARAM4',
  // x / param5 has an invalid value.
  MAV_MISSION_INVALID_PARAM5_X = 'MAV_MISSION_INVALID_PARAM5_X',
  // y / param6 has an invalid value.
  MAV_MISSION_INVALID_PARAM6_Y = 'MAV_MISSION_INVALID_PARAM6_Y',
  // z / param7 has an invalid value.
  MAV_MISSION_INVALID_PARAM7 = 'MAV_MISSION_INVALID_PARAM7',
  // Mission item received out of sequence
  MAV_MISSION_INVALID_SEQUENCE = 'MAV_MISSION_INVALID_SEQUENCE',
  // Not accepting any mission commands from this communication partner.
  MAV_MISSION_DENIED = 'MAV_MISSION_DENIED',
  // Current mission operation cancelled (e.g. mission upload, mission download).
  MAV_MISSION_OPERATION_CANCELLED = 'MAV_MISSION_OPERATION_CANCELLED',
}

/**
 * Indicates the severity level, generally used for status messages to indicate their relative urgency. Based on RFC-5424 using expanded definitions at: http://www.kiwisyslog.com/kb/info:-syslog-message-levels/.
 */
export enum MavSeverity {
  // System is unusable. This is a "panic" condition.
  MAV_SEVERITY_EMERGENCY = 'MAV_SEVERITY_EMERGENCY',
  // Action should be taken immediately. Indicates error in non-critical systems.
  MAV_SEVERITY_ALERT = 'MAV_SEVERITY_ALERT',
  // Action must be taken immediately. Indicates failure in a primary system.
  MAV_SEVERITY_CRITICAL = 'MAV_SEVERITY_CRITICAL',
  // Indicates an error in secondary/redundant systems.
  MAV_SEVERITY_ERROR = 'MAV_SEVERITY_ERROR',
  // Indicates about a possible future error if this is not resolved within a given timeframe. Example would be a low battery warning.
  MAV_SEVERITY_WARNING = 'MAV_SEVERITY_WARNING',
  // An unusual event has occurred, though not an error condition. This should be investigated for the root cause.
  MAV_SEVERITY_NOTICE = 'MAV_SEVERITY_NOTICE',
  // Normal operational messages. Useful for logging. No action is required for these messages.
  MAV_SEVERITY_INFO = 'MAV_SEVERITY_INFO',
  // Useful non-operational messages that can assist in debugging. These should not occur during normal operation.
  MAV_SEVERITY_DEBUG = 'MAV_SEVERITY_DEBUG',
}

/**
 * SERIAL_CONTROL device types
 */
export enum SerialControlDev {
  // First telemetry port
  SERIAL_CONTROL_DEV_TELEM1 = 'SERIAL_CONTROL_DEV_TELEM1',
  // Second telemetry port
  SERIAL_CONTROL_DEV_TELEM2 = 'SERIAL_CONTROL_DEV_TELEM2',
  // First GPS port
  SERIAL_CONTROL_DEV_GPS1 = 'SERIAL_CONTROL_DEV_GPS1',
  // Second GPS port
  SERIAL_CONTROL_DEV_GPS2 = 'SERIAL_CONTROL_DEV_GPS2',
  // system shell
  SERIAL_CONTROL_DEV_SHELL = 'SERIAL_CONTROL_DEV_SHELL',
  // SERIAL0
  SERIAL_CONTROL_SERIAL0 = 'SERIAL_CONTROL_SERIAL0',
  // SERIAL1
  SERIAL_CONTROL_SERIAL1 = 'SERIAL_CONTROL_SERIAL1',
  // SERIAL2
  SERIAL_CONTROL_SERIAL2 = 'SERIAL_CONTROL_SERIAL2',
  // SERIAL3
  SERIAL_CONTROL_SERIAL3 = 'SERIAL_CONTROL_SERIAL3',
  // SERIAL4
  SERIAL_CONTROL_SERIAL4 = 'SERIAL_CONTROL_SERIAL4',
  // SERIAL5
  SERIAL_CONTROL_SERIAL5 = 'SERIAL_CONTROL_SERIAL5',
  // SERIAL6
  SERIAL_CONTROL_SERIAL6 = 'SERIAL_CONTROL_SERIAL6',
  // SERIAL7
  SERIAL_CONTROL_SERIAL7 = 'SERIAL_CONTROL_SERIAL7',
  // SERIAL8
  SERIAL_CONTROL_SERIAL8 = 'SERIAL_CONTROL_SERIAL8',
  // SERIAL9
  SERIAL_CONTROL_SERIAL9 = 'SERIAL_CONTROL_SERIAL9',
}

/**
 * Enumeration of distance sensor types
 */
export enum MavDistanceSensor {
  // Laser rangefinder, e.g. LightWare SF02/F or PulsedLight units
  MAV_DISTANCE_SENSOR_LASER = 'MAV_DISTANCE_SENSOR_LASER',
  // Ultrasound rangefinder, e.g. MaxBotix units
  MAV_DISTANCE_SENSOR_ULTRASOUND = 'MAV_DISTANCE_SENSOR_ULTRASOUND',
  // Infrared rangefinder, e.g. Sharp units
  MAV_DISTANCE_SENSOR_INFRARED = 'MAV_DISTANCE_SENSOR_INFRARED',
  // Radar type, e.g. uLanding units
  MAV_DISTANCE_SENSOR_RADAR = 'MAV_DISTANCE_SENSOR_RADAR',
  // Broken or unknown type, e.g. analog units
  MAV_DISTANCE_SENSOR_UNKNOWN = 'MAV_DISTANCE_SENSOR_UNKNOWN',
}

/**
 * Enumeration of sensor orientation, according to its rotations
 */
export enum MavSensorOrientation {
  // Roll: 0, Pitch: 0, Yaw: 0
  MAV_SENSOR_ROTATION_NONE = 'MAV_SENSOR_ROTATION_NONE',
  // Roll: 0, Pitch: 0, Yaw: 45
  MAV_SENSOR_ROTATION_YAW_45 = 'MAV_SENSOR_ROTATION_YAW_45',
  // Roll: 0, Pitch: 0, Yaw: 90
  MAV_SENSOR_ROTATION_YAW_90 = 'MAV_SENSOR_ROTATION_YAW_90',
  // Roll: 0, Pitch: 0, Yaw: 135
  MAV_SENSOR_ROTATION_YAW_135 = 'MAV_SENSOR_ROTATION_YAW_135',
  // Roll: 0, Pitch: 0, Yaw: 180
  MAV_SENSOR_ROTATION_YAW_180 = 'MAV_SENSOR_ROTATION_YAW_180',
  // Roll: 0, Pitch: 0, Yaw: 225
  MAV_SENSOR_ROTATION_YAW_225 = 'MAV_SENSOR_ROTATION_YAW_225',
  // Roll: 0, Pitch: 0, Yaw: 270
  MAV_SENSOR_ROTATION_YAW_270 = 'MAV_SENSOR_ROTATION_YAW_270',
  // Roll: 0, Pitch: 0, Yaw: 315
  MAV_SENSOR_ROTATION_YAW_315 = 'MAV_SENSOR_ROTATION_YAW_315',
  // Roll: 180, Pitch: 0, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_180 = 'MAV_SENSOR_ROTATION_ROLL_180',
  // Roll: 180, Pitch: 0, Yaw: 45
  MAV_SENSOR_ROTATION_ROLL_180_YAW_45 = 'MAV_SENSOR_ROTATION_ROLL_180_YAW_45',
  // Roll: 180, Pitch: 0, Yaw: 90
  MAV_SENSOR_ROTATION_ROLL_180_YAW_90 = 'MAV_SENSOR_ROTATION_ROLL_180_YAW_90',
  // Roll: 180, Pitch: 0, Yaw: 135
  MAV_SENSOR_ROTATION_ROLL_180_YAW_135 = 'MAV_SENSOR_ROTATION_ROLL_180_YAW_135',
  // Roll: 0, Pitch: 180, Yaw: 0
  MAV_SENSOR_ROTATION_PITCH_180 = 'MAV_SENSOR_ROTATION_PITCH_180',
  // Roll: 180, Pitch: 0, Yaw: 225
  MAV_SENSOR_ROTATION_ROLL_180_YAW_225 = 'MAV_SENSOR_ROTATION_ROLL_180_YAW_225',
  // Roll: 180, Pitch: 0, Yaw: 270
  MAV_SENSOR_ROTATION_ROLL_180_YAW_270 = 'MAV_SENSOR_ROTATION_ROLL_180_YAW_270',
  // Roll: 180, Pitch: 0, Yaw: 315
  MAV_SENSOR_ROTATION_ROLL_180_YAW_315 = 'MAV_SENSOR_ROTATION_ROLL_180_YAW_315',
  // Roll: 90, Pitch: 0, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_90 = 'MAV_SENSOR_ROTATION_ROLL_90',
  // Roll: 90, Pitch: 0, Yaw: 45
  MAV_SENSOR_ROTATION_ROLL_90_YAW_45 = 'MAV_SENSOR_ROTATION_ROLL_90_YAW_45',
  // Roll: 90, Pitch: 0, Yaw: 90
  MAV_SENSOR_ROTATION_ROLL_90_YAW_90 = 'MAV_SENSOR_ROTATION_ROLL_90_YAW_90',
  // Roll: 90, Pitch: 0, Yaw: 135
  MAV_SENSOR_ROTATION_ROLL_90_YAW_135 = 'MAV_SENSOR_ROTATION_ROLL_90_YAW_135',
  // Roll: 270, Pitch: 0, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_270 = 'MAV_SENSOR_ROTATION_ROLL_270',
  // Roll: 270, Pitch: 0, Yaw: 45
  MAV_SENSOR_ROTATION_ROLL_270_YAW_45 = 'MAV_SENSOR_ROTATION_ROLL_270_YAW_45',
  // Roll: 270, Pitch: 0, Yaw: 90
  MAV_SENSOR_ROTATION_ROLL_270_YAW_90 = 'MAV_SENSOR_ROTATION_ROLL_270_YAW_90',
  // Roll: 270, Pitch: 0, Yaw: 135
  MAV_SENSOR_ROTATION_ROLL_270_YAW_135 = 'MAV_SENSOR_ROTATION_ROLL_270_YAW_135',
  // Roll: 0, Pitch: 90, Yaw: 0
  MAV_SENSOR_ROTATION_PITCH_90 = 'MAV_SENSOR_ROTATION_PITCH_90',
  // Roll: 0, Pitch: 270, Yaw: 0
  MAV_SENSOR_ROTATION_PITCH_270 = 'MAV_SENSOR_ROTATION_PITCH_270',
  // Roll: 0, Pitch: 180, Yaw: 90
  MAV_SENSOR_ROTATION_PITCH_180_YAW_90 = 'MAV_SENSOR_ROTATION_PITCH_180_YAW_90',
  // Roll: 0, Pitch: 180, Yaw: 270
  MAV_SENSOR_ROTATION_PITCH_180_YAW_270 = 'MAV_SENSOR_ROTATION_PITCH_180_YAW_270',
  // Roll: 90, Pitch: 90, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_90_PITCH_90 = 'MAV_SENSOR_ROTATION_ROLL_90_PITCH_90',
  // Roll: 180, Pitch: 90, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_180_PITCH_90 = 'MAV_SENSOR_ROTATION_ROLL_180_PITCH_90',
  // Roll: 270, Pitch: 90, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_270_PITCH_90 = 'MAV_SENSOR_ROTATION_ROLL_270_PITCH_90',
  // Roll: 90, Pitch: 180, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_90_PITCH_180 = 'MAV_SENSOR_ROTATION_ROLL_90_PITCH_180',
  // Roll: 270, Pitch: 180, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_270_PITCH_180 = 'MAV_SENSOR_ROTATION_ROLL_270_PITCH_180',
  // Roll: 90, Pitch: 270, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_90_PITCH_270 = 'MAV_SENSOR_ROTATION_ROLL_90_PITCH_270',
  // Roll: 180, Pitch: 270, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_180_PITCH_270 = 'MAV_SENSOR_ROTATION_ROLL_180_PITCH_270',
  // Roll: 270, Pitch: 270, Yaw: 0
  MAV_SENSOR_ROTATION_ROLL_270_PITCH_270 = 'MAV_SENSOR_ROTATION_ROLL_270_PITCH_270',
  // Roll: 90, Pitch: 180, Yaw: 90
  MAV_SENSOR_ROTATION_ROLL_90_PITCH_180_YAW_90 = 'MAV_SENSOR_ROTATION_ROLL_90_PITCH_180_YAW_90',
  // Roll: 90, Pitch: 0, Yaw: 270
  MAV_SENSOR_ROTATION_ROLL_90_YAW_270 = 'MAV_SENSOR_ROTATION_ROLL_90_YAW_270',
  // Roll: 90, Pitch: 68, Yaw: 293
  MAV_SENSOR_ROTATION_ROLL_90_PITCH_68_YAW_293 = 'MAV_SENSOR_ROTATION_ROLL_90_PITCH_68_YAW_293',
  // Pitch: 315
  MAV_SENSOR_ROTATION_PITCH_315 = 'MAV_SENSOR_ROTATION_PITCH_315',
  // Roll: 90, Pitch: 315
  MAV_SENSOR_ROTATION_ROLL_90_PITCH_315 = 'MAV_SENSOR_ROTATION_ROLL_90_PITCH_315',
  // Roll: 270, Yaw: 180
  MAV_SENSOR_ROTATION_ROLL_270_YAW_180 = 'MAV_SENSOR_ROTATION_ROLL_270_YAW_180',
  // Custom orientation
  MAV_SENSOR_ROTATION_CUSTOM = 'MAV_SENSOR_ROTATION_CUSTOM',
}

/**
 * Type of mission items being requested/sent in mission protocol.
 */
export enum MavMissionType {
  // Items are mission commands for main mission.
  MAV_MISSION_TYPE_MISSION = 'MAV_MISSION_TYPE_MISSION',
  // Specifies GeoFence area(s). Items are MAV_CMD_NAV_FENCE_ GeoFence items.
  MAV_MISSION_TYPE_FENCE = 'MAV_MISSION_TYPE_FENCE',
  // Specifies the rally points for the vehicle. Rally points are alternative RTL points. Items are MAV_CMD_NAV_RALLY_POINT rally point items.
  MAV_MISSION_TYPE_RALLY = 'MAV_MISSION_TYPE_RALLY',
  // Only used in MISSION_CLEAR_ALL to clear all mission types.
  MAV_MISSION_TYPE_ALL = 'MAV_MISSION_TYPE_ALL',
}

/**
 * Enumeration of estimator types
 */
export enum MavEstimatorType {
  // Unknown type of the estimator.
  MAV_ESTIMATOR_TYPE_UNKNOWN = 'MAV_ESTIMATOR_TYPE_UNKNOWN',
  // This is a naive estimator without any real covariance feedback.
  MAV_ESTIMATOR_TYPE_NAIVE = 'MAV_ESTIMATOR_TYPE_NAIVE',
  // Computer vision based estimate. Might be up to scale.
  MAV_ESTIMATOR_TYPE_VISION = 'MAV_ESTIMATOR_TYPE_VISION',
  // Visual-inertial estimate.
  MAV_ESTIMATOR_TYPE_VIO = 'MAV_ESTIMATOR_TYPE_VIO',
  // Plain GPS estimate.
  MAV_ESTIMATOR_TYPE_GPS = 'MAV_ESTIMATOR_TYPE_GPS',
  // Estimator integrating GPS and inertial sensing.
  MAV_ESTIMATOR_TYPE_GPS_INS = 'MAV_ESTIMATOR_TYPE_GPS_INS',
  // Estimate from external motion capturing system.
  MAV_ESTIMATOR_TYPE_MOCAP = 'MAV_ESTIMATOR_TYPE_MOCAP',
  // Estimator based on lidar sensor input.
  MAV_ESTIMATOR_TYPE_LIDAR = 'MAV_ESTIMATOR_TYPE_LIDAR',
  // Estimator on autopilot.
  MAV_ESTIMATOR_TYPE_AUTOPILOT = 'MAV_ESTIMATOR_TYPE_AUTOPILOT',
}

/**
 * Enumeration of battery types
 */
export enum MavBatteryType {
  // Not specified.
  MAV_BATTERY_TYPE_UNKNOWN = 'MAV_BATTERY_TYPE_UNKNOWN',
  // Lithium polymer battery
  MAV_BATTERY_TYPE_LIPO = 'MAV_BATTERY_TYPE_LIPO',
  // Lithium-iron-phosphate battery
  MAV_BATTERY_TYPE_LIFE = 'MAV_BATTERY_TYPE_LIFE',
  // Lithium-ION battery
  MAV_BATTERY_TYPE_LION = 'MAV_BATTERY_TYPE_LION',
  // Nickel metal hydride battery
  MAV_BATTERY_TYPE_NIMH = 'MAV_BATTERY_TYPE_NIMH',
}

/**
 * Enumeration of battery functions
 */
export enum MavBatteryFunction {
  // Battery function is unknown
  MAV_BATTERY_FUNCTION_UNKNOWN = 'MAV_BATTERY_FUNCTION_UNKNOWN',
  // Battery supports all flight systems
  MAV_BATTERY_FUNCTION_ALL = 'MAV_BATTERY_FUNCTION_ALL',
  // Battery for the propulsion system
  MAV_BATTERY_FUNCTION_PROPULSION = 'MAV_BATTERY_FUNCTION_PROPULSION',
  // Avionics battery
  MAV_BATTERY_FUNCTION_AVIONICS = 'MAV_BATTERY_FUNCTION_AVIONICS',
  // Payload battery
  MAV_BATTERY_TYPE_PAYLOAD = 'MAV_BATTERY_TYPE_PAYLOAD',
}

/**
 * Enumeration for battery charge states.
 */
export enum MavBatteryChargeState {
  // Low battery state is not provided
  MAV_BATTERY_CHARGE_STATE_UNDEFINED = 'MAV_BATTERY_CHARGE_STATE_UNDEFINED',
  // Battery is not in low state. Normal operation.
  MAV_BATTERY_CHARGE_STATE_OK = 'MAV_BATTERY_CHARGE_STATE_OK',
  // Battery state is low, warn and monitor close.
  MAV_BATTERY_CHARGE_STATE_LOW = 'MAV_BATTERY_CHARGE_STATE_LOW',
  // Battery state is critical, return or abort immediately.
  MAV_BATTERY_CHARGE_STATE_CRITICAL = 'MAV_BATTERY_CHARGE_STATE_CRITICAL',
  // Battery state is too low for ordinary abort sequence. Perform fastest possible emergency stop to prevent damage.
  MAV_BATTERY_CHARGE_STATE_EMERGENCY = 'MAV_BATTERY_CHARGE_STATE_EMERGENCY',
  // Battery failed, damage unavoidable.
  MAV_BATTERY_CHARGE_STATE_FAILED = 'MAV_BATTERY_CHARGE_STATE_FAILED',
  // Battery is diagnosed to be defective or an error occurred, usage is discouraged / prohibited.
  MAV_BATTERY_CHARGE_STATE_UNHEALTHY = 'MAV_BATTERY_CHARGE_STATE_UNHEALTHY',
  // Battery is charging.
  MAV_BATTERY_CHARGE_STATE_CHARGING = 'MAV_BATTERY_CHARGE_STATE_CHARGING',
}

/**
 * Enumeration of VTOL states
 */
export enum MavVtolState {
  // MAV is not configured as VTOL
  MAV_VTOL_STATE_UNDEFINED = 'MAV_VTOL_STATE_UNDEFINED',
  // VTOL is in transition from multicopter to fixed-wing
  MAV_VTOL_STATE_TRANSITION_TO_FW = 'MAV_VTOL_STATE_TRANSITION_TO_FW',
  // VTOL is in transition from fixed-wing to multicopter
  MAV_VTOL_STATE_TRANSITION_TO_MC = 'MAV_VTOL_STATE_TRANSITION_TO_MC',
  // VTOL is in multicopter state
  MAV_VTOL_STATE_MC = 'MAV_VTOL_STATE_MC',
  // VTOL is in fixed-wing state
  MAV_VTOL_STATE_FW = 'MAV_VTOL_STATE_FW',
}

/**
 *
 */
export enum MavLandedState {
  // MAV landed state is unknown
  MAV_LANDED_STATE_UNDEFINED = 'MAV_LANDED_STATE_UNDEFINED',
  // MAV is landed (on ground)
  MAV_LANDED_STATE_ON_GROUND = 'MAV_LANDED_STATE_ON_GROUND',
  // MAV is in air
  MAV_LANDED_STATE_IN_AIR = 'MAV_LANDED_STATE_IN_AIR',
  // MAV currently taking off
  MAV_LANDED_STATE_TAKEOFF = 'MAV_LANDED_STATE_TAKEOFF',
  // MAV currently landing
  MAV_LANDED_STATE_LANDING = 'MAV_LANDED_STATE_LANDING',
}

/**
 * Enumeration of landed detector states
 */
export enum AdsbAltitudeType {
  // Altitude reported from a Baro source using QNH reference
  ADSB_ALTITUDE_TYPE_PRESSURE_QNH = 'ADSB_ALTITUDE_TYPE_PRESSURE_QNH',
  // Altitude reported from a GNSS source
  ADSB_ALTITUDE_TYPE_GEOMETRIC = 'ADSB_ALTITUDE_TYPE_GEOMETRIC',
}

/**
 * ADSB classification for the type of vehicle emitting the transponder signal
 */
export enum AdsbEmitterType {
  ADSB_EMITTER_TYPE_NO_INFO = 'ADSB_EMITTER_TYPE_NO_INFO',
  ADSB_EMITTER_TYPE_LIGHT = 'ADSB_EMITTER_TYPE_LIGHT',
  ADSB_EMITTER_TYPE_SMALL = 'ADSB_EMITTER_TYPE_SMALL',
  ADSB_EMITTER_TYPE_LARGE = 'ADSB_EMITTER_TYPE_LARGE',
  ADSB_EMITTER_TYPE_HIGH_VORTEX_LARGE = 'ADSB_EMITTER_TYPE_HIGH_VORTEX_LARGE',
  ADSB_EMITTER_TYPE_HEAVY = 'ADSB_EMITTER_TYPE_HEAVY',
  ADSB_EMITTER_TYPE_HIGHLY_MANUV = 'ADSB_EMITTER_TYPE_HIGHLY_MANUV',
  ADSB_EMITTER_TYPE_ROTOCRAFT = 'ADSB_EMITTER_TYPE_ROTOCRAFT',
  ADSB_EMITTER_TYPE_UNASSIGNED = 'ADSB_EMITTER_TYPE_UNASSIGNED',
  ADSB_EMITTER_TYPE_GLIDER = 'ADSB_EMITTER_TYPE_GLIDER',
  ADSB_EMITTER_TYPE_LIGHTER_AIR = 'ADSB_EMITTER_TYPE_LIGHTER_AIR',
  ADSB_EMITTER_TYPE_PARACHUTE = 'ADSB_EMITTER_TYPE_PARACHUTE',
  ADSB_EMITTER_TYPE_ULTRA_LIGHT = 'ADSB_EMITTER_TYPE_ULTRA_LIGHT',
  ADSB_EMITTER_TYPE_UNASSIGNED2 = 'ADSB_EMITTER_TYPE_UNASSIGNED2',
  ADSB_EMITTER_TYPE_UAV = 'ADSB_EMITTER_TYPE_UAV',
  ADSB_EMITTER_TYPE_SPACE = 'ADSB_EMITTER_TYPE_SPACE',
  ADSB_EMITTER_TYPE_UNASSGINED3 = 'ADSB_EMITTER_TYPE_UNASSGINED3',
  ADSB_EMITTER_TYPE_EMERGENCY_SURFACE = 'ADSB_EMITTER_TYPE_EMERGENCY_SURFACE',
  ADSB_EMITTER_TYPE_SERVICE_SURFACE = 'ADSB_EMITTER_TYPE_SERVICE_SURFACE',
  ADSB_EMITTER_TYPE_POINT_OBSTACLE = 'ADSB_EMITTER_TYPE_POINT_OBSTACLE',
}

/**
 * Bitmap of options for the MAV_CMD_DO_REPOSITION
 */
export enum MavDoRepositionFlags {
  // The aircraft should immediately transition into guided. This should not be set for follow me applications
  MAV_DO_REPOSITION_FLAGS_CHANGE_MODE = 'MAV_DO_REPOSITION_FLAGS_CHANGE_MODE',
}

/**
 * Motor test order flag
 */
export enum MotorTestOrder {
  // default autopilot motor test method
  MOTOR_TEST_ORDER_DEFAULT = 'MOTOR_TEST_ORDER_DEFAULT',
  // motor numbers are specified as their index in a predefined vehicle-specific sequence
  MOTOR_TEST_ORDER_SEQUENCE = 'MOTOR_TEST_ORDER_SEQUENCE',
  // motor numbers are specified as the output as labeled on the board
  MOTOR_TEST_ORDER_BOARD = 'MOTOR_TEST_ORDER_BOARD',
}

/**
 * Motor test type
 */
export enum MotorTestThrottleType {
  // throttle as a percentage from 0 ~ 100
  MOTOR_TEST_THROTTLE_PERCENT = 'MOTOR_TEST_THROTTLE_PERCENT',
  // throttle as an absolute PWM value (normally in range of 1000~2000)
  MOTOR_TEST_THROTTLE_PWM = 'MOTOR_TEST_THROTTLE_PWM',
  // throttle pass-through from pilot's transmitter
  MOTOR_TEST_THROTTLE_PILOT = 'MOTOR_TEST_THROTTLE_PILOT',
  // per-motor compass calibration test
  MOTOR_TEST_COMPASS_CAL = 'MOTOR_TEST_COMPASS_CAL',
}

/**
 * Possible actions an aircraft can take to avoid a collision.
 */
export enum MavCollisionAction {
  // Ignore any potential collisions
  MAV_COLLISION_ACTION_NONE = 'MAV_COLLISION_ACTION_NONE',
  // Report potential collision
  MAV_COLLISION_ACTION_REPORT = 'MAV_COLLISION_ACTION_REPORT',
  // Ascend or Descend to avoid threat
  MAV_COLLISION_ACTION_ASCEND_OR_DESCEND = 'MAV_COLLISION_ACTION_ASCEND_OR_DESCEND',
  // Move horizontally to avoid threat
  MAV_COLLISION_ACTION_MOVE_HORIZONTALLY = 'MAV_COLLISION_ACTION_MOVE_HORIZONTALLY',
  // Aircraft to move perpendicular to the collision's velocity vector
  MAV_COLLISION_ACTION_MOVE_PERPENDICULAR = 'MAV_COLLISION_ACTION_MOVE_PERPENDICULAR',
  // Aircraft to fly directly back to its launch point
  MAV_COLLISION_ACTION_RTL = 'MAV_COLLISION_ACTION_RTL',
  // Aircraft to stop in place
  MAV_COLLISION_ACTION_HOVER = 'MAV_COLLISION_ACTION_HOVER',
}

/**
 * Aircraft-rated danger from this threat.
 */
export enum MavCollisionThreatLevel {
  // Not a threat
  MAV_COLLISION_THREAT_LEVEL_NONE = 'MAV_COLLISION_THREAT_LEVEL_NONE',
  // Craft is mildly concerned about this threat
  MAV_COLLISION_THREAT_LEVEL_LOW = 'MAV_COLLISION_THREAT_LEVEL_LOW',
  // Craft is panicking, and may take actions to avoid threat
  MAV_COLLISION_THREAT_LEVEL_HIGH = 'MAV_COLLISION_THREAT_LEVEL_HIGH',
}

/**
 * Source of information about this collision.
 */
export enum MavCollisionSrc {
  // ID field references ADSB_VEHICLE packets
  MAV_COLLISION_SRC_ADSB = 'MAV_COLLISION_SRC_ADSB',
  // ID field references MAVLink SRC ID
  MAV_COLLISION_SRC_MAVLINK_GPS_GLOBAL_INT = 'MAV_COLLISION_SRC_MAVLINK_GPS_GLOBAL_INT',
}

/**
 * Type of GPS fix
 */
export enum GpsFixType {
  // No GPS connected
  GPS_FIX_TYPE_NO_GPS = 'GPS_FIX_TYPE_NO_GPS',
  // No position information, GPS is connected
  GPS_FIX_TYPE_NO_FIX = 'GPS_FIX_TYPE_NO_FIX',
  // 2D position
  GPS_FIX_TYPE_2D_FIX = 'GPS_FIX_TYPE_2D_FIX',
  // 3D position
  GPS_FIX_TYPE_3D_FIX = 'GPS_FIX_TYPE_3D_FIX',
  // DGPS/SBAS aided 3D position
  GPS_FIX_TYPE_DGPS = 'GPS_FIX_TYPE_DGPS',
  // RTK float, 3D position
  GPS_FIX_TYPE_RTK_FLOAT = 'GPS_FIX_TYPE_RTK_FLOAT',
  // RTK Fixed, 3D position
  GPS_FIX_TYPE_RTK_FIXED = 'GPS_FIX_TYPE_RTK_FIXED',
  // Static fixed, typically used for base stations
  GPS_FIX_TYPE_STATIC = 'GPS_FIX_TYPE_STATIC',
  // PPP, 3D position.
  GPS_FIX_TYPE_PPP = 'GPS_FIX_TYPE_PPP',
}

/**
 * RTK GPS baseline coordinate system, used for RTK corrections
 */
export enum RtkBaselineCoordinateSystem {
  // Earth-centered, Earth-fixed
  RTK_BASELINE_COORDINATE_SYSTEM_ECEF = 'RTK_BASELINE_COORDINATE_SYSTEM_ECEF',
  // RTK basestation centered, north, east, down
  RTK_BASELINE_COORDINATE_SYSTEM_NED = 'RTK_BASELINE_COORDINATE_SYSTEM_NED',
}

/**
 * Type of landing target
 */
export enum LandingTargetType {
  // Landing target signaled by light beacon (ex: IR-LOCK)
  LANDING_TARGET_TYPE_LIGHT_BEACON = 'LANDING_TARGET_TYPE_LIGHT_BEACON',
  // Landing target signaled by radio beacon (ex: ILS, NDB)
  LANDING_TARGET_TYPE_RADIO_BEACON = 'LANDING_TARGET_TYPE_RADIO_BEACON',
  // Landing target represented by a fiducial marker (ex: ARTag)
  LANDING_TARGET_TYPE_VISION_FIDUCIAL = 'LANDING_TARGET_TYPE_VISION_FIDUCIAL',
  // Landing target represented by a pre-defined visual shape/feature (ex: X-marker, H-marker, square)
  LANDING_TARGET_TYPE_VISION_OTHER = 'LANDING_TARGET_TYPE_VISION_OTHER',
}

/**
 * Direction of VTOL transition
 */
export enum VtolTransitionHeading {
  // Respect the heading configuration of the vehicle.
  VTOL_TRANSITION_HEADING_VEHICLE_DEFAULT = 'VTOL_TRANSITION_HEADING_VEHICLE_DEFAULT',
  // Use the heading pointing towards the next waypoint.
  VTOL_TRANSITION_HEADING_NEXT_WAYPOINT = 'VTOL_TRANSITION_HEADING_NEXT_WAYPOINT',
  // Use the heading on takeoff (while sitting on the ground).
  VTOL_TRANSITION_HEADING_TAKEOFF = 'VTOL_TRANSITION_HEADING_TAKEOFF',
  // Use the specified heading in parameter 4.
  VTOL_TRANSITION_HEADING_SPECIFIED = 'VTOL_TRANSITION_HEADING_SPECIFIED',
  // Use the current heading when reaching takeoff altitude (potentially facing the wind when weather-vaning is active).
  VTOL_TRANSITION_HEADING_ANY = 'VTOL_TRANSITION_HEADING_ANY',
}

/**
 * Stream status flags (Bitmap)
 */
export enum VideoStreamStatusFlags {
  // Stream is active (running)
  VIDEO_STREAM_STATUS_FLAGS_RUNNING = 'VIDEO_STREAM_STATUS_FLAGS_RUNNING',
  // Stream is thermal imaging
  VIDEO_STREAM_STATUS_FLAGS_THERMAL = 'VIDEO_STREAM_STATUS_FLAGS_THERMAL',
}

/**
 * Video stream types
 */
export enum VideoStreamType {
  // Stream is RTSP
  VIDEO_STREAM_TYPE_RTSP = 'VIDEO_STREAM_TYPE_RTSP',
  // Stream is RTP UDP (URI gives the port number)
  VIDEO_STREAM_TYPE_RTPUDP = 'VIDEO_STREAM_TYPE_RTPUDP',
  // Stream is MPEG on TCP
  VIDEO_STREAM_TYPE_TCP_MPEG = 'VIDEO_STREAM_TYPE_TCP_MPEG',
  // Stream is h.264 on MPEG TS (URI gives the port number)
  VIDEO_STREAM_TYPE_MPEG_TS_H264 = 'VIDEO_STREAM_TYPE_MPEG_TS_H264',
}

/**
 * Zoom types for MAV_CMD_SET_CAMERA_ZOOM
 */
export enum CameraZoomType {
  // Zoom one step increment (-1 for wide, 1 for tele)
  ZOOM_TYPE_STEP = 'ZOOM_TYPE_STEP',
  // Continuous zoom up/down until stopped (-1 for wide, 1 for tele, 0 to stop zooming)
  ZOOM_TYPE_CONTINUOUS = 'ZOOM_TYPE_CONTINUOUS',
  // Zoom value as proportion of full camera range (a value between 0.0 and 100.0)
  ZOOM_TYPE_RANGE = 'ZOOM_TYPE_RANGE',
  // Zoom value/variable focal length in milimetres. Note that there is no message to get the valid zoom range of the camera, so this can type can only be used for cameras where the zoom range is known (implying that this cannot reliably be used in a GCS for an arbitrary camera)
  ZOOM_TYPE_FOCAL_LENGTH = 'ZOOM_TYPE_FOCAL_LENGTH',
}

/**
 * Focus types for MAV_CMD_SET_CAMERA_FOCUS
 */
export enum SetFocusType {
  // Focus one step increment (-1 for focusing in, 1 for focusing out towards infinity).
  FOCUS_TYPE_STEP = 'FOCUS_TYPE_STEP',
  // Continuous focus up/down until stopped (-1 for focusing in, 1 for focusing out towards infinity, 0 to stop focusing)
  FOCUS_TYPE_CONTINUOUS = 'FOCUS_TYPE_CONTINUOUS',
  // Focus value as proportion of full camera focus range (a value between 0.0 and 100.0)
  FOCUS_TYPE_RANGE = 'FOCUS_TYPE_RANGE',
  // Focus value in metres. Note that there is no message to get the valid focus range of the camera, so this can type can only be used for cameras where the range is known (implying that this cannot reliably be used in a GCS for an arbitrary camera).
  FOCUS_TYPE_METERS = 'FOCUS_TYPE_METERS',
}

/**
 * Result from a PARAM_EXT_SET message.
 */
export enum ParamAck {
  // Parameter value ACCEPTED and SET
  PARAM_ACK_ACCEPTED = 'PARAM_ACK_ACCEPTED',
  // Parameter value UNKNOWN/UNSUPPORTED
  PARAM_ACK_VALUE_UNSUPPORTED = 'PARAM_ACK_VALUE_UNSUPPORTED',
  // Parameter failed to set
  PARAM_ACK_FAILED = 'PARAM_ACK_FAILED',
  // Parameter value received but not yet validated or set. A subsequent PARAM_EXT_ACK will follow once operation is completed with the actual result. These are for parameters that may take longer to set. Instead of waiting for an ACK and potentially timing out, you will immediately receive this response to let you know it was received.
  PARAM_ACK_IN_PROGRESS = 'PARAM_ACK_IN_PROGRESS',
}

/**
 * Camera Modes.
 */
export enum CameraMode {
  // Camera is in image/photo capture mode.
  CAMERA_MODE_IMAGE = 'CAMERA_MODE_IMAGE',
  // Camera is in video capture mode.
  CAMERA_MODE_VIDEO = 'CAMERA_MODE_VIDEO',
  // Camera is in image survey capture mode. It allows for camera controller to do specific settings for surveys.
  CAMERA_MODE_IMAGE_SURVEY = 'CAMERA_MODE_IMAGE_SURVEY',
}

/**
 * Arm denied reason
 */
export enum MavArmAuthDeniedReason {
  // Not a specific reason
  MAV_ARM_AUTH_DENIED_REASON_GENERIC = 'MAV_ARM_AUTH_DENIED_REASON_GENERIC',
  // Authorizer will send the error as string to GCS
  MAV_ARM_AUTH_DENIED_REASON_NONE = 'MAV_ARM_AUTH_DENIED_REASON_NONE',
  // At least one waypoint have a invalid value
  MAV_ARM_AUTH_DENIED_REASON_INVALID_WAYPOINT = 'MAV_ARM_AUTH_DENIED_REASON_INVALID_WAYPOINT',
  // Timeout in the authorizer process(in case it depends on network)
  MAV_ARM_AUTH_DENIED_REASON_TIMEOUT = 'MAV_ARM_AUTH_DENIED_REASON_TIMEOUT',
  // Airspace of the mission in use by another vehicle, second result parameter can have the waypoint id that caused it to be denied.
  MAV_ARM_AUTH_DENIED_REASON_AIRSPACE_IN_USE = 'MAV_ARM_AUTH_DENIED_REASON_AIRSPACE_IN_USE',
  // Weather is not good to fly
  MAV_ARM_AUTH_DENIED_REASON_BAD_WEATHER = 'MAV_ARM_AUTH_DENIED_REASON_BAD_WEATHER',
}

/**
 * RC type
 */
export enum RcType {
  // Spektrum DSM2
  RC_TYPE_SPEKTRUM_DSM2 = 'RC_TYPE_SPEKTRUM_DSM2',
  // Spektrum DSMX
  RC_TYPE_SPEKTRUM_DSMX = 'RC_TYPE_SPEKTRUM_DSMX',
}

/**
 * Airborne status of UAS.
 */
export enum UtmFlightState {
  // The flight state can't be determined.
  UTM_FLIGHT_STATE_UNKNOWN = 'UTM_FLIGHT_STATE_UNKNOWN',
  // UAS on ground.
  UTM_FLIGHT_STATE_GROUND = 'UTM_FLIGHT_STATE_GROUND',
  // UAS airborne.
  UTM_FLIGHT_STATE_AIRBORNE = 'UTM_FLIGHT_STATE_AIRBORNE',
  // UAS is in an emergency flight state.
  UTM_FLIGHT_STATE_EMERGENCY = 'UTM_FLIGHT_STATE_EMERGENCY',
  // UAS has no active controls.
  UTM_FLIGHT_STATE_NOCTRL = 'UTM_FLIGHT_STATE_NOCTRL',
}

/**
 * Cellular network radio type
 */
export enum CellularNetworkRadioType {
  CELLULAR_NETWORK_RADIO_TYPE_NONE = 'CELLULAR_NETWORK_RADIO_TYPE_NONE',
  CELLULAR_NETWORK_RADIO_TYPE_GSM = 'CELLULAR_NETWORK_RADIO_TYPE_GSM',
  CELLULAR_NETWORK_RADIO_TYPE_CDMA = 'CELLULAR_NETWORK_RADIO_TYPE_CDMA',
  CELLULAR_NETWORK_RADIO_TYPE_WCDMA = 'CELLULAR_NETWORK_RADIO_TYPE_WCDMA',
  CELLULAR_NETWORK_RADIO_TYPE_LTE = 'CELLULAR_NETWORK_RADIO_TYPE_LTE',
}

/**
 * These flags encode the cellular network status
 */
export enum CellularStatusFlag {
  // State unknown or not reportable.
  CELLULAR_STATUS_FLAG_UNKNOWN = 'CELLULAR_STATUS_FLAG_UNKNOWN',
  // Modem is unusable
  CELLULAR_STATUS_FLAG_FAILED = 'CELLULAR_STATUS_FLAG_FAILED',
  // Modem is being initialized
  CELLULAR_STATUS_FLAG_INITIALIZING = 'CELLULAR_STATUS_FLAG_INITIALIZING',
  // Modem is locked
  CELLULAR_STATUS_FLAG_LOCKED = 'CELLULAR_STATUS_FLAG_LOCKED',
  // Modem is not enabled and is powered down
  CELLULAR_STATUS_FLAG_DISABLED = 'CELLULAR_STATUS_FLAG_DISABLED',
  // Modem is currently transitioning to the CELLULAR_STATUS_FLAG_DISABLED state
  CELLULAR_STATUS_FLAG_DISABLING = 'CELLULAR_STATUS_FLAG_DISABLING',
  // Modem is currently transitioning to the CELLULAR_STATUS_FLAG_ENABLED state
  CELLULAR_STATUS_FLAG_ENABLING = 'CELLULAR_STATUS_FLAG_ENABLING',
  // Modem is enabled and powered on but not registered with a network provider and not available for data connections
  CELLULAR_STATUS_FLAG_ENABLED = 'CELLULAR_STATUS_FLAG_ENABLED',
  // Modem is searching for a network provider to register
  CELLULAR_STATUS_FLAG_SEARCHING = 'CELLULAR_STATUS_FLAG_SEARCHING',
  // Modem is registered with a network provider, and data connections and messaging may be available for use
  CELLULAR_STATUS_FLAG_REGISTERED = 'CELLULAR_STATUS_FLAG_REGISTERED',
  // Modem is disconnecting and deactivating the last active packet data bearer. This state will not be entered if more than one packet data bearer is active and one of the active bearers is deactivated
  CELLULAR_STATUS_FLAG_DISCONNECTING = 'CELLULAR_STATUS_FLAG_DISCONNECTING',
  // Modem is activating and connecting the first packet data bearer. Subsequent bearer activations when another bearer is already active do not cause this state to be entered
  CELLULAR_STATUS_FLAG_CONNECTING = 'CELLULAR_STATUS_FLAG_CONNECTING',
  // One or more packet data bearers is active and connected
  CELLULAR_STATUS_FLAG_CONNECTED = 'CELLULAR_STATUS_FLAG_CONNECTED',
}

/**
 * These flags are used to diagnose the failure state of CELLULAR_STATUS
 */
export enum CellularNetworkFailedReason {
  // No error
  CELLULAR_NETWORK_FAILED_REASON_NONE = 'CELLULAR_NETWORK_FAILED_REASON_NONE',
  // Error state is unknown
  CELLULAR_NETWORK_FAILED_REASON_UNKNOWN = 'CELLULAR_NETWORK_FAILED_REASON_UNKNOWN',
  // SIM is required for the modem but missing
  CELLULAR_NETWORK_FAILED_REASON_SIM_MISSING = 'CELLULAR_NETWORK_FAILED_REASON_SIM_MISSING',
  // SIM is available, but not usuable for connection
  CELLULAR_NETWORK_FAILED_REASON_SIM_ERROR = 'CELLULAR_NETWORK_FAILED_REASON_SIM_ERROR',
}

/**
 * Precision land modes (used in MAV_CMD_NAV_LAND).
 */
export enum PrecisionLandMode {
  // Normal (non-precision) landing.
  PRECISION_LAND_MODE_DISABLED = 'PRECISION_LAND_MODE_DISABLED',
  // Use precision landing if beacon detected when land command accepted, otherwise land normally.
  PRECISION_LAND_MODE_OPPORTUNISTIC = 'PRECISION_LAND_MODE_OPPORTUNISTIC',
  // Use precision landing, searching for beacon if not found when land command accepted (land normally if beacon cannot be found).
  PRECISION_LAND_MODE_REQUIRED = 'PRECISION_LAND_MODE_REQUIRED',
}

/**
 * Parachute actions. Trigger release and enable/disable auto-release.
 */
export enum ParachuteAction {
  // Disable auto-release of parachute (i.e. release triggered by crash detectors).
  PARACHUTE_DISABLE = 'PARACHUTE_DISABLE',
  // Enable auto-release of parachute.
  PARACHUTE_ENABLE = 'PARACHUTE_ENABLE',
  // Release parachute and kill motors.
  PARACHUTE_RELEASE = 'PARACHUTE_RELEASE',
}

/**
 * Runnel payload type
 */
export enum MavTunnelPayloadType {
  // Encoding of payload unknown.
  MAV_TUNNEL_PAYLOAD_TYPE_UNKNOWN = 'MAV_TUNNEL_PAYLOAD_TYPE_UNKNOWN',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED0 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED0',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED1 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED1',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED2 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED2',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED3 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED3',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED4 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED4',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED5 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED5',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED6 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED6',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED7 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED7',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED8 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED8',
  // Registered for STorM32 gimbal controller.
  MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED9 = 'MAV_TUNNEL_PAYLOAD_TYPE_STORM32_RESERVED9',
}

/**
 * Odid Id type
 */
export enum MavOdidIdType {
  // No type defined.
  MAV_ODID_ID_TYPE_NONE = 'MAV_ODID_ID_TYPE_NONE',
  // Manufacturer Serial Number (ANSI/CTA-2063 format).
  MAV_ODID_ID_TYPE_SERIAL_NUMBER = 'MAV_ODID_ID_TYPE_SERIAL_NUMBER',
  // CAA (Civil Aviation Authority) registered ID. Format: [ICAO Country Code].[CAA Assigned ID].
  MAV_ODID_ID_TYPE_CAA_REGISTRATION_ID = 'MAV_ODID_ID_TYPE_CAA_REGISTRATION_ID',
  // UTM (Unmanned Traffic Management) assigned UUID (RFC4122).
  MAV_ODID_ID_TYPE_UTM_ASSIGNED_UUID = 'MAV_ODID_ID_TYPE_UTM_ASSIGNED_UUID',
}

/**
 * Odid Ua type
 */
export enum MavOdidUaType {
  // No UA (Unmanned Aircraft) type defined.
  MAV_ODID_UA_TYPE_NONE = 'MAV_ODID_UA_TYPE_NONE',
  // Aeroplane/Airplane. Fixed wing.
  MAV_ODID_UA_TYPE_AEROPLANE = 'MAV_ODID_UA_TYPE_AEROPLANE',
  // Helicopter or multirotor.
  MAV_ODID_UA_TYPE_HELICOPTER_OR_MULTIROTOR = 'MAV_ODID_UA_TYPE_HELICOPTER_OR_MULTIROTOR',
  // Gyroplane.
  MAV_ODID_UA_TYPE_GYROPLANE = 'MAV_ODID_UA_TYPE_GYROPLANE',
  // VTOL (Vertical Take-Off and Landing). Fixed wing aircraft that can take off vertically.
  MAV_ODID_UA_TYPE_HYBRID_LIFT = 'MAV_ODID_UA_TYPE_HYBRID_LIFT',
  // Ornithopter.
  MAV_ODID_UA_TYPE_ORNITHOPTER = 'MAV_ODID_UA_TYPE_ORNITHOPTER',
  // Glider.
  MAV_ODID_UA_TYPE_GLIDER = 'MAV_ODID_UA_TYPE_GLIDER',
  // Kite.
  MAV_ODID_UA_TYPE_KITE = 'MAV_ODID_UA_TYPE_KITE',
  // Free Balloon.
  MAV_ODID_UA_TYPE_FREE_BALLOON = 'MAV_ODID_UA_TYPE_FREE_BALLOON',
  // Captive Balloon.
  MAV_ODID_UA_TYPE_CAPTIVE_BALLOON = 'MAV_ODID_UA_TYPE_CAPTIVE_BALLOON',
  // Airship. E.g. a blimp.
  MAV_ODID_UA_TYPE_AIRSHIP = 'MAV_ODID_UA_TYPE_AIRSHIP',
  // Free Fall/Parachute (unpowered).
  MAV_ODID_UA_TYPE_FREE_FALL_PARACHUTE = 'MAV_ODID_UA_TYPE_FREE_FALL_PARACHUTE',
  // Rocket.
  MAV_ODID_UA_TYPE_ROCKET = 'MAV_ODID_UA_TYPE_ROCKET',
  // Tethered powered aircraft.
  MAV_ODID_UA_TYPE_TETHERED_POWERED_AIRCRAFT = 'MAV_ODID_UA_TYPE_TETHERED_POWERED_AIRCRAFT',
  // Ground Obstacle.
  MAV_ODID_UA_TYPE_GROUND_OBSTACLE = 'MAV_ODID_UA_TYPE_GROUND_OBSTACLE',
  // Other type of aircraft not listed earlier.
  MAV_ODID_UA_TYPE_OTHER = 'MAV_ODID_UA_TYPE_OTHER',
}

/**
 * Odid status
 */
export enum MavOdidStatus {
  // The status of the (UA) Unmanned Aircraft is undefined.
  MAV_ODID_STATUS_UNDECLARED = 'MAV_ODID_STATUS_UNDECLARED',
  // The UA is on the ground.
  MAV_ODID_STATUS_GROUND = 'MAV_ODID_STATUS_GROUND',
  // The UA is in the air.
  MAV_ODID_STATUS_AIRBORNE = 'MAV_ODID_STATUS_AIRBORNE',
  // The UA is having an emergency.
  MAV_ODID_STATUS_EMERGENCY = 'MAV_ODID_STATUS_EMERGENCY',
}

/**
 * Odid geight reference
 */
export enum MavOdidHeightRef {
  // The height field is relative to the take-off location.
  MAV_ODID_HEIGHT_REF_OVER_TAKEOFF = 'MAV_ODID_HEIGHT_REF_OVER_TAKEOFF',
  // The height field is relative to ground.
  MAV_ODID_HEIGHT_REF_OVER_GROUND = 'MAV_ODID_HEIGHT_REF_OVER_GROUND',
}

/**
 * Odid hor acc
 */
export enum MavOdidHorAcc {
  // The horizontal accuracy is unknown.
  MAV_ODID_HOR_ACC_UNKNOWN = 'MAV_ODID_HOR_ACC_UNKNOWN',
  // The horizontal accuracy is smaller than 10 Nautical Miles. 18.52 km.
  MAV_ODID_HOR_ACC_10NM = 'MAV_ODID_HOR_ACC_10NM',
  // The horizontal accuracy is smaller than 4 Nautical Miles. 7.408 km.
  MAV_ODID_HOR_ACC_4NM = 'MAV_ODID_HOR_ACC_4NM',
  // The horizontal accuracy is smaller than 2 Nautical Miles. 3.704 km.
  MAV_ODID_HOR_ACC_2NM = 'MAV_ODID_HOR_ACC_2NM',
  // The horizontal accuracy is smaller than 1 Nautical Miles. 1.852 km.
  MAV_ODID_HOR_ACC_1NM = 'MAV_ODID_HOR_ACC_1NM',
  // The horizontal accuracy is smaller than 0.5 Nautical Miles. 926 m.
  MAV_ODID_HOR_ACC_0_5NM = 'MAV_ODID_HOR_ACC_0_5NM',
  // The horizontal accuracy is smaller than 0.3 Nautical Miles. 555.6 m.
  MAV_ODID_HOR_ACC_0_3NM = 'MAV_ODID_HOR_ACC_0_3NM',
  // The horizontal accuracy is smaller than 0.1 Nautical Miles. 185.2 m.
  MAV_ODID_HOR_ACC_0_1NM = 'MAV_ODID_HOR_ACC_0_1NM',
  // The horizontal accuracy is smaller than 0.05 Nautical Miles. 92.6 m.
  MAV_ODID_HOR_ACC_0_05NM = 'MAV_ODID_HOR_ACC_0_05NM',
  // The horizontal accuracy is smaller than 30 meter.
  MAV_ODID_HOR_ACC_30_METER = 'MAV_ODID_HOR_ACC_30_METER',
  // The horizontal accuracy is smaller than 10 meter.
  MAV_ODID_HOR_ACC_10_METER = 'MAV_ODID_HOR_ACC_10_METER',
  // The horizontal accuracy is smaller than 3 meter.
  MAV_ODID_HOR_ACC_3_METER = 'MAV_ODID_HOR_ACC_3_METER',
  // The horizontal accuracy is smaller than 1 meter.
  MAV_ODID_HOR_ACC_1_METER = 'MAV_ODID_HOR_ACC_1_METER',
}

/**
 * Odid ver acc
 */
export enum MavOdidVerAcc {
  // The vertical accuracy is unknown.
  MAV_ODID_VER_ACC_UNKNOWN = 'MAV_ODID_VER_ACC_UNKNOWN',
  // The vertical accuracy is smaller than 150 meter.
  MAV_ODID_VER_ACC_150_METER = 'MAV_ODID_VER_ACC_150_METER',
  // The vertical accuracy is smaller than 45 meter.
  MAV_ODID_VER_ACC_45_METER = 'MAV_ODID_VER_ACC_45_METER',
  // The vertical accuracy is smaller than 25 meter.
  MAV_ODID_VER_ACC_25_METER = 'MAV_ODID_VER_ACC_25_METER',
  // The vertical accuracy is smaller than 10 meter.
  MAV_ODID_VER_ACC_10_METER = 'MAV_ODID_VER_ACC_10_METER',
  // The vertical accuracy is smaller than 3 meter.
  MAV_ODID_VER_ACC_3_METER = 'MAV_ODID_VER_ACC_3_METER',
  // The vertical accuracy is smaller than 1 meter.
  MAV_ODID_VER_ACC_1_METER = 'MAV_ODID_VER_ACC_1_METER',
}

/**
 * Odid speed acc
 */
export enum MavOdidSpeedAcc {
  // The speed accuracy is unknown.
  MAV_ODID_SPEED_ACC_UNKNOWN = 'MAV_ODID_SPEED_ACC_UNKNOWN',
  // The speed accuracy is smaller than 10 meters per second.
  MAV_ODID_SPEED_ACC_10_METERS_PER_SECOND = 'MAV_ODID_SPEED_ACC_10_METERS_PER_SECOND',
  // The speed accuracy is smaller than 3 meters per second.
  MAV_ODID_SPEED_ACC_3_METERS_PER_SECOND = 'MAV_ODID_SPEED_ACC_3_METERS_PER_SECOND',
  // The speed accuracy is smaller than 1 meters per second.
  MAV_ODID_SPEED_ACC_1_METERS_PER_SECOND = 'MAV_ODID_SPEED_ACC_1_METERS_PER_SECOND',
  // The speed accuracy is smaller than 0.3 meters per second.
  MAV_ODID_SPEED_ACC_0_3_METERS_PER_SECOND = 'MAV_ODID_SPEED_ACC_0_3_METERS_PER_SECOND',
}

/**
 * Odid time acc
 */
export enum MavOdidTimeAcc {
  // The timestamp accuracy is unknown.
  MAV_ODID_TIME_ACC_UNKNOWN = 'MAV_ODID_TIME_ACC_UNKNOWN',
  // The timestamp accuracy is smaller than or equal to 0.1 second.
  MAV_ODID_TIME_ACC_0_1_SECOND = 'MAV_ODID_TIME_ACC_0_1_SECOND',
  // The timestamp accuracy is smaller than or equal to 0.2 second.
  MAV_ODID_TIME_ACC_0_2_SECOND = 'MAV_ODID_TIME_ACC_0_2_SECOND',
  // The timestamp accuracy is smaller than or equal to 0.3 second.
  MAV_ODID_TIME_ACC_0_3_SECOND = 'MAV_ODID_TIME_ACC_0_3_SECOND',
  // The timestamp accuracy is smaller than or equal to 0.4 second.
  MAV_ODID_TIME_ACC_0_4_SECOND = 'MAV_ODID_TIME_ACC_0_4_SECOND',
  // The timestamp accuracy is smaller than or equal to 0.5 second.
  MAV_ODID_TIME_ACC_0_5_SECOND = 'MAV_ODID_TIME_ACC_0_5_SECOND',
  // The timestamp accuracy is smaller than or equal to 0.6 second.
  MAV_ODID_TIME_ACC_0_6_SECOND = 'MAV_ODID_TIME_ACC_0_6_SECOND',
  // The timestamp accuracy is smaller than or equal to 0.7 second.
  MAV_ODID_TIME_ACC_0_7_SECOND = 'MAV_ODID_TIME_ACC_0_7_SECOND',
  // The timestamp accuracy is smaller than or equal to 0.8 second.
  MAV_ODID_TIME_ACC_0_8_SECOND = 'MAV_ODID_TIME_ACC_0_8_SECOND',
  // The timestamp accuracy is smaller than or equal to 0.9 second.
  MAV_ODID_TIME_ACC_0_9_SECOND = 'MAV_ODID_TIME_ACC_0_9_SECOND',
  // The timestamp accuracy is smaller than or equal to 1.0 second.
  MAV_ODID_TIME_ACC_1_0_SECOND = 'MAV_ODID_TIME_ACC_1_0_SECOND',
  // The timestamp accuracy is smaller than or equal to 1.1 second.
  MAV_ODID_TIME_ACC_1_1_SECOND = 'MAV_ODID_TIME_ACC_1_1_SECOND',
  // The timestamp accuracy is smaller than or equal to 1.2 second.
  MAV_ODID_TIME_ACC_1_2_SECOND = 'MAV_ODID_TIME_ACC_1_2_SECOND',
  // The timestamp accuracy is smaller than or equal to 1.3 second.
  MAV_ODID_TIME_ACC_1_3_SECOND = 'MAV_ODID_TIME_ACC_1_3_SECOND',
  // The timestamp accuracy is smaller than or equal to 1.4 second.
  MAV_ODID_TIME_ACC_1_4_SECOND = 'MAV_ODID_TIME_ACC_1_4_SECOND',
  // The timestamp accuracy is smaller than or equal to 1.5 second.
  MAV_ODID_TIME_ACC_1_5_SECOND = 'MAV_ODID_TIME_ACC_1_5_SECOND',
}

/**
 * Odid auth type
 */
export enum MavOdidAuthType {
  // No authentication type is specified.
  MAV_ODID_AUTH_TYPE_NONE = 'MAV_ODID_AUTH_TYPE_NONE',
  // Signature for the UAS (Unmanned Aircraft System) ID.
  MAV_ODID_AUTH_TYPE_UAS_ID_SIGNATURE = 'MAV_ODID_AUTH_TYPE_UAS_ID_SIGNATURE',
  // Signature for the Operator ID.
  MAV_ODID_AUTH_TYPE_OPERATOR_ID_SIGNATURE = 'MAV_ODID_AUTH_TYPE_OPERATOR_ID_SIGNATURE',
  // Signature for the entire message set.
  MAV_ODID_AUTH_TYPE_MESSAGE_SET_SIGNATURE = 'MAV_ODID_AUTH_TYPE_MESSAGE_SET_SIGNATURE',
  // Authentication is provided by Network Remote ID.
  MAV_ODID_AUTH_TYPE_NETWORK_REMOTE_ID = 'MAV_ODID_AUTH_TYPE_NETWORK_REMOTE_ID',
}

/**
 * Odid Desc type
 */
export enum MavOdidDescType {
  // Free-form text description of the purpose of the flight.
  MAV_ODID_DESC_TYPE_TEXT = 'MAV_ODID_DESC_TYPE_TEXT',
}

/**
 * Odid operator location type
 */
export enum MavOdidOperatorLocationType {
  // The location of the operator is the same as the take-off location.
  MAV_ODID_OPERATOR_LOCATION_TYPE_TAKEOFF = 'MAV_ODID_OPERATOR_LOCATION_TYPE_TAKEOFF',
  // The location of the operator is based on live GNSS data.
  MAV_ODID_OPERATOR_LOCATION_TYPE_LIVE_GNSS = 'MAV_ODID_OPERATOR_LOCATION_TYPE_LIVE_GNSS',
  // The location of the operator is a fixed location.
  MAV_ODID_OPERATOR_LOCATION_TYPE_FIXED = 'MAV_ODID_OPERATOR_LOCATION_TYPE_FIXED',
}

/**
 * Odid classification type
 */
export enum MavOdidClassificationType {
  // The classification type for the UA is undeclared.
  MAV_ODID_CLASSIFICATION_TYPE_UNDECLARED = 'MAV_ODID_CLASSIFICATION_TYPE_UNDECLARED',
  // The classification type for the UA follows EU (European Union) specifications.
  MAV_ODID_CLASSIFICATION_TYPE_EU = 'MAV_ODID_CLASSIFICATION_TYPE_EU',
}

/**
 * Odid category EU
 */
export enum MavOdidCategoryEu {
  // The category for the UA, according to the EU specification, is undeclared.
  MAV_ODID_CATEGORY_EU_UNDECLARED = 'MAV_ODID_CATEGORY_EU_UNDECLARED',
  // The category for the UA, according to the EU specification, is the Open category.
  MAV_ODID_CATEGORY_EU_OPEN = 'MAV_ODID_CATEGORY_EU_OPEN',
  // The category for the UA, according to the EU specification, is the Specific category.
  MAV_ODID_CATEGORY_EU_SPECIFIC = 'MAV_ODID_CATEGORY_EU_SPECIFIC',
  // The category for the UA, according to the EU specification, is the Certified category.
  MAV_ODID_CATEGORY_EU_CERTIFIED = 'MAV_ODID_CATEGORY_EU_CERTIFIED',
}

/**
 * Odid classification EU
 */
export enum MavOdidClassEu {
  // The class for the UA, according to the EU specification, is undeclared.
  MAV_ODID_CLASS_EU_UNDECLARED = 'MAV_ODID_CLASS_EU_UNDECLARED',
  // The class for the UA, according to the EU specification, is Class 0.
  MAV_ODID_CLASS_EU_CLASS_0 = 'MAV_ODID_CLASS_EU_CLASS_0',
  // The class for the UA, according to the EU specification, is Class 1.
  MAV_ODID_CLASS_EU_CLASS_1 = 'MAV_ODID_CLASS_EU_CLASS_1',
  // The class for the UA, according to the EU specification, is Class 2.
  MAV_ODID_CLASS_EU_CLASS_2 = 'MAV_ODID_CLASS_EU_CLASS_2',
  // The class for the UA, according to the EU specification, is Class 3.
  MAV_ODID_CLASS_EU_CLASS_3 = 'MAV_ODID_CLASS_EU_CLASS_3',
  // The class for the UA, according to the EU specification, is Class 4.
  MAV_ODID_CLASS_EU_CLASS_4 = 'MAV_ODID_CLASS_EU_CLASS_4',
  // The class for the UA, according to the EU specification, is Class 5.
  MAV_ODID_CLASS_EU_CLASS_5 = 'MAV_ODID_CLASS_EU_CLASS_5',
  // The class for the UA, according to the EU specification, is Class 6.
  MAV_ODID_CLASS_EU_CLASS_6 = 'MAV_ODID_CLASS_EU_CLASS_6',
}

/**
 * Odid operator ID type
 */
export enum MavOdidOperatorIdType {
  // CAA (Civil Aviation Authority) registered operator ID.
  MAV_ODID_OPERATOR_ID_TYPE_CAA = 'MAV_ODID_OPERATOR_ID_TYPE_CAA',
}

/**
 * Component capability flags (Bitmap)
 */
export enum ComponentCapFlags {
  // Component has parameters, and supports the parameter protocol (PARAM messages).
  COMPONENT_CAP_FLAGS_PARAM = 'COMPONENT_CAP_FLAGS_PARAM',
  // Component has parameters, and supports the extended parameter protocol (PARAM_EXT messages).
  COMPONENT_CAP_FLAGS_PARAM_EXT = 'COMPONENT_CAP_FLAGS_PARAM_EXT',
}

/**
 * Type of AIS vessel, enum duplicated from AIS standard, https://gpsd.gitlab.io/gpsd/AIVDM.html
 */
export enum AisType {
  // Not available (default).
  AIS_TYPE_UNKNOWN = 'AIS_TYPE_UNKNOWN',
  AIS_TYPE_RESERVED_1 = 'AIS_TYPE_RESERVED_1',
  AIS_TYPE_RESERVED_2 = 'AIS_TYPE_RESERVED_2',
  AIS_TYPE_RESERVED_3 = 'AIS_TYPE_RESERVED_3',
  AIS_TYPE_RESERVED_4 = 'AIS_TYPE_RESERVED_4',
  AIS_TYPE_RESERVED_5 = 'AIS_TYPE_RESERVED_5',
  AIS_TYPE_RESERVED_6 = 'AIS_TYPE_RESERVED_6',
  AIS_TYPE_RESERVED_7 = 'AIS_TYPE_RESERVED_7',
  AIS_TYPE_RESERVED_8 = 'AIS_TYPE_RESERVED_8',
  AIS_TYPE_RESERVED_9 = 'AIS_TYPE_RESERVED_9',
  AIS_TYPE_RESERVED_10 = 'AIS_TYPE_RESERVED_10',
  AIS_TYPE_RESERVED_11 = 'AIS_TYPE_RESERVED_11',
  AIS_TYPE_RESERVED_12 = 'AIS_TYPE_RESERVED_12',
  AIS_TYPE_RESERVED_13 = 'AIS_TYPE_RESERVED_13',
  AIS_TYPE_RESERVED_14 = 'AIS_TYPE_RESERVED_14',
  AIS_TYPE_RESERVED_15 = 'AIS_TYPE_RESERVED_15',
  AIS_TYPE_RESERVED_16 = 'AIS_TYPE_RESERVED_16',
  AIS_TYPE_RESERVED_17 = 'AIS_TYPE_RESERVED_17',
  AIS_TYPE_RESERVED_18 = 'AIS_TYPE_RESERVED_18',
  AIS_TYPE_RESERVED_19 = 'AIS_TYPE_RESERVED_19',
  // Wing In Ground effect.
  AIS_TYPE_WIG = 'AIS_TYPE_WIG',
  AIS_TYPE_WIG_HAZARDOUS_A = 'AIS_TYPE_WIG_HAZARDOUS_A',
  AIS_TYPE_WIG_HAZARDOUS_B = 'AIS_TYPE_WIG_HAZARDOUS_B',
  AIS_TYPE_WIG_HAZARDOUS_C = 'AIS_TYPE_WIG_HAZARDOUS_C',
  AIS_TYPE_WIG_HAZARDOUS_D = 'AIS_TYPE_WIG_HAZARDOUS_D',
  AIS_TYPE_WIG_RESERVED_1 = 'AIS_TYPE_WIG_RESERVED_1',
  AIS_TYPE_WIG_RESERVED_2 = 'AIS_TYPE_WIG_RESERVED_2',
  AIS_TYPE_WIG_RESERVED_3 = 'AIS_TYPE_WIG_RESERVED_3',
  AIS_TYPE_WIG_RESERVED_4 = 'AIS_TYPE_WIG_RESERVED_4',
  AIS_TYPE_WIG_RESERVED_5 = 'AIS_TYPE_WIG_RESERVED_5',
  AIS_TYPE_FISHING = 'AIS_TYPE_FISHING',
  AIS_TYPE_TOWING = 'AIS_TYPE_TOWING',
  // Towing: length exceeds 200m or breadth exceeds 25m.
  AIS_TYPE_TOWING_LARGE = 'AIS_TYPE_TOWING_LARGE',
  // Dredging or other underwater ops.
  AIS_TYPE_DREDGING = 'AIS_TYPE_DREDGING',
  AIS_TYPE_DIVING = 'AIS_TYPE_DIVING',
  AIS_TYPE_MILITARY = 'AIS_TYPE_MILITARY',
  AIS_TYPE_SAILING = 'AIS_TYPE_SAILING',
  AIS_TYPE_PLEASURE = 'AIS_TYPE_PLEASURE',
  AIS_TYPE_RESERVED_20 = 'AIS_TYPE_RESERVED_20',
  AIS_TYPE_RESERVED_21 = 'AIS_TYPE_RESERVED_21',
  // High Speed Craft.
  AIS_TYPE_HSC = 'AIS_TYPE_HSC',
  AIS_TYPE_HSC_HAZARDOUS_A = 'AIS_TYPE_HSC_HAZARDOUS_A',
  AIS_TYPE_HSC_HAZARDOUS_B = 'AIS_TYPE_HSC_HAZARDOUS_B',
  AIS_TYPE_HSC_HAZARDOUS_C = 'AIS_TYPE_HSC_HAZARDOUS_C',
  AIS_TYPE_HSC_HAZARDOUS_D = 'AIS_TYPE_HSC_HAZARDOUS_D',
  AIS_TYPE_HSC_RESERVED_1 = 'AIS_TYPE_HSC_RESERVED_1',
  AIS_TYPE_HSC_RESERVED_2 = 'AIS_TYPE_HSC_RESERVED_2',
  AIS_TYPE_HSC_RESERVED_3 = 'AIS_TYPE_HSC_RESERVED_3',
  AIS_TYPE_HSC_RESERVED_4 = 'AIS_TYPE_HSC_RESERVED_4',
  AIS_TYPE_HSC_UNKNOWN = 'AIS_TYPE_HSC_UNKNOWN',
  AIS_TYPE_PILOT = 'AIS_TYPE_PILOT',
  // Search And Rescue vessel.
  AIS_TYPE_SAR = 'AIS_TYPE_SAR',
  AIS_TYPE_TUG = 'AIS_TYPE_TUG',
  AIS_TYPE_PORT_TENDER = 'AIS_TYPE_PORT_TENDER',
  // Anti-pollution equipment.
  AIS_TYPE_ANTI_POLLUTION = 'AIS_TYPE_ANTI_POLLUTION',
  AIS_TYPE_LAW_ENFORCEMENT = 'AIS_TYPE_LAW_ENFORCEMENT',
  AIS_TYPE_SPARE_LOCAL_1 = 'AIS_TYPE_SPARE_LOCAL_1',
  AIS_TYPE_SPARE_LOCAL_2 = 'AIS_TYPE_SPARE_LOCAL_2',
  AIS_TYPE_MEDICAL_TRANSPORT = 'AIS_TYPE_MEDICAL_TRANSPORT',
  // Noncombatant ship according to RR Resolution No. 18.
  AIS_TYPE_NONECOMBATANT = 'AIS_TYPE_NONECOMBATANT',
  AIS_TYPE_PASSENGER = 'AIS_TYPE_PASSENGER',
  AIS_TYPE_PASSENGER_HAZARDOUS_A = 'AIS_TYPE_PASSENGER_HAZARDOUS_A',
  AIS_TYPE_PASSENGER_HAZARDOUS_B = 'AIS_TYPE_PASSENGER_HAZARDOUS_B',
  AIS_TYPE_AIS_TYPE_PASSENGER_HAZARDOUS_C = 'AIS_TYPE_AIS_TYPE_PASSENGER_HAZARDOUS_C',
  AIS_TYPE_PASSENGER_HAZARDOUS_D = 'AIS_TYPE_PASSENGER_HAZARDOUS_D',
  AIS_TYPE_PASSENGER_RESERVED_1 = 'AIS_TYPE_PASSENGER_RESERVED_1',
  AIS_TYPE_PASSENGER_RESERVED_2 = 'AIS_TYPE_PASSENGER_RESERVED_2',
  AIS_TYPE_PASSENGER_RESERVED_3 = 'AIS_TYPE_PASSENGER_RESERVED_3',
  AIS_TYPE_AIS_TYPE_PASSENGER_RESERVED_4 = 'AIS_TYPE_AIS_TYPE_PASSENGER_RESERVED_4',
  AIS_TYPE_PASSENGER_UNKNOWN = 'AIS_TYPE_PASSENGER_UNKNOWN',
  AIS_TYPE_CARGO = 'AIS_TYPE_CARGO',
  AIS_TYPE_CARGO_HAZARDOUS_A = 'AIS_TYPE_CARGO_HAZARDOUS_A',
  AIS_TYPE_CARGO_HAZARDOUS_B = 'AIS_TYPE_CARGO_HAZARDOUS_B',
  AIS_TYPE_CARGO_HAZARDOUS_C = 'AIS_TYPE_CARGO_HAZARDOUS_C',
  AIS_TYPE_CARGO_HAZARDOUS_D = 'AIS_TYPE_CARGO_HAZARDOUS_D',
  AIS_TYPE_CARGO_RESERVED_1 = 'AIS_TYPE_CARGO_RESERVED_1',
  AIS_TYPE_CARGO_RESERVED_2 = 'AIS_TYPE_CARGO_RESERVED_2',
  AIS_TYPE_CARGO_RESERVED_3 = 'AIS_TYPE_CARGO_RESERVED_3',
  AIS_TYPE_CARGO_RESERVED_4 = 'AIS_TYPE_CARGO_RESERVED_4',
  AIS_TYPE_CARGO_UNKNOWN = 'AIS_TYPE_CARGO_UNKNOWN',
  AIS_TYPE_TANKER = 'AIS_TYPE_TANKER',
  AIS_TYPE_TANKER_HAZARDOUS_A = 'AIS_TYPE_TANKER_HAZARDOUS_A',
  AIS_TYPE_TANKER_HAZARDOUS_B = 'AIS_TYPE_TANKER_HAZARDOUS_B',
  AIS_TYPE_TANKER_HAZARDOUS_C = 'AIS_TYPE_TANKER_HAZARDOUS_C',
  AIS_TYPE_TANKER_HAZARDOUS_D = 'AIS_TYPE_TANKER_HAZARDOUS_D',
  AIS_TYPE_TANKER_RESERVED_1 = 'AIS_TYPE_TANKER_RESERVED_1',
  AIS_TYPE_TANKER_RESERVED_2 = 'AIS_TYPE_TANKER_RESERVED_2',
  AIS_TYPE_TANKER_RESERVED_3 = 'AIS_TYPE_TANKER_RESERVED_3',
  AIS_TYPE_TANKER_RESERVED_4 = 'AIS_TYPE_TANKER_RESERVED_4',
  AIS_TYPE_TANKER_UNKNOWN = 'AIS_TYPE_TANKER_UNKNOWN',
  AIS_TYPE_OTHER = 'AIS_TYPE_OTHER',
  AIS_TYPE_OTHER_HAZARDOUS_A = 'AIS_TYPE_OTHER_HAZARDOUS_A',
  AIS_TYPE_OTHER_HAZARDOUS_B = 'AIS_TYPE_OTHER_HAZARDOUS_B',
  AIS_TYPE_OTHER_HAZARDOUS_C = 'AIS_TYPE_OTHER_HAZARDOUS_C',
  AIS_TYPE_OTHER_HAZARDOUS_D = 'AIS_TYPE_OTHER_HAZARDOUS_D',
  AIS_TYPE_OTHER_RESERVED_1 = 'AIS_TYPE_OTHER_RESERVED_1',
  AIS_TYPE_OTHER_RESERVED_2 = 'AIS_TYPE_OTHER_RESERVED_2',
  AIS_TYPE_OTHER_RESERVED_3 = 'AIS_TYPE_OTHER_RESERVED_3',
  AIS_TYPE_OTHER_RESERVED_4 = 'AIS_TYPE_OTHER_RESERVED_4',
  AIS_TYPE_OTHER_UNKNOWN = 'AIS_TYPE_OTHER_UNKNOWN',
}

/**
 * Navigational status of AIS vessel, enum duplicated from AIS standard, https://gpsd.gitlab.io/gpsd/AIVDM.html
 */
export enum AisNavStatus {
  // Under way using engine.
  UNDER_WAY = 'UNDER_WAY',
  AIS_NAV_ANCHORED = 'AIS_NAV_ANCHORED',
  AIS_NAV_UN_COMMANDED = 'AIS_NAV_UN_COMMANDED',
  AIS_NAV_RESTRICTED_MANOEUVERABILITY = 'AIS_NAV_RESTRICTED_MANOEUVERABILITY',
  AIS_NAV_DRAUGHT_CONSTRAINED = 'AIS_NAV_DRAUGHT_CONSTRAINED',
  AIS_NAV_MOORED = 'AIS_NAV_MOORED',
  AIS_NAV_AGROUND = 'AIS_NAV_AGROUND',
  AIS_NAV_FISHING = 'AIS_NAV_FISHING',
  AIS_NAV_SAILING = 'AIS_NAV_SAILING',
  AIS_NAV_RESERVED_HSC = 'AIS_NAV_RESERVED_HSC',
  AIS_NAV_RESERVED_WIG = 'AIS_NAV_RESERVED_WIG',
  AIS_NAV_RESERVED_1 = 'AIS_NAV_RESERVED_1',
  AIS_NAV_RESERVED_2 = 'AIS_NAV_RESERVED_2',
  AIS_NAV_RESERVED_3 = 'AIS_NAV_RESERVED_3',
  // Search And Rescue Transponder.
  AIS_NAV_AIS_SART = 'AIS_NAV_AIS_SART',
  // Not available (default).
  AIS_NAV_UNKNOWN = 'AIS_NAV_UNKNOWN',
}

/**
 * List of possible units where failures can be injected.
 */
export enum FailureUnit {
  FAILURE_UNIT_SENSOR_GYRO = 'FAILURE_UNIT_SENSOR_GYRO',
  FAILURE_UNIT_SENSOR_ACCEL = 'FAILURE_UNIT_SENSOR_ACCEL',
  FAILURE_UNIT_SENSOR_MAG = 'FAILURE_UNIT_SENSOR_MAG',
  FAILURE_UNIT_SENSOR_BARO = 'FAILURE_UNIT_SENSOR_BARO',
  FAILURE_UNIT_SENSOR_GPS = 'FAILURE_UNIT_SENSOR_GPS',
  FAILURE_UNIT_SENSOR_OPTICAL_FLOW = 'FAILURE_UNIT_SENSOR_OPTICAL_FLOW',
  FAILURE_UNIT_SENSOR_VIO = 'FAILURE_UNIT_SENSOR_VIO',
  FAILURE_UNIT_SENSOR_DISTANCE_SENSOR = 'FAILURE_UNIT_SENSOR_DISTANCE_SENSOR',
  FAILURE_UNIT_SENSOR_AIRSPEED = 'FAILURE_UNIT_SENSOR_AIRSPEED',
  FAILURE_UNIT_SYSTEM_BATTERY = 'FAILURE_UNIT_SYSTEM_BATTERY',
  FAILURE_UNIT_SYSTEM_MOTOR = 'FAILURE_UNIT_SYSTEM_MOTOR',
  FAILURE_UNIT_SYSTEM_SERVO = 'FAILURE_UNIT_SYSTEM_SERVO',
  FAILURE_UNIT_SYSTEM_AVOIDANCE = 'FAILURE_UNIT_SYSTEM_AVOIDANCE',
  FAILURE_UNIT_SYSTEM_RC_SIGNAL = 'FAILURE_UNIT_SYSTEM_RC_SIGNAL',
  FAILURE_UNIT_SYSTEM_MAVLINK_SIGNAL = 'FAILURE_UNIT_SYSTEM_MAVLINK_SIGNAL',
}

/**
 * List of possible failure type to inject.
 */
export enum FailureType {
  // No failure injected, used to reset a previous failure.
  FAILURE_TYPE_OK = 'FAILURE_TYPE_OK',
  // Sets unit off, so completely non-responsive.
  FAILURE_TYPE_OFF = 'FAILURE_TYPE_OFF',
  // Unit is stuck e.g. keeps reporting the same value.
  FAILURE_TYPE_STUCK = 'FAILURE_TYPE_STUCK',
  // Unit is reporting complete garbage.
  FAILURE_TYPE_GARBAGE = 'FAILURE_TYPE_GARBAGE',
  // Unit is consistently wrong.
  FAILURE_TYPE_WRONG = 'FAILURE_TYPE_WRONG',
  // Unit is slow, so e.g. reporting at slower than expected rate.
  FAILURE_TYPE_SLOW = 'FAILURE_TYPE_SLOW',
  // Data of unit is delayed in time.
  FAILURE_TYPE_DELAYED = 'FAILURE_TYPE_DELAYED',
  // Unit is sometimes working, sometimes not.
  FAILURE_TYPE_INTERMITTENT = 'FAILURE_TYPE_INTERMITTENT',
}

/**
 * Acceleration vehicle position
 */
export enum AccelcalVehiclePos {
  ACCELCAL_VEHICLE_POS_LEVEL = 'ACCELCAL_VEHICLE_POS_LEVEL',
  ACCELCAL_VEHICLE_POS_LEFT = 'ACCELCAL_VEHICLE_POS_LEFT',
  ACCELCAL_VEHICLE_POS_RIGHT = 'ACCELCAL_VEHICLE_POS_RIGHT',
  ACCELCAL_VEHICLE_POS_NOSEDOWN = 'ACCELCAL_VEHICLE_POS_NOSEDOWN',
  ACCELCAL_VEHICLE_POS_NOSEUP = 'ACCELCAL_VEHICLE_POS_NOSEUP',
  ACCELCAL_VEHICLE_POS_BACK = 'ACCELCAL_VEHICLE_POS_BACK',
  ACCELCAL_VEHICLE_POS_SUCCESS = 'ACCELCAL_VEHICLE_POS_SUCCESS',
  ACCELCAL_VEHICLE_POS_FAILED = 'ACCELCAL_VEHICLE_POS_FAILED',
}

/**
 *
 */
export enum ScriptingCmd {
  // Start a REPL session.
  SCRIPTING_CMD_REPL_START = 'SCRIPTING_CMD_REPL_START',
  // End a REPL session.
  SCRIPTING_CMD_REPL_STOP = 'SCRIPTING_CMD_REPL_STOP',
}

/**
 *
 */
export enum LimitsState {
  // Pre-initialization.
  LIMITS_INIT = 'LIMITS_INIT',
  // Disabled.
  LIMITS_DISABLED = 'LIMITS_DISABLED',
  // Checking limits.
  LIMITS_ENABLED = 'LIMITS_ENABLED',
  // A limit has been breached.
  LIMITS_TRIGGERED = 'LIMITS_TRIGGERED',
  // Taking action e.g. Return/RTL.
  LIMITS_RECOVERING = 'LIMITS_RECOVERING',
  // We're no longer in breach of a limit.
  LIMITS_RECOVERED = 'LIMITS_RECOVERED',
}

/**
 * Gripper actions.
 */
export enum GripperActions {
  // Gripper release cargo.
  GRIPPER_ACTION_RELEASE = 'GRIPPER_ACTION_RELEASE',
  // Gripper grab onto cargo.
  GRIPPER_ACTION_GRAB = 'GRIPPER_ACTION_GRAB',
}

/**
 * Winch actions.
 */
export enum WinchActions {
  // Relax winch.
  WINCH_RELAXED = 'WINCH_RELAXED',
  // Winch unwinds or winds specified length of cable optionally using specified rate.
  WINCH_RELATIVE_LENGTH_CONTROL = 'WINCH_RELATIVE_LENGTH_CONTROL',
  // Winch unwinds or winds cable at specified rate in meters/seconds.
  WINCH_RATE_CONTROL = 'WINCH_RATE_CONTROL',
}

/**
 * Camera status type
 */
export enum CameraStatusTypes {
  // Camera heartbeat, announce camera component ID at 1Hz.
  CAMERA_STATUS_TYPE_HEARTBEAT = 'CAMERA_STATUS_TYPE_HEARTBEAT',
  // Camera image triggered.
  CAMERA_STATUS_TYPE_TRIGGER = 'CAMERA_STATUS_TYPE_TRIGGER',
  // Camera connection lost.
  CAMERA_STATUS_TYPE_DISCONNECT = 'CAMERA_STATUS_TYPE_DISCONNECT',
  // Camera unknown error.
  CAMERA_STATUS_TYPE_ERROR = 'CAMERA_STATUS_TYPE_ERROR',
  // Camera battery low. Parameter p1 shows reported voltage.
  CAMERA_STATUS_TYPE_LOWBATT = 'CAMERA_STATUS_TYPE_LOWBATT',
  // Camera storage low. Parameter p1 shows reported shots remaining.
  CAMERA_STATUS_TYPE_LOWSTORE = 'CAMERA_STATUS_TYPE_LOWSTORE',
  // Camera storage low. Parameter p1 shows reported video minutes remaining.
  CAMERA_STATUS_TYPE_LOWSTOREV = 'CAMERA_STATUS_TYPE_LOWSTOREV',
}

/**
 * Camera feedback flags
 */
export enum CameraFeedbackFlags {
  // Shooting photos, not video.
  CAMERA_FEEDBACK_PHOTO = 'CAMERA_FEEDBACK_PHOTO',
  // Shooting video, not stills.
  CAMERA_FEEDBACK_VIDEO = 'CAMERA_FEEDBACK_VIDEO',
  // Unable to achieve requested exposure (e.g. shutter speed too low).
  CAMERA_FEEDBACK_BADEXPOSURE = 'CAMERA_FEEDBACK_BADEXPOSURE',
  // Closed loop feedback from camera, we know for sure it has successfully taken a picture.
  CAMERA_FEEDBACK_CLOSEDLOOP = 'CAMERA_FEEDBACK_CLOSEDLOOP',
  // Open loop camera, an image trigger has been requested but we can't know for sure it has successfully taken a picture.
  CAMERA_FEEDBACK_OPENLOOP = 'CAMERA_FEEDBACK_OPENLOOP',
}

/**
 * Gimbal mode
 */
export enum MavModeGimbal {
  // Gimbal is powered on but has not started initializing yet.
  MAV_MODE_GIMBAL_UNINITIALIZED = 'MAV_MODE_GIMBAL_UNINITIALIZED',
  // Gimbal is currently running calibration on the pitch axis.
  MAV_MODE_GIMBAL_CALIBRATING_PITCH = 'MAV_MODE_GIMBAL_CALIBRATING_PITCH',
  // Gimbal is currently running calibration on the roll axis.
  MAV_MODE_GIMBAL_CALIBRATING_ROLL = 'MAV_MODE_GIMBAL_CALIBRATING_ROLL',
  // Gimbal is currently running calibration on the yaw axis.
  MAV_MODE_GIMBAL_CALIBRATING_YAW = 'MAV_MODE_GIMBAL_CALIBRATING_YAW',
  // Gimbal has finished calibrating and initializing, but is relaxed pending reception of first rate command from copter.
  MAV_MODE_GIMBAL_INITIALIZED = 'MAV_MODE_GIMBAL_INITIALIZED',
  // Gimbal is actively stabilizing.
  MAV_MODE_GIMBAL_ACTIVE = 'MAV_MODE_GIMBAL_ACTIVE',
  // Gimbal is relaxed because it missed more than 10 expected rate command messages in a row. Gimbal will move back to active mode when it receives a new rate command.
  MAV_MODE_GIMBAL_RATE_CMD_TIMEOUT = 'MAV_MODE_GIMBAL_RATE_CMD_TIMEOUT',
}

/**
 *Gimbal axis
 */
export enum GimbalAxis {
  // Gimbal yaw axis.
  GIMBAL_AXIS_YAW = 'GIMBAL_AXIS_YAW',
  // Gimbal pitch axis.
  GIMBAL_AXIS_PITCH = 'GIMBAL_AXIS_PITCH',
  // Gimbal roll axis.
  GIMBAL_AXIS_ROLL = 'GIMBAL_AXIS_ROLL',
}

/**
 * Gimbal axis calibration status
 */
export enum GimbalAxisCalibrationStatus {
  // Axis calibration is in progress.
  GIMBAL_AXIS_CALIBRATION_STATUS_IN_PROGRESS = 'GIMBAL_AXIS_CALIBRATION_STATUS_IN_PROGRESS',
  // Axis calibration succeeded.
  GIMBAL_AXIS_CALIBRATION_STATUS_SUCCEEDED = 'GIMBAL_AXIS_CALIBRATION_STATUS_SUCCEEDED',
  // Axis calibration failed.
  GIMBAL_AXIS_CALIBRATION_STATUS_FAILED = 'GIMBAL_AXIS_CALIBRATION_STATUS_FAILED',
}

/**
 *Gimbal axis calibration required
 */
export enum GimbalAxisCalibrationRequired {
  // Whether or not this axis requires calibration is unknown at this time.
  GIMBAL_AXIS_CALIBRATION_REQUIRED_UNKNOWN = 'GIMBAL_AXIS_CALIBRATION_REQUIRED_UNKNOWN',
  // This axis requires calibration.
  GIMBAL_AXIS_CALIBRATION_REQUIRED_TRUE = 'GIMBAL_AXIS_CALIBRATION_REQUIRED_TRUE',
  // This axis does not require calibration.
  GIMBAL_AXIS_CALIBRATION_REQUIRED_FALSE = 'GIMBAL_AXIS_CALIBRATION_REQUIRED_FALSE',
}

/**
 * Gopro Heartbeat statu
 */
export enum GoproHeartbeatStatus {
  // No GoPro connected.
  GOPRO_HEARTBEAT_STATUS_DISCONNECTED = 'GOPRO_HEARTBEAT_STATUS_DISCONNECTED',
  // The detected GoPro is not HeroBus compatible.
  GOPRO_HEARTBEAT_STATUS_INCOMPATIBLE = 'GOPRO_HEARTBEAT_STATUS_INCOMPATIBLE',
  // A HeroBus compatible GoPro is connected.
  GOPRO_HEARTBEAT_STATUS_CONNECTED = 'GOPRO_HEARTBEAT_STATUS_CONNECTED',
  // An unrecoverable error was encountered with the connected GoPro, it may require a power cycle.
  GOPRO_HEARTBEAT_STATUS_ERROR = 'GOPRO_HEARTBEAT_STATUS_ERROR',
}

/**
 * Gopro request status
 */
export enum GoproRequestStatus {
  // The write message with ID indicated succeeded.
  GOPRO_REQUEST_SUCCESS = 'GOPRO_REQUEST_SUCCESS',
  // The write message with ID indicated failed.
  GOPRO_REQUEST_FAILED = 'GOPRO_REQUEST_FAILED',
}

/**
 * Gopro command
 */
export enum GoproCommand {
  // (Get/Set).
  GOPRO_COMMAND_POWER = 'GOPRO_COMMAND_POWER',
  // (Get/Set).
  GOPRO_COMMAND_CAPTURE_MODE = 'GOPRO_COMMAND_CAPTURE_MODE',
  // (___/Set).
  GOPRO_COMMAND_SHUTTER = 'GOPRO_COMMAND_SHUTTER',
  // (Get/___).
  GOPRO_COMMAND_BATTERY = 'GOPRO_COMMAND_BATTERY',
  // (Get/___).
  GOPRO_COMMAND_MODEL = 'GOPRO_COMMAND_MODEL',
  // (Get/Set).
  GOPRO_COMMAND_VIDEO_SETTINGS = 'GOPRO_COMMAND_VIDEO_SETTINGS',
  // (Get/Set).
  GOPRO_COMMAND_LOW_LIGHT = 'GOPRO_COMMAND_LOW_LIGHT',
  // (Get/Set).
  GOPRO_COMMAND_PHOTO_RESOLUTION = 'GOPRO_COMMAND_PHOTO_RESOLUTION',
  // (Get/Set).
  GOPRO_COMMAND_PHOTO_BURST_RATE = 'GOPRO_COMMAND_PHOTO_BURST_RATE',
  // (Get/Set).
  GOPRO_COMMAND_PROTUNE = 'GOPRO_COMMAND_PROTUNE',
  // (Get/Set) Hero 3+ Only.
  GOPRO_COMMAND_PROTUNE_WHITE_BALANCE = 'GOPRO_COMMAND_PROTUNE_WHITE_BALANCE',
  // (Get/Set) Hero 3+ Only.
  GOPRO_COMMAND_PROTUNE_COLOUR = 'GOPRO_COMMAND_PROTUNE_COLOUR',
  // (Get/Set) Hero 3+ Only.
  GOPRO_COMMAND_PROTUNE_GAIN = 'GOPRO_COMMAND_PROTUNE_GAIN',
  // (Get/Set) Hero 3+ Only.
  GOPRO_COMMAND_PROTUNE_SHARPNESS = 'GOPRO_COMMAND_PROTUNE_SHARPNESS',
  // (Get/Set) Hero 3+ Only.
  GOPRO_COMMAND_PROTUNE_EXPOSURE = 'GOPRO_COMMAND_PROTUNE_EXPOSURE',
  // (Get/Set).
  GOPRO_COMMAND_TIME = 'GOPRO_COMMAND_TIME',
  // (Get/Set).
  GOPRO_COMMAND_CHARGING = 'GOPRO_COMMAND_CHARGING',
}

/**
 * Gopro capture mode
 */
export enum GoproCaptureMode {
  // Video mode.
  GOPRO_CAPTURE_MODE_VIDEO = 'GOPRO_CAPTURE_MODE_VIDEO',
  // Photo mode.
  GOPRO_CAPTURE_MODE_PHOTO = 'GOPRO_CAPTURE_MODE_PHOTO',
  // Burst mode, Hero 3+ only.
  GOPRO_CAPTURE_MODE_BURST = 'GOPRO_CAPTURE_MODE_BURST',
  // Time lapse mode, Hero 3+ only.
  GOPRO_CAPTURE_MODE_TIME_LAPSE = 'GOPRO_CAPTURE_MODE_TIME_LAPSE',
  // Multi shot mode, Hero 4 only.
  GOPRO_CAPTURE_MODE_MULTI_SHOT = 'GOPRO_CAPTURE_MODE_MULTI_SHOT',
  // Playback mode, Hero 4 only, silver only except when LCD or HDMI is connected to black.
  GOPRO_CAPTURE_MODE_PLAYBACK = 'GOPRO_CAPTURE_MODE_PLAYBACK',
  // Playback mode, Hero 4 only.
  GOPRO_CAPTURE_MODE_SETUP = 'GOPRO_CAPTURE_MODE_SETUP',
  // Mode not yet known.
  GOPRO_CAPTURE_MODE_UNKNOWN = 'GOPRO_CAPTURE_MODE_UNKNOWN',
}

/**
 * Gopro Resolution
 */
export enum GoproResolution {
  // 848 x 480 (480p).
  GOPRO_RESOLUTION_480p = 'GOPRO_RESOLUTION_480p',
  // 1280 x 720 (720p).
  GOPRO_RESOLUTION_720p = 'GOPRO_RESOLUTION_720p',
  // 1280 x 960 (960p).
  GOPRO_RESOLUTION_960p = 'GOPRO_RESOLUTION_960p',
  // 1920 x 1080 (1080p).
  GOPRO_RESOLUTION_1080p = 'GOPRO_RESOLUTION_1080p',
  // 1920 x 1440 (1440p).
  GOPRO_RESOLUTION_1440p = 'GOPRO_RESOLUTION_1440p',
  // 2704 x 1440 (2.7k-17:9).
  GOPRO_RESOLUTION_2_7k_17_9 = 'GOPRO_RESOLUTION_2_7k_17_9',
  // 2704 x 1524 (2.7k-16:9).
  GOPRO_RESOLUTION_2_7k_16_9 = 'GOPRO_RESOLUTION_2_7k_16_9',
  // 2704 x 2028 (2.7k-4:3).
  GOPRO_RESOLUTION_2_7k_4_3 = 'GOPRO_RESOLUTION_2_7k_4_3',
  // 3840 x 2160 (4k-16:9).
  GOPRO_RESOLUTION_4k_16_9 = 'GOPRO_RESOLUTION_4k_16_9',
  // 4096 x 2160 (4k-17:9).
  GOPRO_RESOLUTION_4k_17_9 = 'GOPRO_RESOLUTION_4k_17_9',
  // 1280 x 720 (720p-SuperView).
  GOPRO_RESOLUTION_720p_SUPERVIEW = 'GOPRO_RESOLUTION_720p_SUPERVIEW',
  // 1920 x 1080 (1080p-SuperView).
  GOPRO_RESOLUTION_1080p_SUPERVIEW = 'GOPRO_RESOLUTION_1080p_SUPERVIEW',
  // 2704 x 1520 (2.7k-SuperView).
  GOPRO_RESOLUTION_2_7k_SUPERVIEW = 'GOPRO_RESOLUTION_2_7k_SUPERVIEW',
  // 3840 x 2160 (4k-SuperView).
  GOPRO_RESOLUTION_4k_SUPERVIEW = 'GOPRO_RESOLUTION_4k_SUPERVIEW',
}

/**
 * Gopro Framerate
 */
export enum GoproFrameRate {
  // 12 FPS.
  GOPRO_FRAME_RATE_12 = 'GOPRO_FRAME_RATE_12',
  // 15 FPS.
  GOPRO_FRAME_RATE_15 = 'GOPRO_FRAME_RATE_15',
  // 24 FPS.
  GOPRO_FRAME_RATE_24 = 'GOPRO_FRAME_RATE_24',
  // 25 FPS.
  GOPRO_FRAME_RATE_25 = 'GOPRO_FRAME_RATE_25',
  // 30 FPS.
  GOPRO_FRAME_RATE_30 = 'GOPRO_FRAME_RATE_30',
  // 48 FPS.
  GOPRO_FRAME_RATE_48 = 'GOPRO_FRAME_RATE_48',
  // 50 FPS.
  GOPRO_FRAME_RATE_50 = 'GOPRO_FRAME_RATE_50',
  // 60 FPS.
  GOPRO_FRAME_RATE_60 = 'GOPRO_FRAME_RATE_60',
  // 80 FPS.
  GOPRO_FRAME_RATE_80 = 'GOPRO_FRAME_RATE_80',
  // 90 FPS.
  GOPRO_FRAME_RATE_90 = 'GOPRO_FRAME_RATE_90',
  // 100 FPS.
  GOPRO_FRAME_RATE_100 = 'GOPRO_FRAME_RATE_100',
  // 120 FPS.
  GOPRO_FRAME_RATE_120 = 'GOPRO_FRAME_RATE_120',
  // 240 FPS.
  GOPRO_FRAME_RATE_240 = 'GOPRO_FRAME_RATE_240',
  // 12.5 FPS.
  GOPRO_FRAME_RATE_12_5 = 'GOPRO_FRAME_RATE_12_5',
}

/**
 * Gopro field of view
 */
export enum GoproFieldOfView {
  // 0x00: Wide.
  GOPRO_FIELD_OF_VIEW_WIDE = 'GOPRO_FIELD_OF_VIEW_WIDE',
  // 0x01: Medium.
  GOPRO_FIELD_OF_VIEW_MEDIUM = 'GOPRO_FIELD_OF_VIEW_MEDIUM',
  // 0x02: Narrow.
  GOPRO_FIELD_OF_VIEW_NARROW = 'GOPRO_FIELD_OF_VIEW_NARROW',
}

/**
 * Gopro video settings flags
 */
export enum GoproVideoSettingsFlags {
  // 0=NTSC, 1=PAL.
  GOPRO_VIDEO_SETTINGS_TV_MODE = 'GOPRO_VIDEO_SETTINGS_TV_MODE',
}

/**
 * Gopro photo resolution
 */
export enum GoproPhotoResolution {
  // 5MP Medium.
  GOPRO_PHOTO_RESOLUTION_5MP_MEDIUM = 'GOPRO_PHOTO_RESOLUTION_5MP_MEDIUM',
  // 7MP Medium.
  GOPRO_PHOTO_RESOLUTION_7MP_MEDIUM = 'GOPRO_PHOTO_RESOLUTION_7MP_MEDIUM',
  // 7MP Wide.
  GOPRO_PHOTO_RESOLUTION_7MP_WIDE = 'GOPRO_PHOTO_RESOLUTION_7MP_WIDE',
  // 10MP Wide.
  GOPRO_PHOTO_RESOLUTION_10MP_WIDE = 'GOPRO_PHOTO_RESOLUTION_10MP_WIDE',
  // 12MP Wide.
  GOPRO_PHOTO_RESOLUTION_12MP_WIDE = 'GOPRO_PHOTO_RESOLUTION_12MP_WIDE',
}

/**
 * Gopro protune white balance
 */
export enum GoproProtuneWhiteBalance {
  // Auto.
  GOPRO_PROTUNE_WHITE_BALANCE_AUTO = 'GOPRO_PROTUNE_WHITE_BALANCE_AUTO',
  // 3000K.
  GOPRO_PROTUNE_WHITE_BALANCE_3000K = 'GOPRO_PROTUNE_WHITE_BALANCE_3000K',
  // 5500K.
  GOPRO_PROTUNE_WHITE_BALANCE_5500K = 'GOPRO_PROTUNE_WHITE_BALANCE_5500K',
  // 6500K.
  GOPRO_PROTUNE_WHITE_BALANCE_6500K = 'GOPRO_PROTUNE_WHITE_BALANCE_6500K',
  // Camera Raw.
  GOPRO_PROTUNE_WHITE_BALANCE_RAW = 'GOPRO_PROTUNE_WHITE_BALANCE_RAW',
}

/**
 * Gopro protune colour
 */
export enum GoproProtuneColour {
  // Auto.
  GOPRO_PROTUNE_COLOUR_STANDARD = 'GOPRO_PROTUNE_COLOUR_STANDARD',
  // Neutral.
  GOPRO_PROTUNE_COLOUR_NEUTRAL = 'GOPRO_PROTUNE_COLOUR_NEUTRAL',
}

/**
 * Gopro protune gain
 */
export enum GoproProtuneGain {
  // ISO 400.
  GOPRO_PROTUNE_GAIN_400 = 'GOPRO_PROTUNE_GAIN_400',
  // ISO 800 (Only Hero 4).
  GOPRO_PROTUNE_GAIN_800 = 'GOPRO_PROTUNE_GAIN_800',
  // ISO 1600.
  GOPRO_PROTUNE_GAIN_1600 = 'GOPRO_PROTUNE_GAIN_1600',
  // ISO 3200 (Only Hero 4).
  GOPRO_PROTUNE_GAIN_3200 = 'GOPRO_PROTUNE_GAIN_3200',
  // ISO 6400.
  GOPRO_PROTUNE_GAIN_6400 = 'GOPRO_PROTUNE_GAIN_6400',
}

/**
 * Gopro protune sharpness
 */
export enum GoproProtuneSharpness {
  // Low Sharpness.
  GOPRO_PROTUNE_SHARPNESS_LOW = 'GOPRO_PROTUNE_SHARPNESS_LOW',
  // Medium Sharpness.
  GOPRO_PROTUNE_SHARPNESS_MEDIUM = 'GOPRO_PROTUNE_SHARPNESS_MEDIUM',
  // High Sharpness.
  GOPRO_PROTUNE_SHARPNESS_HIGH = 'GOPRO_PROTUNE_SHARPNESS_HIGH',
}

/**
 * Gopro protune exposure
 */
export enum GoproProtuneExposure {
  // -5.0 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_NEG_5_0 = 'GOPRO_PROTUNE_EXPOSURE_NEG_5_0',
  // -4.5 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_NEG_4_5 = 'GOPRO_PROTUNE_EXPOSURE_NEG_4_5',
  // -4.0 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_NEG_4_0 = 'GOPRO_PROTUNE_EXPOSURE_NEG_4_0',
  // -3.5 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_NEG_3_5 = 'GOPRO_PROTUNE_EXPOSURE_NEG_3_5',
  // -3.0 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_NEG_3_0 = 'GOPRO_PROTUNE_EXPOSURE_NEG_3_0',
  // -2.5 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_NEG_2_5 = 'GOPRO_PROTUNE_EXPOSURE_NEG_2_5',
  // -2.0 EV.
  GOPRO_PROTUNE_EXPOSURE_NEG_2_0 = 'GOPRO_PROTUNE_EXPOSURE_NEG_2_0',
  // -1.5 EV.
  GOPRO_PROTUNE_EXPOSURE_NEG_1_5 = 'GOPRO_PROTUNE_EXPOSURE_NEG_1_5',
  // -1.0 EV.
  GOPRO_PROTUNE_EXPOSURE_NEG_1_0 = 'GOPRO_PROTUNE_EXPOSURE_NEG_1_0',
  // -0.5 EV.
  GOPRO_PROTUNE_EXPOSURE_NEG_0_5 = 'GOPRO_PROTUNE_EXPOSURE_NEG_0_5',
  // 0.0 EV.
  GOPRO_PROTUNE_EXPOSURE_ZERO = 'GOPRO_PROTUNE_EXPOSURE_ZERO',
  // +0.5 EV.
  GOPRO_PROTUNE_EXPOSURE_POS_0_5 = 'GOPRO_PROTUNE_EXPOSURE_POS_0_5',
  // +1.0 EV.
  GOPRO_PROTUNE_EXPOSURE_POS_1_0 = 'GOPRO_PROTUNE_EXPOSURE_POS_1_0',
  // +1.5 EV.
  GOPRO_PROTUNE_EXPOSURE_POS_1_5 = 'GOPRO_PROTUNE_EXPOSURE_POS_1_5',
  // +2.0 EV.
  GOPRO_PROTUNE_EXPOSURE_POS_2_0 = 'GOPRO_PROTUNE_EXPOSURE_POS_2_0',
  // +2.5 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_POS_2_5 = 'GOPRO_PROTUNE_EXPOSURE_POS_2_5',
  // +3.0 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_POS_3_0 = 'GOPRO_PROTUNE_EXPOSURE_POS_3_0',
  // +3.5 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_POS_3_5 = 'GOPRO_PROTUNE_EXPOSURE_POS_3_5',
  // +4.0 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_POS_4_0 = 'GOPRO_PROTUNE_EXPOSURE_POS_4_0',
  // +4.5 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_POS_4_5 = 'GOPRO_PROTUNE_EXPOSURE_POS_4_5',
  // +5.0 EV (Hero 3+ Only).
  GOPRO_PROTUNE_EXPOSURE_POS_5_0 = 'GOPRO_PROTUNE_EXPOSURE_POS_5_0',
}

/**
 * Gopro charging
 */
export enum GoproCharging {
  // Charging disabled.
  GOPRO_CHARGING_DISABLED = 'GOPRO_CHARGING_DISABLED',
  // Charging enabled.
  GOPRO_CHARGING_ENABLED = 'GOPRO_CHARGING_ENABLED',
}

/**
 * Gopro model
 */
export enum GoproModel {
  // Unknown gopro model.
  GOPRO_MODEL_UNKNOWN = 'GOPRO_MODEL_UNKNOWN',
  // Hero 3+ Silver (HeroBus not supported by GoPro).
  GOPRO_MODEL_HERO_3_PLUS_SILVER = 'GOPRO_MODEL_HERO_3_PLUS_SILVER',
  // Hero 3+ Black.
  GOPRO_MODEL_HERO_3_PLUS_BLACK = 'GOPRO_MODEL_HERO_3_PLUS_BLACK',
  // Hero 4 Silver.
  GOPRO_MODEL_HERO_4_SILVER = 'GOPRO_MODEL_HERO_4_SILVER',
  // Hero 4 Black.
  GOPRO_MODEL_HERO_4_BLACK = 'GOPRO_MODEL_HERO_4_BLACK',
}

/**
 * Gopro Burst rate
 */
export enum GoproBurstRate {
  // 3 Shots / 1 Second.
  GOPRO_BURST_RATE_3_IN_1_SECOND = 'GOPRO_BURST_RATE_3_IN_1_SECOND',
  // 5 Shots / 1 Second.
  GOPRO_BURST_RATE_5_IN_1_SECOND = 'GOPRO_BURST_RATE_5_IN_1_SECOND',
  // 10 Shots / 1 Second.
  GOPRO_BURST_RATE_10_IN_1_SECOND = 'GOPRO_BURST_RATE_10_IN_1_SECOND',
  // 10 Shots / 2 Second.
  GOPRO_BURST_RATE_10_IN_2_SECOND = 'GOPRO_BURST_RATE_10_IN_2_SECOND',
  // 10 Shots / 3 Second (Hero 4 Only).
  GOPRO_BURST_RATE_10_IN_3_SECOND = 'GOPRO_BURST_RATE_10_IN_3_SECOND',
  // 30 Shots / 1 Second.
  GOPRO_BURST_RATE_30_IN_1_SECOND = 'GOPRO_BURST_RATE_30_IN_1_SECOND',
  // 30 Shots / 2 Second.
  GOPRO_BURST_RATE_30_IN_2_SECOND = 'GOPRO_BURST_RATE_30_IN_2_SECOND',
  // 30 Shots / 3 Second.
  GOPRO_BURST_RATE_30_IN_3_SECOND = 'GOPRO_BURST_RATE_30_IN_3_SECOND',
  // 30 Shots / 6 Second.
  GOPRO_BURST_RATE_30_IN_6_SECOND = 'GOPRO_BURST_RATE_30_IN_6_SECOND',
}

/**
 *Led control pattern
 */
export enum LedControlPattern {
  // LED patterns off (return control to regular vehicle control).
  LED_CONTROL_PATTERN_OFF = 'LED_CONTROL_PATTERN_OFF',
  // LEDs show pattern during firmware update.
  LED_CONTROL_PATTERN_FIRMWAREUPDATE = 'LED_CONTROL_PATTERN_FIRMWAREUPDATE',
  // Custom Pattern using custom bytes fields.
  LED_CONTROL_PATTERN_CUSTOM = 'LED_CONTROL_PATTERN_CUSTOM',
}

/**
 * PID tuning axis
 */
export enum PidTuningAxis {
  PID_TUNING_ROLL = 'PID_TUNING_ROLL',
  PID_TUNING_PITCH = 'PID_TUNING_PITCH',
  PID_TUNING_YAW = 'PID_TUNING_YAW',
  PID_TUNING_ACCZ = 'PID_TUNING_ACCZ',
  PID_TUNING_STEER = 'PID_TUNING_STEER',
  PID_TUNING_LANDING = 'PID_TUNING_LANDING',
}

/**
 * Mag calibration status
 */
export enum MagCalStatus {
  MAG_CAL_NOT_STARTED = 'MAG_CAL_NOT_STARTED',
  MAG_CAL_WAITING_TO_START = 'MAG_CAL_WAITING_TO_START',
  MAG_CAL_RUNNING_STEP_ONE = 'MAG_CAL_RUNNING_STEP_ONE',
  MAG_CAL_RUNNING_STEP_TWO = 'MAG_CAL_RUNNING_STEP_TWO',
  MAG_CAL_SUCCESS = 'MAG_CAL_SUCCESS',
  MAG_CAL_FAILED = 'MAG_CAL_FAILED',
  MAG_CAL_BAD_ORIENTATION = 'MAG_CAL_BAD_ORIENTATION',
  MAG_CAL_BAD_RADIUS = 'MAG_CAL_BAD_RADIUS',
}

/**
 * Special ACK block numbers control activation of dataflash log streaming.
 */
export enum MavRemoteLogDataBlockCommands {
  // UAV to stop sending DataFlash blocks.
  MAV_REMOTE_LOG_DATA_BLOCK_STOP = 'MAV_REMOTE_LOG_DATA_BLOCK_STOP',
  // UAV to start sending DataFlash blocks.
  MAV_REMOTE_LOG_DATA_BLOCK_START = 'MAV_REMOTE_LOG_DATA_BLOCK_START',
}

/**
 * Possible remote log data block statuses.
 */
export enum MavRemoteLogDataBlockStatuses {
  // This block has NOT been received.
  MAV_REMOTE_LOG_DATA_BLOCK_NACK = 'MAV_REMOTE_LOG_DATA_BLOCK_NACK',
  // This block has been received.
  MAV_REMOTE_LOG_DATA_BLOCK_ACK = 'MAV_REMOTE_LOG_DATA_BLOCK_ACK',
}

/**
 * Bus types for device operations.
 */
export enum DeviceOpBustype {
  // I2C Device operation.
  DEVICE_OP_BUSTYPE_I2C = 'DEVICE_OP_BUSTYPE_I2C',
  // SPI Device operation.
  DEVICE_OP_BUSTYPE_SPI = 'DEVICE_OP_BUSTYPE_SPI',
}

/**
 * Deepstall flight stage.
 */
export enum DeepstallStage {
  // Flying to the landing point.
  DEEPSTALL_STAGE_FLY_TO_LANDING = 'DEEPSTALL_STAGE_FLY_TO_LANDING',
  // Building an estimate of the wind.
  DEEPSTALL_STAGE_ESTIMATE_WIND = 'DEEPSTALL_STAGE_ESTIMATE_WIND',
  // Waiting to breakout of the loiter to fly the approach.
  DEEPSTALL_STAGE_WAIT_FOR_BREAKOUT = 'DEEPSTALL_STAGE_WAIT_FOR_BREAKOUT',
  // Flying to the first arc point to turn around to the landing point.
  DEEPSTALL_STAGE_FLY_TO_ARC = 'DEEPSTALL_STAGE_FLY_TO_ARC',
  // Turning around back to the deepstall landing point.
  DEEPSTALL_STAGE_ARC = 'DEEPSTALL_STAGE_ARC',
  // Approaching the landing point.
  DEEPSTALL_STAGE_APPROACH = 'DEEPSTALL_STAGE_APPROACH',
  // Stalling and steering towards the land point.
  DEEPSTALL_STAGE_LAND = 'DEEPSTALL_STAGE_LAND',
}

/**
 * A mapping of plane flight modes for custom_mode field of heartbeat.
 */
export enum PlaneMode {
  PLANE_MODE_MANUAL = 'PLANE_MODE_MANUAL',
  PLANE_MODE_CIRCLE = 'PLANE_MODE_CIRCLE',
  PLANE_MODE_STABILIZE = 'PLANE_MODE_STABILIZE',
  PLANE_MODE_TRAINING = 'PLANE_MODE_TRAINING',
  PLANE_MODE_ACRO = 'PLANE_MODE_ACRO',
  PLANE_MODE_FLY_BY_WIRE_A = 'PLANE_MODE_FLY_BY_WIRE_A',
  PLANE_MODE_FLY_BY_WIRE_B = 'PLANE_MODE_FLY_BY_WIRE_B',
  PLANE_MODE_CRUISE = 'PLANE_MODE_CRUISE',
  PLANE_MODE_AUTOTUNE = 'PLANE_MODE_AUTOTUNE',
  PLANE_MODE_AUTO = 'PLANE_MODE_AUTO',
  PLANE_MODE_RTL = 'PLANE_MODE_RTL',
  PLANE_MODE_LOITER = 'PLANE_MODE_LOITER',
  PLANE_MODE_TAKEOFF = 'PLANE_MODE_TAKEOFF',
  PLANE_MODE_AVOID_ADSB = 'PLANE_MODE_AVOID_ADSB',
  PLANE_MODE_GUIDED = 'PLANE_MODE_GUIDED',
  PLANE_MODE_INITIALIZING = 'PLANE_MODE_INITIALIZING',
  PLANE_MODE_QSTABILIZE = 'PLANE_MODE_QSTABILIZE',
  PLANE_MODE_QHOVER = 'PLANE_MODE_QHOVER',
  PLANE_MODE_QLOITER = 'PLANE_MODE_QLOITER',
  PLANE_MODE_QLAND = 'PLANE_MODE_QLAND',
  PLANE_MODE_QRTL = 'PLANE_MODE_QRTL',
  PLANE_MODE_QAUTOTUNE = 'PLANE_MODE_QAUTOTUNE',
}

/**
 * A mapping of copter flight modes for custom_mode field of heartbeat.
 */
export enum CopterMode {
  COPTER_MODE_STABILIZE = 'COPTER_MODE_STABILIZE',
  COPTER_MODE_ACRO = 'COPTER_MODE_ACRO',
  COPTER_MODE_ALT_HOLD = 'COPTER_MODE_ALT_HOLD',
  COPTER_MODE_AUTO = 'COPTER_MODE_AUTO',
  COPTER_MODE_GUIDED = 'COPTER_MODE_GUIDED',
  COPTER_MODE_LOITER = 'COPTER_MODE_LOITER',
  COPTER_MODE_RTL = 'COPTER_MODE_RTL',
  COPTER_MODE_CIRCLE = 'COPTER_MODE_CIRCLE',
  COPTER_MODE_LAND = 'COPTER_MODE_LAND',
  COPTER_MODE_DRIFT = 'COPTER_MODE_DRIFT',
  COPTER_MODE_SPORT = 'COPTER_MODE_SPORT',
  COPTER_MODE_FLIP = 'COPTER_MODE_FLIP',
  COPTER_MODE_AUTOTUNE = 'COPTER_MODE_AUTOTUNE',
  COPTER_MODE_POSHOLD = 'COPTER_MODE_POSHOLD',
  COPTER_MODE_BRAKE = 'COPTER_MODE_BRAKE',
  COPTER_MODE_THROW = 'COPTER_MODE_THROW',
  COPTER_MODE_AVOID_ADSB = 'COPTER_MODE_AVOID_ADSB',
  COPTER_MODE_GUIDED_NOGPS = 'COPTER_MODE_GUIDED_NOGPS',
  COPTER_MODE_SMART_RTL = 'COPTER_MODE_SMART_RTL',
}

/**
 * A mapping of sub flight modes for custom_mode field of heartbeat.
 */
export enum SubMode {
  SUB_MODE_STABILIZE = 'SUB_MODE_STABILIZE',
  SUB_MODE_ACRO = 'SUB_MODE_ACRO',
  SUB_MODE_ALT_HOLD = 'SUB_MODE_ALT_HOLD',
  SUB_MODE_AUTO = 'SUB_MODE_AUTO',
  SUB_MODE_GUIDED = 'SUB_MODE_GUIDED',
  SUB_MODE_CIRCLE = 'SUB_MODE_CIRCLE',
  SUB_MODE_SURFACE = 'SUB_MODE_SURFACE',
  SUB_MODE_POSHOLD = 'SUB_MODE_POSHOLD',
  SUB_MODE_MANUAL = 'SUB_MODE_MANUAL',
}

/**
 * A mapping of rover flight modes for custom_mode field of heartbeat.
 */
export enum RoverMode {
  ROVER_MODE_MANUAL = 'ROVER_MODE_MANUAL',
  ROVER_MODE_ACRO = 'ROVER_MODE_ACRO',
  ROVER_MODE_STEERING = 'ROVER_MODE_STEERING',
  ROVER_MODE_HOLD = 'ROVER_MODE_HOLD',
  ROVER_MODE_LOITER = 'ROVER_MODE_LOITER',
  ROVER_MODE_AUTO = 'ROVER_MODE_AUTO',
  ROVER_MODE_RTL = 'ROVER_MODE_RTL',
  ROVER_MODE_SMART_RTL = 'ROVER_MODE_SMART_RTL',
  ROVER_MODE_GUIDED = 'ROVER_MODE_GUIDED',
  ROVER_MODE_INITIALIZING = 'ROVER_MODE_INITIALIZING',
}

/**
 * A mapping of antenna tracker flight modes for custom_mode field of heartbeat.
 */
export enum TrackerMode {
  TRACKER_MODE_MANUAL = 'TRACKER_MODE_MANUAL',
  TRACKER_MODE_STOP = 'TRACKER_MODE_STOP',
  TRACKER_MODE_SCAN = 'TRACKER_MODE_SCAN',
  TRACKER_MODE_SERVO_TEST = 'TRACKER_MODE_SERVO_TEST',
  TRACKER_MODE_AUTO = 'TRACKER_MODE_AUTO',
  TRACKER_MODE_INITIALIZING = 'TRACKER_MODE_INITIALIZING',
}

/**
 * Possible type of MAVLink messages
 */
export enum MAVLinkType {
  ACTUATOR_CONTROL_TARGET = 'ACTUATOR_CONTROL_TARGET',
  ACTUATOR_OUTPUT_STATUS = 'ACTUATOR_OUTPUT_STATUS',
  ADAP_TUNING = 'ADAP_TUNING',
  ADSB_VEHICLE = 'ADSB_VEHICLE',
  AHRS = 'AHRS',
  AHRS2 = 'AHRS2',
  AHRS3 = 'AHRS3',
  AIRSPEED_AUTOCAL = 'AIRSPEED_AUTOCAL',
  AIS_VESSEL = 'AIS_VESSEL',
  ALTITUDE = 'ALTITUDE',
  AOA_SSA = 'AOA_SSA',
  AP_ADC = 'AP_ADC',
  ATT_POS_MOCAP = 'ATT_POS_MOCAP',
  ATTITUDE = 'ATTITUDE',
  ATTITUDE_QUATERNION = 'ATTITUDE_QUATERNION',
  ATTITUDE_QUATERNION_COV = 'ATTITUDE_QUATERNION_COV',
  ATTITUDE_TARGET = 'ATTITUDE_TARGET',
  AUTH_KEY = 'AUTH_KEY',
  AUTOPILOT_STATE_FOR_GIMBAL_DEVICE = 'AUTOPILOT_STATE_FOR_GIMBAL_DEVICE',
  AUTOPILOT_VERSION = 'AUTOPILOT_VERSION',
  AUTOPILOT_VERSION_REQUEST = 'AUTOPILOT_VERSION_REQUEST',
  BATTERY_STATUS = 'BATTERY_STATUS',
  BATTERY2 = 'BATTERY2',
  BUTTON_CHANGE = 'BUTTON_CHANGE',
  CAMERA_CAPTURE_STATUS = 'CAMERA_CAPTURE_STATUS',
  CAMERA_FEEDBACK = 'CAMERA_FEEDBACK',
  CAMERA_IMAGE_CAPTURED = 'CAMERA_IMAGE_CAPTURED',
  CAMERA_INFORMATION = 'CAMERA_INFORMATION',
  CAMERA_SETTINGS = 'CAMERA_SETTINGS',
  CAMERA_STATUS = 'CAMERA_STATUS',
  CAMERA_TRIGGER = 'CAMERA_TRIGGER',
  CELLULAR_CONFIG = 'CELLULAR_CONFIG',
  CELLULAR_STATUS = 'CELLULAR_STATUS',
  CHANGE_OPERATOR_CONTROL = 'CHANGE_OPERATOR_CONTROL',
  CHANGE_OPERATOR_CONTROL_ACK = 'CHANGE_OPERATOR_CONTROL_ACK',
  COLLISION = 'COLLISION',
  COMMAND_ACK = 'COMMAND_ACK',
  COMMAND_CANCEL = 'COMMAND_CANCEL',
  COMMAND_INT = 'COMMAND_INT',
  COMMAND_LONG = 'COMMAND_LONG',
  COMPASSMOT_STATUS = 'COMPASSMOT_STATUS',
  COMPONENT_INFORMATION = 'COMPONENT_INFORMATION',
  CONTROL_SYSTEM_STATE = 'CONTROL_SYSTEM_STATE',
  DATA_STREAM = 'DATA_STREAM',
  DATA_TRANSMISSION_HANDSHAKE = 'DATA_TRANSMISSION_HANDSHAKE',
  DATA16 = 'DATA16',
  DATA32 = 'DATA32',
  DATA64 = 'DATA64',
  DATA96 = 'DATA96',
  DEBUG = 'DEBUG',
  DEBUG_FLOAT_ARRAY = 'DEBUG_FLOAT_ARRAY',
  DEBUG_VECT = 'DEBUG_VECT',
  DEEPSTALL = 'DEEPSTALL',
  DEVICE_OP_READ = 'DEVICE_OP_READ',
  DEVICE_OP_READ_REPLY = 'DEVICE_OP_READ_REPLY',
  DEVICE_OP_WRITE = 'DEVICE_OP_WRITE',
  DEVICE_OP_WRITE_REPLY = 'DEVICE_OP_WRITE_REPLY',
  DIGICAM_CONFIGURE = 'DIGICAM_CONFIGURE',
  DIGICAM_CONTROL = 'DIGICAM_CONTROL',
  DISTANCE_SENSOR = 'DISTANCE_SENSOR',
  EFI_STATUS = 'EFI_STATUS',
  EKF_STATUS_REPORT = 'EKF_STATUS_REPORT',
  ENCAPSULATED_DATA = 'ENCAPSULATED_DATA',
  ESC_TELEMETRY_1_TO_4 = 'ESC_TELEMETRY_1_TO_4',
  ESC_TELEMETRY_5_TO_8 = 'ESC_TELEMETRY_5_TO_8',
  ESC_TELEMETRY_9_TO_12 = 'ESC_TELEMETRY_9_TO_12',
  ESTIMATOR_STATUS = 'ESTIMATOR_STATUS',
  EXTENDED_SYS_STATE = 'EXTENDED_SYS_STATE',
  FENCE_FETCH_POINT = 'FENCE_FETCH_POINT',
  FENCE_POINT = 'FENCE_POINT',
  FENCE_STATUS = 'FENCE_STATUS',
  FILE_TRANSFER_PROTOCOL = 'FILE_TRANSFER_PROTOCOL',
  FLIGHT_INFORMATION = 'FLIGHT_INFORMATION',
  FOLLOW_TARGET = 'FOLLOW_TARGET',
  GENERATOR_STATUS = 'GENERATOR_STATUS',
  GIMBAL_CONTROL = 'GIMBAL_CONTROL',
  GIMBAL_DEVICE_ATTITUDE_STATUS = 'GIMBAL_DEVICE_ATTITUDE_STATUS',
  GIMBAL_DEVICE_INFORMATION = 'GIMBAL_DEVICE_INFORMATION',
  GIMBAL_DEVICE_SET_ATTITUDE = 'GIMBAL_DEVICE_SET_ATTITUDE',
  GIMBAL_MANAGER_INFORMATION = 'GIMBAL_MANAGER_INFORMATION',
  GIMBAL_MANAGER_SET_ATTITUDE = 'GIMBAL_MANAGER_SET_ATTITUDE',
  GIMBAL_MANAGER_SET_TILTPAN = 'GIMBAL_MANAGER_SET_TILTPAN',
  GIMBAL_MANAGER_STATUS = 'GIMBAL_MANAGER_STATUS',
  GIMBAL_REPORT = 'GIMBAL_REPORT',
  GIMBAL_TORQUE_CMD_REPORT = 'GIMBAL_TORQUE_CMD_REPORT',
  GLOBAL_POSITION_INT = 'GLOBAL_POSITION_INT',
  GLOBAL_POSITION_INT_COV = 'GLOBAL_POSITION_INT_COV',
  GLOBAL_VISION_POSITION_ESTIMATE = 'GLOBAL_VISION_POSITION_ESTIMATE',
  GOPRO_GET_REQUEST = 'GOPRO_GET_REQUEST',
  GOPRO_GET_RESPONSE = 'GOPRO_GET_RESPONSE',
  GOPRO_HEARTBEAT = 'GOPRO_HEARTBEAT',
  GOPRO_SET_REQUEST = 'GOPRO_SET_REQUEST',
  GOPRO_SET_RESPONSE = 'GOPRO_SET_RESPONSE',
  GPS_GLOBAL_ORIGIN = 'GPS_GLOBAL_ORIGIN',
  GPS_INJECT_DATA = 'GPS_INJECT_DATA',
  GPS_INPUT = 'GPS_INPUT',
  GPS_RAW_INT = 'GPS_RAW_INT',
  GPS_RTCM_DATA = 'GPS_RTCM_DATA',
  GPS_RTK = 'GPS_RTK',
  GPS_STATUS = 'GPS_STATUS',
  GPS2_RAW = 'GPS2_RAW',
  GPS2_RTK = 'GPS2_RTK',
  HEARTBEAT = 'HEARTBEAT',
  HIGH_LATENCY = 'HIGH_LATENCY',
  HIGH_LATENCY2 = 'HIGH_LATENCY2',
  HIGHRES_IMU = 'HIGHRES_IMU',
  HIL_ACTUATOR_CONTROLS = 'HIL_ACTUATOR_CONTROLS',
  HIL_CONTROLS = 'HIL_CONTROLS',
  HIL_GPS = 'HIL_GPS',
  HIL_OPTICAL_FLOW = 'HIL_OPTICAL_FLOW',
  HIL_RC_INPUTS_RAW = 'HIL_RC_INPUTS_RAW',
  HIL_SENSOR = 'HIL_SENSOR',
  HIL_STATE = 'HIL_STATE',
  HIL_STATE_QUATERNION = 'HIL_STATE_QUATERNION',
  HOME_POSITION = 'HOME_POSITION',
  HWSTATUS = 'HWSTATUS',
  ISBD_LINK_STATUS = 'ISBD_LINK_STATUS',
  LANDING_TARGET = 'LANDING_TARGET',
  LED_CONTROL = 'LED_CONTROL',
  LIMITS_STATUS = 'LIMITS_STATUS',
  LINK_NODE_STATUS = 'LINK_NODE_STATUS',
  LOCAL_POSITION_NED = 'LOCAL_POSITION_NED',
  LOCAL_POSITION_NED_COV = 'LOCAL_POSITION_NED_COV',
  LOCAL_POSITION_NED_SYSTEM_GLOBAL_OFFSET = 'LOCAL_POSITION_NED_SYSTEM_GLOBAL_OFFSET',
  LOG_DATA = 'LOG_DATA',
  LOG_ENTRY = 'LOG_ENTRY',
  LOG_ERASE = 'LOG_ERASE',
  LOG_REQUEST_DATA = 'LOG_REQUEST_DATA',
  LOG_REQUEST_END = 'LOG_REQUEST_END',
  LOG_REQUEST_LIST = 'LOG_REQUEST_LIST',
  LOGGING_ACK = 'LOGGING_ACK',
  LOGGING_DATA = 'LOGGING_DATA',
  LOGGING_DATA_ACKED = 'LOGGING_DATA_ACKED',
  MAG_CAL_PROGRESS = 'MAG_CAL_PROGRESS',
  MAG_CAL_REPORT = 'MAG_CAL_REPORT',
  MANUAL_CONTROL = 'MANUAL_CONTROL',
  MANUAL_SETPOINT = 'MANUAL_SETPOINT',
  MEMINFO = 'MEMINFO',
  MEMORY_VECT = 'MEMORY_VECT',
  MESSAGE_INTERVAL = 'MESSAGE_INTERVAL',
  MISSION_ACK = 'MISSION_ACK',
  MISSION_CHANGED = 'MISSION_CHANGED',
  MISSION_CLEAR_ALL = 'MISSION_CLEAR_ALL',
  MISSION_COUNT = 'MISSION_COUNT',
  MISSION_CURRENT = 'MISSION_CURRENT',
  MISSION_ITEM = 'MISSION_ITEM',
  MISSION_ITEM_INT = 'MISSION_ITEM_INT',
  MISSION_ITEM_REACHED = 'MISSION_ITEM_REACHED',
  MISSION_REQUEST = 'MISSION_REQUEST',
  MISSION_REQUEST_INT = 'MISSION_REQUEST_INT',
  MISSION_REQUEST_LIST = 'MISSION_REQUEST_LIST',
  MISSION_REQUEST_PARTIAL_LIST = 'MISSION_REQUEST_PARTIAL_LIST',
  MISSION_SET_CURRENT = 'MISSION_SET_CURRENT',
  MISSION_WRITE_PARTIAL_LIST = 'MISSION_WRITE_PARTIAL_LIST',
  MOUNT_CONFIGURE = 'MOUNT_CONFIGURE',
  MOUNT_CONTROL = 'MOUNT_CONTROL',
  MOUNT_ORIENTATION = 'MOUNT_ORIENTATION',
  MOUNT_STATUS = 'MOUNT_STATUS',
  NAMED_VALUE_FLOAT = 'NAMED_VALUE_FLOAT',
  NAMED_VALUE_INT = 'NAMED_VALUE_INT',
  NAV_CONTROLLER_OUTPUT = 'NAV_CONTROLLER_OUTPUT',
  OBSTACLE_DISTANCE = 'OBSTACLE_DISTANCE',
  ODOMETRY = 'ODOMETRY',
  ONBOARD_COMPUTER_STATUS = 'ONBOARD_COMPUTER_STATUS',
  OPEN_DRONE_ID_AUTHENTICATION = 'OPEN_DRONE_ID_AUTHENTICATION',
  OPEN_DRONE_ID_BASIC_ID = 'OPEN_DRONE_ID_BASIC_ID',
  OPEN_DRONE_ID_LOCATION = 'OPEN_DRONE_ID_LOCATION',
  OPEN_DRONE_ID_MESSAGE_PACK = 'OPEN_DRONE_ID_MESSAGE_PACK',
  OPEN_DRONE_ID_OPERATOR_ID = 'OPEN_DRONE_ID_OPERATOR_ID',
  OPEN_DRONE_ID_SELF_ID = 'OPEN_DRONE_ID_SELF_ID',
  OPEN_DRONE_ID_SYSTEM = 'OPEN_DRONE_ID_SYSTEM',
  OPTICAL_FLOW = 'OPTICAL_FLOW',
  OPTICAL_FLOW_RAD = 'OPTICAL_FLOW_RAD',
  ORBIT_EXECUTION_STATUS = 'ORBIT_EXECUTION_STATUS',
  PARAM_EXT_ACK = 'PARAM_EXT_ACK',
  PARAM_EXT_REQUEST_LIST = 'PARAM_EXT_REQUEST_LIST',
  PARAM_EXT_REQUEST_READ = 'PARAM_EXT_REQUEST_READ',
  PARAM_EXT_SET = 'PARAM_EXT_SET',
  PARAM_EXT_VALUE = 'PARAM_EXT_VALUE',
  PARAM_MAP_RC = 'PARAM_MAP_RC',
  PARAM_REQUEST_LIST = 'PARAM_REQUEST_LIST',
  PARAM_REQUEST_READ = 'PARAM_REQUEST_READ',
  PARAM_SET = 'PARAM_SET',
  PARAM_VALUE = 'PARAM_VALUE',
  PID_TUNING = 'PID_TUNING',
  PING = 'PING',
  PLAY_TUNE = 'PLAY_TUNE',
  PLAY_TUNE_V2 = 'PLAY_TUNE_V2',
  POSITION_TARGET_GLOBAL_INT = 'POSITION_TARGET_GLOBAL_INT',
  POSITION_TARGET_LOCAL_NED = 'POSITION_TARGET_LOCAL_NED',
  POWER_STATUS = 'POWER_STATUS',
  PROTOCOL_VERSION = 'PROTOCOL_VERSION',
  RADIO = 'RADIO',
  RADIO_STATUS = 'RADIO_STATUS',
  RALLY_FETCH_POINT = 'RALLY_FETCH_POINT',
  RALLY_POINT = 'RALLY_POINT',
  RANGEFINDER = 'RANGEFINDER',
  RAW_IMU = 'RAW_IMU',
  RAW_PRESSURE = 'RAW_PRESSURE',
  RAW_RPM = 'RAW_RPM',
  RC_CHANNELS = 'RC_CHANNELS',
  RC_CHANNELS_OVERRIDE = 'RC_CHANNELS_OVERRIDE',
  RC_CHANNELS_RAW = 'RC_CHANNELS_RAW',
  RC_CHANNELS_SCALED = 'RC_CHANNELS_SCALED',
  REMOTE_LOG_BLOCK_STATUS = 'REMOTE_LOG_BLOCK_STATUS',
  REMOTE_LOG_DATA_BLOCK = 'REMOTE_LOG_DATA_BLOCK',
  REQUEST_DATA_STREAM = 'REQUEST_DATA_STREAM',
  RESOURCE_REQUEST = 'RESOURCE_REQUEST',
  RPM = 'RPM',
  SAFETY_ALLOWED_AREA = 'SAFETY_ALLOWED_AREA',
  SAFETY_SET_ALLOWED_AREA = 'SAFETY_SET_ALLOWED_AREA',
  SCALED_IMU = 'SCALED_IMU',
  SCALED_IMU2 = 'SCALED_IMU2',
  SCALED_IMU3 = 'SCALED_IMU3',
  SCALED_PRESSURE = 'SCALED_PRESSURE',
  SCALED_PRESSURE2 = 'SCALED_PRESSURE2',
  SCALED_PRESSURE3 = 'SCALED_PRESSURE3',
  SENSOR_OFFSETS = 'SENSOR_OFFSETS',
  SERIAL_CONTROL = 'SERIAL_CONTROL',
  SERVO_OUTPUT_RAW = 'SERVO_OUTPUT_RAW',
  SET_ACTUATOR_CONTROL_TARGET = 'SET_ACTUATOR_CONTROL_TARGET',
  SET_ATTITUDE_TARGET = 'SET_ATTITUDE_TARGET',
  SET_GPS_GLOBAL_ORIGIN = 'SET_GPS_GLOBAL_ORIGIN',
  SET_HOME_POSITION = 'SET_HOME_POSITION',
  SET_MAG_OFFSETS = 'SET_MAG_OFFSETS',
  SET_MODE = 'SET_MODE',
  SET_POSITION_TARGET_GLOBAL_INT = 'SET_POSITION_TARGET_GLOBAL_INT',
  SET_POSITION_TARGET_LOCAL_NED = 'SET_POSITION_TARGET_LOCAL_NED',
  SETUP_SIGNING = 'SETUP_SIGNING',
  SIM_STATE = 'SIM_STATE',
  SIMSTATE = 'SIMSTATE',
  SMART_BATTERY_INFO = 'SMART_BATTERY_INFO',
  SMART_BATTERY_STATUS = 'SMART_BATTERY_STATUS',
  STATUSTEXT = 'STATUSTEXT',
  STORAGE_INFORMATION = 'STORAGE_INFORMATION',
  SUPPORTED_TUNES = 'SUPPORTED_TUNES',
  SYS_STATUS = 'SYS_STATUS',
  SYSTEM_TIME = 'SYSTEM_TIME',
  TERRAIN_CHECK = 'TERRAIN_CHECK',
  TERRAIN_DATA = 'TERRAIN_DATA',
  TERRAIN_REPORT = 'TERRAIN_REPORT',
  TERRAIN_REQUEST = 'TERRAIN_REQUEST',
  TIME_ESTIMATE_TO_TARGET = 'TIME_ESTIMATE_TO_TARGET',
  TIMESYNC = 'TIMESYNC',
  TRAJECTORY_REPRESENTATION_BEZIER = 'TRAJECTORY_REPRESENTATION_BEZIER',
  TRAJECTORY_REPRESENTATION_WAYPOINTS = 'TRAJECTORY_REPRESENTATION_WAYPOINTS',
  TUNNEL = 'TUNNEL',
  UAVCAN_NODE_INFO = 'UAVCAN_NODE_INFO',
  UAVCAN_NODE_STATUS = 'UAVCAN_NODE_STATUS',
  UTM_GLOBAL_POSITION = 'UTM_GLOBAL_POSITION',
  V2_EXTENSION = 'V2_EXTENSION',
  VFR_HUD = 'VFR_HUD',
  VIBRATION = 'VIBRATION',
  VICON_POSITION_ESTIMATE = 'VICON_POSITION_ESTIMATE',
  VIDEO_STREAM_INFORMATION = 'VIDEO_STREAM_INFORMATION',
  VIDEO_STREAM_STATUS = 'VIDEO_STREAM_STATUS',
  VISION_POSITION_DELTA = 'VISION_POSITION_DELTA',
  VISION_POSITION_ESTIMATE = 'VISION_POSITION_ESTIMATE',
  VISION_SPEED_ESTIMATE = 'VISION_SPEED_ESTIMATE',
  WHEEL_DISTANCE = 'WHEEL_DISTANCE',
  WIFI_CONFIG_AP = 'WIFI_CONFIG_AP',
  WIND = 'WIND',
  WIND_COV = 'WIND_COV',
}
