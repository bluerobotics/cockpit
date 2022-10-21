/**
 * Based over MAVLink2REST message structure,
 * https://mavlink.io/en/messages/common.html and https://mavlink.io/en/messages/ardupilotmega.html
 *
 */
import type { BitFlag, Message, Type } from './mavlink2rest'
import type {
  AdsbAltitudeType,
  AdsbEmitterType,
  AisNavStatus,
  AisType,
  CameraMode,
  CellularConfigResponse,
  CellularNetworkFailedReason,
  CellularNetworkRadioType,
  CellularStatusFlag,
  CompMetadataType,
  FenceBreach,
  FenceMitigate,
  GimbalDeviceFlags,
  GimbalManagerFlags,
  GpsFixType,
  LandingTargetType,
  MavAutopilot,
  MavBatteryChargeState,
  MavBatteryFunction,
  MavBatteryType,
  MavCmd,
  MavCollisionAction,
  MavCollisionSrc,
  MavCollisionThreatLevel,
  MavComponent,
  MavDistanceSensor,
  MavEstimatorType,
  MavFrame,
  MavLandedState,
  MavlinkDataStreamType,
  MavMissionResult,
  MavMissionType,
  MavMode,
  MavOdidAuthType,
  MavOdidCategoryEu,
  MavOdidClassificationType,
  MavOdidDescType,
  MavOdidHeightRef,
  MavOdidHorAcc,
  MavOdidIdType,
  MavOdidOperatorIdType,
  MavOdidOperatorLocationType,
  MavOdidSpeedAcc,
  MavOdidStatus,
  MavOdidTimeAcc,
  MavOdidUaType,
  MavOdidVerAcc,
  MavParamExtType,
  MavParamType,
  MavResult,
  MavSensorOrientation,
  MavSeverity,
  MavState,
  MavSysStatusSensor,
  MavTunnelPayloadType,
  MavType,
  MavVtolState,
  ParamAck,
  RtkBaselineCoordinateSystem,
  SerialControlDev,
  StorageStatus,
  UavcanNodeHealth,
  UavcanNodeMode,
  UtmFlightState,
  VideoStreamStatusFlags,
  VideoStreamType,
  WifiConfigApMode,
  WifiConfigApResponse,
} from './mavlink2rest-enum'

/* eslint-disable max-len, @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */
export namespace Message {
  /**
   * MAVLink message ID: 0
   * The heartbeat message shows that a system or component is present and responding. The type and autopilot fields (along with the message component id), allow the receiving system to treat further messages from this system appropriately (e.g. by laying out the user interface based on the autopilot). This microservice is documented at https://mavlink.io/en/services/heartbeat.html.
   */
  export interface Heartbeat extends Message {
    /**
     * A bitfield for
     */
    custom_mode: number
    /**
     * Vehicle or component type. For a flight controller component the vehicle type (quadrotor, helicopter, etc.). For other components the component type (e.g. camera, gimbal, etc.). This should be used in preference to component id for identifying the component type..
     */
    mavtype: Type<MavType>
    /**
     * Autopilot type / class.
     */
    autopilot: Type<MavAutopilot>
    /**
     * System mode bitmap..
     */
    base_mode: BitFlag // TODO: MavModeFlag https://mavlink.io/en/messages/common.html#MAV_MODE_FLAG
    /**
     * System status flag..
     */
    system_status: Type<MavState>
    /**
     * MAVLink version, not writable by user, gets added by protocol beca
     */
    mavlink_version: number
  }

  /**
   * MAVLink message ID: 1
   * The general system state. If the system is following the MAVLink standard, the system state is mainly defined by three orthogonal states/modes: The system mode, which is either LOCKED (motors shut down and locked), MANUAL (system under RC control), GUIDED (system with autonomous position control, position setpoint controlled manually) or AUTO (system guided by path/waypoint planner). The NAV_MODE defined the current flight state: LIFTOFF (often an open-loop maneuver), LANDING, WAYPOINTS or VECTOR. This represents the internal navigation state machine. The system status shows whether the system is currently active or not and if an emergency occurred. During the CRITICAL and EMERGENCY states the MAV is still considered to be active, but should start emergency procedures autonomously. After a failure occurred it should first move from active to critical to allow manual intervention and then move to emergency after a certain timeout..
   */
  export interface SysStatus extends Message {
    /**
     * Bitmap showing which onboard controllers and sensors are present. Value of 0: not present. Value of 1: present..
     */
    onboard_control_sensors_present: MavSysStatusSensor
    /**
     * Bitmap showing which onboard controllers and sensors are enabled:Value of 0: not enabled. Value of 1: enabled..
     */
    onboard_control_sensors_enabled: MavSysStatusSensor
    /**
     * Bitmap showing which onboard controllers and sensors have an error (or are operational). Value of 0: error. Value of 1: healthy..
     */
    onboard_control_sensors_health: MavSysStatusSensor
    /**
     * Maximum usage in percent of the mainloop time. Values: [0-1000] - should always be below 1000.
     */
    load: number
    /**
     * Battery voltage, UINT16_MAX: Voltage not sent by autopilot.
     */
    voltage_battery: number
    /**
     * Battery current, -1: Current not sent by autopilot.
     */
    current_battery: number
    /**
     * Communication drop rate, (UART, I2C, SPI, CAN), dropped packets on all links (packets that were corrupted on reception on the MAV).
     */
    drop_rate_comm: number
    /**
     * Communication errors (UART, I2C, SPI, CAN), dropped packets on all links (packets that were corrupted on reception on the MAV).
     */
    errors_comm: number
    /**
     * Autopilot-specific errors.
     */
    errors_count1: number
    /**
     * Autopilot-specific errors.
     */
    errors_count2: number
    /**
     * Autopilot-specific errors.
     */
    errors_count3: number
    /**
     * Autopilot-specific errors.
     */
    errors_count4: number
    /**
     * Battery energy remaining, -1: Battery remaining energy not sent by autopilot.
     */
    battery_remaining: number
  }

  /**
   * MAVLink message ID: 2
   * The system time is the time of the master clock, typically the computer clock of the main onboard computer..
   */
  export interface SystemTime extends Message {
    /**
     * Timestamp (UNIX epoch time)..
     */
    time_unix_usec: number
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
  }

  /**
   * MAVLink message ID: 4
   * A ping message either requesting or responding to a ping. This allows to measure the system latencies, including serial port, radio modem and UDP connections. The ping microservice is documented at https://mavlink.io/en/services/ping.html.
   */
  export interface Ping extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * PING sequence.
     */
    seq: number
    /**
     * 0: request ping from all receiving systems. If greater than 0: message is a ping response and number is the system id of the requesting system.
     */
    target_system: number
    /**
     * 0: request ping from all receiving components. If greater than 0: message is a ping response and number is the component id of the requesting component..
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 5
   * Request to control this MAV.
   */
  export interface ChangeOperatorControl extends Message {
    /**
     * System the GCS requests control for.
     */
    target_system: number
    /**
     * 0: request control of this MAV, 1: Release control of this MAV.
     */
    control_request: number
    /**
     * 0: key as plaintext, 1-255: future, different hashing/encryption variants. The GCS should in general
     */
    version: number
    /**
     * Password / Key, depending on version plaintext or encrypted. 25 or less characters, NULL terminated. The characters may involve A-Z, a-z, 0-9, and "!?,.-".
     */
    passkey: number[] // String as array of 25 chars
  }

  /**
   * MAVLink message ID: 6
   * Accept / deny control of this MAV.
   */
  export interface ChangeOperatorControlAck extends Message {
    /**
     * ID of the GCS this message .
     */
    gcs_system_id: number
    /**
     * 0: request control of this MAV, 1: Release control of this MAV.
     */
    control_request: number
    /**
     * 0: ACK, 1: NACK: Wrong passkey, 2: NACK: Unsupported passkey encryption method, 3: NACK: Already under control.
     */
    ack: number
  }

  /**
   * MAVLink message ID: 7
   * Emit an encrypted signature / key identifying this system. PLEASE NOTE: This protocol has been kept simple, so transmitting the key requires an encrypted channel for true safety..
   */
  export interface AuthKey extends Message {
    /**
     * key.
     */
    key: number[] // String as array of 32 chars
  }

  /**
   * MAVLink message ID: 8
   * Status generated in each node in the communication chain and injected into MAVLink stream..
   */
  export interface LinkNodeStatus extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    timestamp: number
    /**
     * Transmit rate.
     */
    tx_rate: number
    /**
     * Receive rate.
     */
    rx_rate: number
    /**
     * Messages sent.
     */
    messages_sent: number
    /**
     * Messages received (estimated from counting seq).
     */
    messages_received: number
    /**
     * Messages lost (estimated from counting seq).
     */
    messages_lost: number
    /**
     * Number of bytes that could not be parsed correctly..
     */
    rx_parse_err: number
    /**
     * Transmit buffer overflows. This number wraps around as it reaches UINT16_MAX.
     */
    tx_overflows: number
    /**
     * Receive buffer overflows. This number wraps around as it reaches UINT16_MAX.
     */
    rx_overflows: number
    /**
     * Remaining free transmit buffer space.
     */
    tx_buf: number
    /**
     * Remaining free receive buffer space.
     */
    rx_buf: number
  }

  /**
   * MAVLink message ID: 11
   * Set the system mode, as defined by enum MAV_MODE. There is no target component id as the mode is by definition for the overall aircraft, not only for one component..
   */
  export interface SetMode extends Message {
    /**
     * The new autopilot-specific mode. This field can be ignored by an autopilot..
     */
    custom_mode: number
    /**
     * The system setting the mode.
     */
    target_system: number
    /**
     * The new base mode..
     */
    base_mode: Type<MavMode>
  }

  /**
   * MAVLink message ID: 20
   * Request to read the onboard parameter with the param_id string id. Onboard parameters are stored as key[const char*] -> value[float]. This allows to send a parameter to any other component (such as the GCS) without the need of previous knowledge of possible parameter names. Thus the same GCS can store different parameters for different autopilots. See also https://mavlink.io/en/services/parameter.html for a full documentation of QGroundControl and IMU code..
   */
  export interface ParamRequestRead extends Message {
    /**
     * Parameter index. Send -1 to
     */
    param_index: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Onboard parameter id, terminated by NULL if the length is less than 16 human-readable chars and WITHOUT null termination (NULL) byte if the length is exactly 16 chars - applications have to provide 16+1 bytes storage if the ID is stored as string.
     */
    param_id: number[] // String as array of 16 chars
  }

  /**
   * MAVLink message ID: 21
   * Request all parameters of this component. After this request, all parameters are emitted. The parameter microservice is documented at https://mavlink.io/en/services/parameter.html.
   */
  export interface ParamRequestList extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 22
   * Emit the value of a onboard parameter. The inclusion of param_count and param_index in the message allows the recipient to keep track of received parameters and allows him to re-request missing parameters after a loss or timeout. The parameter microservice is documented at https://mavlink.io/en/services/parameter.html.
   */
  export interface ParamValue extends Message {
    /**
     * Onboard parameter value.
     */
    param_value: number
    /**
     * Total number of onboard parameters.
     */
    param_count: number
    /**
     * Index of this onboard parameter.
     */
    param_index: number
    /**
     * Onboard parameter id, terminated by NULL if the length is less than 16 human-readable chars and WITHOUT null termination (NULL) byte if the length is exactly 16 chars - applications have to provide 16+1 bytes storage if the ID is stored as string.
     */
    param_id: number[] // String as array of 16 chars
    /**
     * Onboard parameter type..
     */
    param_type: MavParamType
  }

  /**
   * MAVLink message ID: 23
   * Set a parameter value (write new value to permanent storage). IMPORTANT: The receiving component should acknowledge the new parameter value by sending a PARAM_VALUE message to all communication partners. This will also ensure that multiple GCS all have an up-to-date list of all parameters. If the sending GCS did not receive a PARAM_VALUE message within its timeout time, it should re-send the PARAM_SET message. The parameter microservice is documented at https://mavlink.io/en/services/parameter.html.
   */
  export interface ParamSet extends Message {
    /**
     * Onboard parameter value.
     */
    param_value: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Onboard parameter id, terminated by NULL if the length is less than 16 human-readable chars and WITHOUT null termination (NULL) byte if the length is exactly 16 chars - applications have to provide 16+1 bytes storage if the ID is stored as string.
     */
    param_id: number[] // String as array of 16 chars
    /**
     * Onboard parameter type..
     */
    param_type: MavParamType
  }

  /**
   * MAVLink message ID: 24
   * The global position, as returned by the Global Positioning System (GPS). This is NOT the global position estimate of the system, but rather a RAW sensor value. See message GLOBAL_POSITION for the global position estimate..
   */
  export interface GpsRawInt extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Latitude (WGS84, EGM96 ellipsoid).
     */
    lat: number
    /**
     * Longitude (WGS84, EGM96 ellipsoid).
     */
    lon: number
    /**
     * Altitude (MSL). Positive for up. Note that virtually all GPS modules provide the MSL altitude in addition to the WGS84 altitude..
     */
    alt: number
    /**
     * GPS HDOP horizontal dilution of position (unitless). If unknown, set to: UINT16_MAX.
     */
    eph: number
    /**
     * GPS VDOP vertical dilution of position (unitless). If unknown, set to: UINT16_MAX.
     */
    epv: number
    /**
     * GPS ground speed. If unknown, set to: UINT16_MAX.
     */
    vel: number
    /**
     * Course over ground (NOT heading, but direction of movement) in degrees * 100, 0.0..359.99 degrees. If unknown, set to: UINT16_MAX.
     */
    cog: number
    /**
     * GPS fix type..
     */
    fix_type: GpsFixType
    /**
     * Number of satellites visible. If unknown, set to 255.
     */
    satellites_visible: number
    /**
     * Altitude (above WGS84, EGM96 ellipsoid). Positive for up..
     */
    alt_ellipsoid: number
    /**
     * Position uncertainty..
     */
    h_acc: number
    /**
     * Altitude uncertainty..
     */
    v_acc: number
    /**
     * Speed uncertainty..
     */
    vel_acc: number
    /**
     * Heading / track uncertainty.
     */
    hdg_acc: number
    /**
     * Yaw in earth frame from north.
     */
    yaw: number
  }

  /**
   * MAVLink message ID: 25
   * The positioning status, as reported by GPS. This message is intended to display status information about each satellite visible to the receiver. See message GLOBAL_POSITION for the global position estimate. This message can contain information for up to 20 satellites..
   */
  export interface GpsStatus extends Message {
    /**
     * Number of satellites visible.
     */
    satellites_visible: number
    /**
     * Global satellite ID.
     */
    satellite_prn: number[] // Array of 20 elements
    /**
     * 0: Satellite not used, 1: used for localization.
     */
    satellite_used: number[] // Array of 20 elements
    /**
     * Elevation (0: right on top of receiver, 90: on the horizon) of satellite.
     */
    satellite_elevation: number[] // Array of 20 elements
    /**
     * Direction of satellite, 0: 0 deg, 255: 360 deg..
     */
    satellite_azimuth: number[] // Array of 20 elements
    /**
     * Signal to noise ratio of satellite.
     */
    satellite_snr: number[] // Array of 20 elements
  }

  /**
   * MAVLink message ID: 26
   * The RAW IMU readings for the usual 9DOF sensor setup. This message should contain the scaled values to the described units.
   */
  export interface ScaledImu extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * X acceleration.
     */
    xacc: number
    /**
     * Y acceleration.
     */
    yacc: number
    /**
     * Z acceleration.
     */
    zacc: number
    /**
     * Angular speed around X axis.
     */
    xgyro: number
    /**
     * Angular speed around Y axis.
     */
    ygyro: number
    /**
     * Angular speed around Z axis.
     */
    zgyro: number
    /**
     * X Magnetic field.
     */
    xmag: number
    /**
     * Y Magnetic field.
     */
    ymag: number
    /**
     * Z Magnetic field.
     */
    zmag: number
    /**
     * Temperature, 0: IMU does not provide temperature values. If the IMU is at 0C it must send 1 (0.01C)..
     */
    temperature: number
  }

  /**
   * MAVLink message ID: 27
   * The RAW IMU readings for a 9DOF sensor, which is identified by the id (default IMU1). This message should always contain the true raw values without any scaling to allow data capture and system debugging..
   */
  export interface RawImu extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X acceleration (raw).
     */
    xacc: number
    /**
     * Y acceleration (raw).
     */
    yacc: number
    /**
     * Z acceleration (raw).
     */
    zacc: number
    /**
     * Angular speed around X axis (raw).
     */
    xgyro: number
    /**
     * Angular speed around Y axis (raw).
     */
    ygyro: number
    /**
     * Angular speed around Z axis (raw).
     */
    zgyro: number
    /**
     * X Magnetic field (raw).
     */
    xmag: number
    /**
     * Y Magnetic field (raw).
     */
    ymag: number
    /**
     * Z Magnetic field (raw).
     */
    zmag: number
    /**
     * Id. Ids are numbered from 0 and map to IMUs numbered from 1 (e.g. IMU1 will have a message with id=0).
     */
    id: number
    /**
     * Temperature, 0: IMU does not provide temperature values. If the IMU is at 0C it must send 1 (0.01C)..
     */
    temperature: number
  }

  /**
   * MAVLink message ID: 28
   * The RAW pressure readings for the typical setup of one absolute pressure and one differential pressure sensor. The sensor values should be the raw, UNSCALED ADC values..
   */
  export interface RawPressure extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Absolute pressure (raw).
     */
    press_abs: number
    /**
     * Differential pressure 1 (raw, 0 if nonexistent).
     */
    press_diff1: number
    /**
     * Differential pressure 2 (raw, 0 if nonexistent).
     */
    press_diff2: number
    /**
     * Raw Temperature measurement (raw).
     */
    temperature: number
  }

  /**
   * MAVLink message ID: 29
   * The pressure readings for the typical setup of one absolute and differential pressure sensor. The units are as specified in each field..
   */
  export interface ScaledPressure extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Absolute pressure.
     */
    press_abs: number
    /**
     * Differential pressure 1.
     */
    press_diff: number
    /**
     * Temperature.
     */
    temperature: number
  }

  /**
   * MAVLink message ID: 30
   * The attitude in the aeronautical frame (right-handed, Z-down, X-front, Y-right)..
   */
  export interface Attitude extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Roll angle (-pi..+pi).
     */
    roll: number
    /**
     * Pitch angle (-pi..+pi).
     */
    pitch: number
    /**
     * Yaw angle (-pi..+pi).
     */
    yaw: number
    /**
     * Roll angular speed.
     */
    rollspeed: number
    /**
     * Pitch angular speed.
     */
    pitchspeed: number
    /**
     * Yaw angular speed.
     */
    yawspeed: number
  }

  /**
   * MAVLink message ID: 31
   * The attitude in the aeronautical frame (right-handed, Z-down, X-front, Y-right), expressed as quaternion. Quaternion order is w, x, y, z and a zero rotation would be expressed as (1 0 0 0)..
   */
  export interface AttitudeQuaternion extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Quaternion component 1, w (1 in null-rotation).
     */
    q1: number
    /**
     * Quaternion component 2, x (0 in null-rotation).
     */
    q2: number
    /**
     * Quaternion component 3, y (0 in null-rotation).
     */
    q3: number
    /**
     * Quaternion component 4, z (0 in null-rotation).
     */
    q4: number
    /**
     * Roll angular speed.
     */
    rollspeed: number
    /**
     * Pitch angular speed.
     */
    pitchspeed: number
    /**
     * Yaw angular speed.
     */
    yawspeed: number
    /**
     * Rotation offset by which the attitude quaternion and angular speed vector should be rotated for user display (quaternion with [w, x, y, z] order, zero-rotation is [1, 0, 0, 0], send [0, 0, 0, 0] if field not supported). This field is intended for systems in which the reference attitude may change during flight. For example, tailsitters VTOLs rotate their reference attitude by 90 degrees between hover mode and fixed wing mode, thus repr_offset_q is equal to [1, 0, 0, 0] in hover mode and equal to [0.7071, 0, 0.7071, 0] in fixed wing mode..
     */
    repr_offset_q: number[] // Array of 4 elements
  }

  /**
   * MAVLink message ID: 32
   * The filtered local position (e.g. fused computer vision and accelerometers). Coordinate frame is right-handed, Z-axis down (aeronautical frame, NED / north-east-down convention).
   */
  export interface LocalPositionNed extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * X Position.
     */
    x: number
    /**
     * Y Position.
     */
    y: number
    /**
     * Z Position.
     */
    z: number
    /**
     * X Speed.
     */
    vx: number
    /**
     * Y Speed.
     */
    vy: number
    /**
     * Z Speed.
     */
    vz: number
  }

  /**
   * MAVLink message ID: 33
   * The filtered global position (e.g. fused GPS and accelerometers). The position is in GPS-frame (right-handed, Z-up). Itis designed as scaled integer message since the resolution of float is not sufficient..
   */
  export interface GlobalPositionInt extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Latitude, expressed.
     */
    lat: number
    /**
     * Longitude, expressed.
     */
    lon: number
    /**
     * Altitude (MSL). Note that virtually all GPS modules provide both WGS84 and MSL..
     */
    alt: number
    /**
     * Altitude above ground.
     */
    relative_alt: number
    /**
     * Ground X Speed (Latitude, positive north).
     */
    vx: number
    /**
     * Ground Y Speed (Longitude, positive east).
     */
    vy: number
    /**
     * Ground Z Speed (Altitude, positive down).
     */
    vz: number
    /**
     * Vehicle heading (yaw angle), 0.0..359.99 degrees. If unknown, set to: UINT16_MAX.
     */
    hdg: number
  }

  /**
   * MAVLink message ID: 34
   * The scaled values of the RC channels received: (-100%) -10000, (0%) 0, (100%) 10000. Channels that are inactive should be set to UINT16_MAX..
   */
  export interface RcChannelsScaled extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * RC channel 1 value scaled..
     */
    chan1_scaled: number
    /**
     * RC channel 2 value scaled..
     */
    chan2_scaled: number
    /**
     * RC channel 3 value scaled..
     */
    chan3_scaled: number
    /**
     * RC channel 4 value scaled..
     */
    chan4_scaled: number
    /**
     * RC channel 5 value scaled..
     */
    chan5_scaled: number
    /**
     * RC channel 6 value scaled..
     */
    chan6_scaled: number
    /**
     * RC channel 7 value scaled..
     */
    chan7_scaled: number
    /**
     * RC channel 8 value scaled..
     */
    chan8_scaled: number
    /**
     * Servo output port (set of 8 outputs = 1 port). Flight stacks running on Pixhawk should use: 0 = MAIN, 1 = AUX..
     */
    port: number
    /**
     * Receive signal strength indicator in device-dependent units/scale. Values: [0-254], 255: invalid/unknown..
     */
    rssi: number
  }

  /**
   * MAVLink message ID: 35
   * The RAW values of the RC channels received. The standard PPM modulation is as follows: 1000 microseconds: 0%, 2000 microseconds: 100%. A value of UINT16_MAX implies the channel is unused. Individual receivers/transmitters might violate this specification..
   */
  export interface RcChannelsRaw extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * RC channel 1 value..
     */
    chan1_raw: number
    /**
     * RC channel 2 value..
     */
    chan2_raw: number
    /**
     * RC channel 3 value..
     */
    chan3_raw: number
    /**
     * RC channel 4 value..
     */
    chan4_raw: number
    /**
     * RC channel 5 value..
     */
    chan5_raw: number
    /**
     * RC channel 6 value..
     */
    chan6_raw: number
    /**
     * RC channel 7 value..
     */
    chan7_raw: number
    /**
     * RC channel 8 value..
     */
    chan8_raw: number
    /**
     * Servo output port (set of 8 outputs = 1 port). Flight stacks running on Pixhawk should use: 0 = MAIN, 1 = AUX..
     */
    port: number
    /**
     * Receive signal strength indicator in device-dependent units/scale. Values: [0-254], 255: invalid/unknown..
     */
    rssi: number
  }

  /**
   * MAVLink message ID: 36
   * Superseded by ACTUATOR_OUTPUT_STATUS. The RAW values of the servo outputs (for RC input from the remote
   */
  export interface ServoOutputRaw extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Servo output 1 value.
     */
    servo1_raw: number
    /**
     * Servo output 2 value.
     */
    servo2_raw: number
    /**
     * Servo output 3 value.
     */
    servo3_raw: number
    /**
     * Servo output 4 value.
     */
    servo4_raw: number
    /**
     * Servo output 5 value.
     */
    servo5_raw: number
    /**
     * Servo output 6 value.
     */
    servo6_raw: number
    /**
     * Servo output 7 value.
     */
    servo7_raw: number
    /**
     * Servo output 8 value.
     */
    servo8_raw: number
    /**
     * Servo output port (set of 8 outputs = 1 port). Flight stacks running on Pixhawk should use: 0 = MAIN, 1 = AUX..
     */
    port: number
    /**
     * Servo output 9 value.
     */
    servo9_raw: number
    /**
     * Servo output 10 value.
     */
    servo10_raw: number
    /**
     * Servo output 11 value.
     */
    servo11_raw: number
    /**
     * Servo output 12 value.
     */
    servo12_raw: number
    /**
     * Servo output 13 value.
     */
    servo13_raw: number
    /**
     * Servo output 14 value.
     */
    servo14_raw: number
    /**
     * Servo output 15 value.
     */
    servo15_raw: number
    /**
     * Servo output 16 value.
     */
    servo16_raw: number
  }

  /**
   * MAVLink message ID: 37
   * Request a partial list of mission items from the system/component. https://mavlink.io/en/services/mission.html. If start and end index are the same, just send one waypoint..
   */
  export interface MissionRequestPartialList extends Message {
    /**
     * Start index.
     */
    start_index: number
    /**
     * End index, -1 by default (-1: send list to end). Else a valid index of the list.
     */
    end_index: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 38
   * This message is sent to the MAV to write a partial list. If start index == end index, only one item will be transmitted / updated. If the start index is NOT 0 and above the current list size, this request should be REJECTED!.
   */
  export interface MissionWritePartialList extends Message {
    /**
     * Start index. Must be smaller / equal to the largest index of the current onboard list..
     */
    start_index: number
    /**
     * End index, equal or greater than start index..
     */
    end_index: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 39
   * Message encoding a mission item. This message is emitted to announce the presence of a mission item and to set a mission item on the system. The mission item can be either in x, y, z meters (type: LOCAL) or x:lat, y:lon, z:altitude. Local frame is Z-down, right handed (NED), global frame is Z-up, right handed (ENU). NaN may be used to indicate an optional/default value (e.g. to
   */
  export interface MissionItem extends Message {
    /**
     * PARAM1, see MAV_CMD enum.
     */
    param1: number
    /**
     * PARAM2, see MAV_CMD enum.
     */
    param2: number
    /**
     * PARAM3, see MAV_CMD enum.
     */
    param3: number
    /**
     * PARAM4, see MAV_CMD enum.
     */
    param4: number
    /**
     * PARAM5 / local: X coordinate, global: latitude.
     */
    x: number
    /**
     * PARAM6 / local: Y coordinate, global: longitude.
     */
    y: number
    /**
     * PARAM7 / local: Z coordinate, global: altitude (relative or absolute, depending on frame)..
     */
    z: number
    /**
     * Sequence.
     */
    seq: number
    /**
     * The scheduled action for the waypoint..
     */
    command: MavCmd
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * The coordinate system of the waypoint..
     */
    frame: MavFrame
    /**
     * false:0, true:1.
     */
    current: number
    /**
     * Autocontinue to next waypoint.
     */
    autocontinue: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 40
   * Request the information of the mission item with the sequence number seq. The response of the system to this message should be a MISSION_ITEM message. https://mavlink.io/en/services/mission.html.
   */
  export interface MissionRequest extends Message {
    /**
     * Sequence.
     */
    seq: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 41
   * Set the mission item with sequence number seq as current item. This means that the MAV will continue to this mission item on the shortest path (not following the mission items in-between)..
   */
  export interface MissionSetCurrent extends Message {
    /**
     * Sequence.
     */
    seq: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 42
   * Message that announces the sequence number of the current active mission item. The MAV will fly towards this mission item..
   */
  export interface MissionCurrent extends Message {
    /**
     * Sequence.
     */
    seq: number
  }

  /**
   * MAVLink message ID: 43
   * Request the overall list of mission items from the system/component..
   */
  export interface MissionRequestList extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 44
   * This message is emitted as response to MISSION_REQUEST_LIST by the MAV and to initiate a write transaction. The GCS can then request the individual mission item based on the knowledge of the total number of waypoints..
   */
  export interface MissionCount extends Message {
    /**
     * Number of mission items in the sequence.
     */
    count: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 45
   * Delete all mission items at once..
   */
  export interface MissionClearAll extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 46
   * A certain mission item has been reached. The system will either hold this position (or circle on the orbit) or (if the autocontinue on the WP was set) continue to the next waypoint..
   */
  export interface MissionItemReached extends Message {
    /**
     * Sequence.
     */
    seq: number
  }

  /**
   * MAVLink message ID: 47
   * Acknowledgment message during waypoint handling. The type field states if this message is a positive ack (type=0) or if an error happened (type=non-zero)..
   */
  export interface MissionAck extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mission result..
     */
    mavtype: MavMissionResult
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 48
   * Sets the GPS co-ordinates of the vehicle local origin (0,0,0) position. Vehicle should emit GPS_GLOBAL_ORIGIN irrespective of whether the origin is changed. This enables transform between the local coordinate frame and the global (GPS) coordinate frame, which may be necessary when (for example) indoor and outdoor settings are connected and the MAV should move from in- to outdoor..
   */
  export interface SetGpsGlobalOrigin extends Message {
    /**
     * Latitude (WGS84).
     */
    latitude: number
    /**
     * Longitude (WGS84).
     */
    longitude: number
    /**
     * Altitude (MSL). Positive for up..
     */
    altitude: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
  }

  /**
   * MAVLink message ID: 49
   * Publishes the GPS co-ordinates of the vehicle local origin (0,0,0) position. Emitted whenever a new GPS-Local position mapping is requested or set - e.g. following SET_GPS_GLOBAL_ORIGIN message..
   */
  export interface GpsGlobalOrigin extends Message {
    /**
     * Latitude (WGS84).
     */
    latitude: number
    /**
     * Longitude (WGS84).
     */
    longitude: number
    /**
     * Altitude (MSL). Positive for up..
     */
    altitude: number
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
  }

  /**
   * MAVLink message ID: 50
   * Bind a RC channel to a parameter. The parameter should change according to the RC channel value..
   */
  export interface ParamMapRc extends Message {
    /**
     * Initial parameter value.
     */
    param_value0: number
    /**
     * Scale, maps the RC range [-1, 1] to a parameter value.
     */
    scale: number
    /**
     * Minimum param value. The protocol does not define if this overwrites an onboard minimum value. (Depends on implementation).
     */
    param_value_min: number
    /**
     * Maximum param value. The protocol does not define if this overwrites an onboard maximum value. (Depends on implementation).
     */
    param_value_max: number
    /**
     * Parameter index. Send -1 to
     */
    param_index: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Onboard parameter id, terminated by NULL if the length is less than 16 human-readable chars and WITHOUT null termination (NULL) byte if the length is exactly 16 chars - applications have to provide 16+1 bytes storage if the ID is stored as string.
     */
    param_id: number[] // String as array of 16 chars
    /**
     * Index of parameter RC channel. Not equal to the RC channel id. Typically corresponds to a potentiometer-knob on the RC..
     */
    parameter_rc_channel_index: number
  }

  /**
   * MAVLink message ID: 51
   * Request the information of the mission item with the sequence number seq. The response of the system to this message should be a MISSION_ITEM_INT message. https://mavlink.io/en/services/mission.html.
   */
  export interface MissionRequestInt extends Message {
    /**
     * Sequence.
     */
    seq: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 52
   * A broadcast message to notify any ground station or SDK if a mission, geofence or safe points have changed on the vehicle..
   */
  export interface MissionChanged extends Message {
    /**
     * Start index for partial mission change (-1 for all items)..
     */
    start_index: number
    /**
     * End index of a partial mission change. -1 is a synonym for the last mission item (i.e. selects all items from start_index). Ignore field if start_index=-1..
     */
    end_index: number
    /**
     * System ID of the author of the new mission..
     */
    origin_sysid: number
    /**
     * Compnent ID of the author of the new mission..
     */
    origin_compid: MavComponent
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 54
   * Set a safety zone (volume), which is defined by two corners of a cube. This message can be used to tell the MAV which setpoints/waypoints to accept and which to reject. Safety areas are often enforced by national or competition regulations..
   */
  export interface SafetySetAllowedArea extends Message {
    /**
     * x position 1 / Latitude 1.
     */
    p1x: number
    /**
     * y position 1 / Longitude 1.
     */
    p1y: number
    /**
     * z position 1 / Altitude 1.
     */
    p1z: number
    /**
     * x position 2 / Latitude 2.
     */
    p2x: number
    /**
     * y position 2 / Longitude 2.
     */
    p2y: number
    /**
     * z position 2 / Altitude 2.
     */
    p2z: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Coordinate frame. Can be either global, GPS, right-handed with Z axis up or local, right handed, Z axis down..
     */
    frame: MavFrame
  }

  /**
   * MAVLink message ID: 55
   * Read out the safety zone the MAV currently assumes..
   */
  export interface SafetyAllowedArea extends Message {
    /**
     * x position 1 / Latitude 1.
     */
    p1x: number
    /**
     * y position 1 / Longitude 1.
     */
    p1y: number
    /**
     * z position 1 / Altitude 1.
     */
    p1z: number
    /**
     * x position 2 / Latitude 2.
     */
    p2x: number
    /**
     * y position 2 / Longitude 2.
     */
    p2y: number
    /**
     * z position 2 / Altitude 2.
     */
    p2z: number
    /**
     * Coordinate frame. Can be either global, GPS, right-handed with Z axis up or local, right handed, Z axis down..
     */
    frame: MavFrame
  }

  /**
   * MAVLink message ID: 61
   * The attitude in the aeronautical frame (right-handed, Z-down, X-front, Y-right), expressed as quaternion. Quaternion order is w, x, y, z and a zero rotation would be expressed as (1 0 0 0)..
   */
  export interface AttitudeQuaternionCov extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Quaternion components, w, x, y, z (1 0 0 0 is the null-rotation).
     */
    q: number[] // Array of 4 elements
    /**
     * Roll angular speed.
     */
    rollspeed: number
    /**
     * Pitch angular speed.
     */
    pitchspeed: number
    /**
     * Yaw angular speed.
     */
    yawspeed: number
    /**
     * Row-major representation of a 3x3 attitude covariance matrix (states: roll, pitch, yaw; first three entries are the first ROW, next three entries are the second row, etc.). If unknown, assign NaN value to first element in the array..
     */
    covariance: number[] // Array of 9 elements
  }

  /**
   * MAVLink message ID: 62
   * The state of the fixed wing navigation and position controller..
   */
  export interface NavControllerOutput extends Message {
    /**
     * Current desired roll.
     */
    nav_roll: number
    /**
     * Current desired pitch.
     */
    nav_pitch: number
    /**
     * Current altitude error.
     */
    alt_error: number
    /**
     * Current airspeed error.
     */
    aspd_error: number
    /**
     * Current crosstrack error on x-y plane.
     */
    xtrack_error: number
    /**
     * Current desired heading.
     */
    nav_bearing: number
    /**
     * Bearing to current waypoint/target.
     */
    target_bearing: number
    /**
     * Distance to active waypoint.
     */
    wp_dist: number
  }

  /**
   * MAVLink message ID: 63
   * The filtered global position (e.g. fused GPS and accelerometers). The position is in GPS-frame (right-handed, Z-up). Itis designed as scaled integer message since the resolution of float is not sufficient. NOTE: This message is intended for onboard networks / companion computers and higher-bandwidth links and optimized for accuracy and completeness. Please
   */
  export interface GlobalPositionIntCov extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Latitude.
     */
    lat: number
    /**
     * Longitude.
     */
    lon: number
    /**
     * Altitude in meters above MSL.
     */
    alt: number
    /**
     * Altitude above ground.
     */
    relative_alt: number
    /**
     * Ground X Speed (Latitude).
     */
    vx: number
    /**
     * Ground Y Speed (Longitude).
     */
    vy: number
    /**
     * Ground Z Speed (Altitude).
     */
    vz: number
    /**
     * Row-major representation of a 6x6 position and velocity 6x6 cross-covariance matrix (states: lat, lon, alt, vx, vy, vz; first six entries are the first ROW, next six entries are the second row, etc.). If unknown, assign NaN value to first element in the array..
     */
    covariance: number[] // Array of 36 elements
    /**
     * Class id of the estimator this estimate originated from..
     */
    estimator_type: MavEstimatorType
  }

  /**
   * MAVLink message ID: 64
   * The filtered local position (e.g. fused computer vision and accelerometers). Coordinate frame is right-handed, Z-axis down (aeronautical frame, NED / north-east-down convention).
   */
  export interface LocalPositionNedCov extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X Position.
     */
    x: number
    /**
     * Y Position.
     */
    y: number
    /**
     * Z Position.
     */
    z: number
    /**
     * X Speed.
     */
    vx: number
    /**
     * Y Speed.
     */
    vy: number
    /**
     * Z Speed.
     */
    vz: number
    /**
     * X Acceleration.
     */
    ax: number
    /**
     * Y Acceleration.
     */
    ay: number
    /**
     * Z Acceleration.
     */
    az: number
    /**
     * Row-major representation of position, velocity and acceleration 9x9 cross-covariance matrix upper right triangle (states: x, y, z, vx, vy, vz, ax, ay, az; first nine entries are the first ROW, next eight entries are the second row, etc.). If unknown, assign NaN value to first element in the array..
     */
    covariance: number[] // Array of 45 elements
    /**
     * Class id of the estimator this estimate originated from..
     */
    estimator_type: MavEstimatorType
  }

  /**
   * MAVLink message ID: 65
   * The PPM values of the RC channels received. The standard PPM modulation is as follows: 1000 microseconds: 0%, 2000 microseconds: 100%.A value of UINT16_MAX implies the channel is unused. Individual receivers/transmitters might violate this specification..
   */
  export interface RcChannels extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * RC channel 1 value..
     */
    chan1_raw: number
    /**
     * RC channel 2 value..
     */
    chan2_raw: number
    /**
     * RC channel 3 value..
     */
    chan3_raw: number
    /**
     * RC channel 4 value..
     */
    chan4_raw: number
    /**
     * RC channel 5 value..
     */
    chan5_raw: number
    /**
     * RC channel 6 value..
     */
    chan6_raw: number
    /**
     * RC channel 7 value..
     */
    chan7_raw: number
    /**
     * RC channel 8 value..
     */
    chan8_raw: number
    /**
     * RC channel 9 value..
     */
    chan9_raw: number
    /**
     * RC channel 10 value..
     */
    chan10_raw: number
    /**
     * RC channel 11 value..
     */
    chan11_raw: number
    /**
     * RC channel 12 value..
     */
    chan12_raw: number
    /**
     * RC channel 13 value..
     */
    chan13_raw: number
    /**
     * RC channel 14 value..
     */
    chan14_raw: number
    /**
     * RC channel 15 value..
     */
    chan15_raw: number
    /**
     * RC channel 16 value..
     */
    chan16_raw: number
    /**
     * RC channel 17 value..
     */
    chan17_raw: number
    /**
     * RC channel 18 value..
     */
    chan18_raw: number
    /**
     * Total number of RC channels being received. This can be larger than 18, indicating that more channels are available but not given in this message. This value should be 0 when no RC channels are available..
     */
    chancount: number
    /**
     * Receive signal strength indicator in device-dependent units/scale. Values: [0-254], 255: invalid/unknown..
     */
    rssi: number
  }

  /**
   * MAVLink message ID: 66
   * Request a data stream..
   */
  export interface RequestDataStream extends Message {
    /**
     * The requested message rate.
     */
    req_message_rate: number
    /**
     * The target requested to send the message stream..
     */
    target_system: number
    /**
     * The target requested to send the message stream..
     */
    target_component: number
    /**
     * The ID of the requested data stream.
     */
    req_stream_id: number
    /**
     * 1 to start sending, 0 to stop sending..
     */
    start_stop: number
  }

  /**
   * MAVLink message ID: 67
   * Data stream status information..
   */
  export interface DataStream extends Message {
    /**
     * The message rate.
     */
    message_rate: number
    /**
     * The ID of the requested data stream.
     */
    stream_id: number
    /**
     * 1 stream is enabled, 0 stream is stopped..
     */
    on_off: number
  }

  /**
   * MAVLink message ID: 69
   * This message provides an API for manually controlling the vehicle using standard joystick axes nomenclature, along with a joystick-like input device. Unused axes can be disabled an buttons are also transmit as boolean values of their .
   */
  export interface ManualControl extends Message {
    /**
     * X-axis, normalized to the range [-1000,1000]. A value of INT16_MAX indicates that this axis is invalid. Generally corresponds to forward(1000)-backward(-1000) movement on a joystick and the pitch of a vehicle..
     */
    x: number
    /**
     * Y-axis, normalized to the range [-1000,1000]. A value of INT16_MAX indicates that this axis is invalid. Generally corresponds to left(-1000)-right(1000) movement on a joystick and the roll of a vehicle..
     */
    y: number
    /**
     * Z-axis, normalized to the range [-1000,1000]. A value of INT16_MAX indicates that this axis is invalid. Generally corresponds to a separate slider movement with maximum being 1000 and minimum being -1000 on a joystick and the thrust of a vehicle. Positive values are positive thrust, negative values are negative thrust..
     */
    z: number
    /**
     * R-axis, normalized to the range [-1000,1000]. A value of INT16_MAX indicates that this axis is invalid. Generally corresponds to a twisting of the joystick, with counter-clockwise being 1000 and clockwise being -1000, and the yaw of a vehicle..
     */
    r: number
    /**
     * A bitfield corresponding to the joystick buttons' current state, 1 for pressed, 0 for released. The lowest bit corresponds to Button 1..
     */
    buttons: number
    /**
     * The system to be controlled..
     */
    target: number
  }

  /**
   * MAVLink message ID: 70
   * The RAW values of the RC channels sent to the MAV to override info received from the RC radio. A value of UINT16_MAX means no change to that channel. A value of 0 means control of that channel should be released back to the RC radio. The standard PPM modulation is as follows: 1000 microseconds: 0%, 2000 microseconds: 100%. Individual receivers/transmitters might violate this specification..
   */
  export interface RcChannelsOverride extends Message {
    /**
     * RC channel 1 value. A value of UINT16_MAX means to ignore this field..
     */
    chan1_raw: number
    /**
     * RC channel 2 value. A value of UINT16_MAX means to ignore this field..
     */
    chan2_raw: number
    /**
     * RC channel 3 value. A value of UINT16_MAX means to ignore this field..
     */
    chan3_raw: number
    /**
     * RC channel 4 value. A value of UINT16_MAX means to ignore this field..
     */
    chan4_raw: number
    /**
     * RC channel 5 value. A value of UINT16_MAX means to ignore this field..
     */
    chan5_raw: number
    /**
     * RC channel 6 value. A value of UINT16_MAX means to ignore this field..
     */
    chan6_raw: number
    /**
     * RC channel 7 value. A value of UINT16_MAX means to ignore this field..
     */
    chan7_raw: number
    /**
     * RC channel 8 value. A value of UINT16_MAX means to ignore this field..
     */
    chan8_raw: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * RC channel 9 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan9_raw: number
    /**
     * RC channel 10 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan10_raw: number
    /**
     * RC channel 11 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan11_raw: number
    /**
     * RC channel 12 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan12_raw: number
    /**
     * RC channel 13 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan13_raw: number
    /**
     * RC channel 14 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan14_raw: number
    /**
     * RC channel 15 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan15_raw: number
    /**
     * RC channel 16 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan16_raw: number
    /**
     * RC channel 17 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan17_raw: number
    /**
     * RC channel 18 value. A value of 0 or UINT16_MAX means to ignore this field..
     */
    chan18_raw: number
  }

  /**
   * MAVLink message ID: 73
   * Message encoding a mission item. This message is emitted to announce the presence of a mission item and to set a mission item on the system. The mission item can be either in x, y, z meters (type: LOCAL) or x:lat, y:lon, z:altitude. Local frame is Z-down, right handed (NED), global frame is Z-up, right handed (ENU). NaN or INT32_MAX may be used in float/integer params (respectively) to indicate optional/default values (e.g. to
   */
  export interface MissionItemInt extends Message {
    /**
     * PARAM1, see MAV_CMD enum.
     */
    param1: number
    /**
     * PARAM2, see MAV_CMD enum.
     */
    param2: number
    /**
     * PARAM3, see MAV_CMD enum.
     */
    param3: number
    /**
     * PARAM4, see MAV_CMD enum.
     */
    param4: number
    /**
     * PARAM5 / local: x position in meters * 1e4, global: latitude in degrees * 10^7.
     */
    x: number
    /**
     * PARAM6 / y position: local: x position in meters * 1e4, global: longitude in degrees *10^7.
     */
    y: number
    /**
     * PARAM7 / z position: global: altitude in meters (relative or absolute, depending on frame..
     */
    z: number
    /**
     * Waypoint ID (sequence number). Starts at zero. Increases monotonically for each waypoint, no gaps in the sequence (0,1,2,3,4)..
     */
    seq: number
    /**
     * The scheduled action for the waypoint..
     */
    command: MavCmd
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * The coordinate system of the waypoint..
     */
    frame: MavFrame
    /**
     * false:0, true:1.
     */
    current: number
    /**
     * Autocontinue to next waypoint.
     */
    autocontinue: number
    /**
     * Mission type..
     */
    mission_type: MavMissionType
  }

  /**
   * MAVLink message ID: 74
   * Metrics typically displayed on a HUD for fixed wing aircraft..
   */
  export interface VfrHud extends Message {
    /**
     * Vehicle speed in form appropriate for vehicle type. For standard aircraft this is typically calibrated airspeed (CAS) or indicated airspeed (IAS) - either of which can be used by a pilot to estimate stall speed..
     */
    airspeed: number
    /**
     * Current ground speed..
     */
    groundspeed: number
    /**
     * Current altitude (MSL)..
     */
    alt: number
    /**
     * Current climb rate..
     */
    climb: number
    /**
     * Current heading in compass units (0-360, 0=north)..
     */
    heading: number
    /**
     * Current throttle setting (0 to 100)..
     */
    throttle: number
  }

  /**
   * MAVLink message ID: 75
   * Message encoding a command with parameters as scaled integers. Scaling depends on the actual command value. The command microservice is documented at https://mavlink.io/en/services/command.html.
   */
  export interface CommandInt extends Message {
    /**
     * PARAM1, see MAV_CMD enum.
     */
    param1: number
    /**
     * PARAM2, see MAV_CMD enum.
     */
    param2: number
    /**
     * PARAM3, see MAV_CMD enum.
     */
    param3: number
    /**
     * PARAM4, see MAV_CMD enum.
     */
    param4: number
    /**
     * PARAM5 / local: x position in meters * 1e4, global: latitude in degrees * 10^7.
     */
    x: number
    /**
     * PARAM6 / local: y position in meters * 1e4, global: longitude in degrees * 10^7.
     */
    y: number
    /**
     * PARAM7 / z position: global: altitude in meters (relative or absolute, depending on frame)..
     */
    z: number
    /**
     * The scheduled action for the mission item..
     */
    command: MavCmd
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * The coordinate system of the COMMAND..
     */
    frame: MavFrame
    /**
     * false:0, true:1.
     */
    current: number
    /**
     * autocontinue to next wp.
     */
    autocontinue: number
  }

  /**
   * MAVLink message ID: 76
   * Send a command with up to seven parameters to the MAV. The command microservice is documented at https://mavlink.io/en/services/command.html.
   */
  export interface CommandLong extends Message {
    /**
     * Parameter 1 (for the specific command)..
     */
    param1: number
    /**
     * Parameter 2 (for the specific command)..
     */
    param2: number
    /**
     * Parameter 3 (for the specific command)..
     */
    param3: number
    /**
     * Parameter 4 (for the specific command)..
     */
    param4: number
    /**
     * Parameter 5 (for the specific command)..
     */
    param5: number
    /**
     * Parameter 6 (for the specific command)..
     */
    param6: number
    /**
     * Parameter 7 (for the specific command)..
     */
    param7: number
    /**
     * Command ID (of command to send)..
     */
    command: MavCmd
    /**
     * System which should execute the command.
     */
    target_system: number
    /**
     * Component which should execute the command, 0 for all components.
     */
    target_component: number
    /**
     * 0: First transmission of this command. 1-255: Confirmation transmissions (e.g. for kill command).
     */
    confirmation: number
  }

  /**
   * MAVLink message ID: 77
   * Report status of a command. Includes feedback whether the command was executed. The command microservice is documented at https://mavlink.io/en/services/command.html.
   */
  export interface CommandAck extends Message {
    /**
     * Command ID (of acknowledged command)..
     */
    command: MavCmd
    /**
     * Result of command..
     */
    result: MavResult
    /**
     * WIP: Also used as result_param1, it can be set with a enum containing the errors reasons of why the command was denied or the progress percentage or 255 if unknown the progress when result is MAV_RESULT_IN_PROGRESS..
     */
    progress: number
    /**
     * WIP: Additional parameter of the result, example: which parameter of MAV_CMD_NAV_WAYPOINT caused it to be denied..
     */
    result_param2: number
    /**
     * WIP: System which requested the command to be executed.
     */
    target_system: number
    /**
     * WIP: Component which requested the command to be executed.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 80
   * Cancel a long running command. The target system should respond with a COMMAND_ACK to the original command with result=MAV_RESULT_CANCELLED if the long running process was cancelled. If it has already completed, the cancel action can be ignored. The cancel action can be retried until some sort of acknowledgement to the original command has been received. The command microservice is documented at https://mavlink.io/en/services/command.html.
   */
  export interface CommandCancel extends Message {
    /**
     * Command ID (of command to cancel)..
     */
    command: MavCmd
    /**
     * System executing long running command. Should not be broadcast (0)..
     */
    target_system: number
    /**
     * Component executing long running command..
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 81
   * Setpoint in roll, pitch, yaw and thrust from the operator.
   */
  export interface ManualSetpoint extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Desired roll rate.
     */
    roll: number
    /**
     * Desired pitch rate.
     */
    pitch: number
    /**
     * Desired yaw rate.
     */
    yaw: number
    /**
     * Collective thrust, normalized to 0 .. 1.
     */
    thrust: number
    /**
     * Flight mode switch position, 0.. 255.
     */
    mode_switch: number
    /**
     * Override mode switch position, 0.. 255.
     */
    manual_override_switch: number
  }

  /**
   * MAVLink message ID: 82
   * Sets a desired vehicle attitude. Used by an external controller to command the vehicle (manual controller or other system)..
   */
  export interface SetAttitudeTarget extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Attitude quaternion (w, x, y, z order, zero-rotation is 1, 0, 0, 0).
     */
    q: number[] // Array of 4 elements
    /**
     * Body roll rate.
     */
    body_roll_rate: number
    /**
     * Body pitch rate.
     */
    body_pitch_rate: number
    /**
     * Body yaw rate.
     */
    body_yaw_rate: number
    /**
     * Collective thrust, normalized to 0 .. 1 (-1 .. 1 for vehicles capable of reverse trust).
     */
    thrust: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Mappings: If any of these bits are set, the corresponding input should be ignored: bit 1: body roll rate, bit 2: body pitch rate, bit 3: body yaw rate. bit 4-bit 6: reserved, bit 7: throttle, bit 8: attitude.
     */
    type_mask: number
  }

  /**
   * MAVLink message ID: 83
   * Reports the current commanded attitude of the vehicle as specified by the autopilot. This should match the commands sent in a SET_ATTITUDE_TARGET message if the vehicle is being controlled this way..
   */
  export interface AttitudeTarget extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Attitude quaternion (w, x, y, z order, zero-rotation is 1, 0, 0, 0).
     */
    q: number[] // Array of 4 elements
    /**
     * Body roll rate.
     */
    body_roll_rate: number
    /**
     * Body pitch rate.
     */
    body_pitch_rate: number
    /**
     * Body yaw rate.
     */
    body_yaw_rate: number
    /**
     * Collective thrust, normalized to 0 .. 1 (-1 .. 1 for vehicles capable of reverse trust).
     */
    thrust: number
    /**
     * Mappings: If any of these bits are set, the corresponding input should be ignored: bit 1: body roll rate, bit 2: body pitch rate, bit 3: body yaw rate. bit 4-bit 7: reserved, bit 8: attitude.
     */
    type_mask: number
  }

  /**
   * MAVLink message ID: 84
   * Sets a desired vehicle position in a local north-east-down coordinate frame. Used by an external controller to command the vehicle (manual controller or other system)..
   */
  export interface SetPositionTargetLocalNed extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * X Position in NED frame.
     */
    x: number
    /**
     * Y Position in NED frame.
     */
    y: number
    /**
     * Z Position in NED frame (note, altitude is negative in NED).
     */
    z: number
    /**
     * X velocity in NED frame.
     */
    vx: number
    /**
     * Y velocity in NED frame.
     */
    vy: number
    /**
     * Z velocity in NED frame.
     */
    vz: number
    /**
     * X acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afx: number
    /**
     * Y acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afy: number
    /**
     * Z acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afz: number
    /**
     * yaw setpoint.
     */
    yaw: number
    /**
     * yaw rate setpoint.
     */
    yaw_rate: number
    /**
     * Bitmap to indicate which dimensions should be ignored by the vehicle..
     */
    type_mask: BitFlag // TODO: PositionTargetTypemask https://mavlink.io/en/messages/common.html#POSITION_TARGET_TYPEMASK
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Valid options are: MAV_FRAME_LOCAL_NED = 1, MAV_FRAME_LOCAL_OFFSET_NED = 7, MAV_FRAME_BODY_NED = 8, MAV_FRAME_BODY_OFFSET_NED = 9.
     */
    coordinate_frame: MavFrame
  }

  /**
   * MAVLink message ID: 85
   * Reports the current commanded vehicle position, velocity, and acceleration as specified by the autopilot. This should match the commands sent in SET_POSITION_TARGET_LOCAL_NED if the vehicle is being controlled this way..
   */
  export interface PositionTargetLocalNed extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * X Position in NED frame.
     */
    x: number
    /**
     * Y Position in NED frame.
     */
    y: number
    /**
     * Z Position in NED frame (note, altitude is negative in NED).
     */
    z: number
    /**
     * X velocity in NED frame.
     */
    vx: number
    /**
     * Y velocity in NED frame.
     */
    vy: number
    /**
     * Z velocity in NED frame.
     */
    vz: number
    /**
     * X acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afx: number
    /**
     * Y acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afy: number
    /**
     * Z acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afz: number
    /**
     * yaw setpoint.
     */
    yaw: number
    /**
     * yaw rate setpoint.
     */
    yaw_rate: number
    /**
     * Bitmap to indicate which dimensions should be ignored by the vehicle..
     */
    type_mask: BitFlag // TODO: PositionTargetTypemask https://mavlink.io/en/messages/common.html#POSITION_TARGET_TYPEMASK
    /**
     * Valid options are: MAV_FRAME_LOCAL_NED = 1, MAV_FRAME_LOCAL_OFFSET_NED = 7, MAV_FRAME_BODY_NED = 8, MAV_FRAME_BODY_OFFSET_NED = 9.
     */
    coordinate_frame: MavFrame
  }

  /**
   * MAVLink message ID: 86
   * Sets a desired vehicle position, velocity, and/or acceleration in a global coordinate system (WGS84). Used by an external controller to command the vehicle (manual controller or other system)..
   */
  export interface SetPositionTargetGlobalInt extends Message {
    /**
     * Timestamp (time since system boot). The rationale for the timestamp in the setpoint is to allow the system to compensate for the transport delay of the setpoint. This allows the system to compensate processing latency..
     */
    time_boot_ms: number
    /**
     * X Position in WGS84 frame.
     */
    lat_int: number
    /**
     * Y Position in WGS84 frame.
     */
    lon_int: number
    /**
     * Altitude (MSL, Relative to home, or AGL - depending on frame).
     */
    alt: number
    /**
     * X velocity in NED frame.
     */
    vx: number
    /**
     * Y velocity in NED frame.
     */
    vy: number
    /**
     * Z velocity in NED frame.
     */
    vz: number
    /**
     * X acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afx: number
    /**
     * Y acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afy: number
    /**
     * Z acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afz: number
    /**
     * yaw setpoint.
     */
    yaw: number
    /**
     * yaw rate setpoint.
     */
    yaw_rate: number
    /**
     * Bitmap to indicate which dimensions should be ignored by the vehicle..
     */
    type_mask: BitFlag // TODO: PositionTargetTypemask https://mavlink.io/en/messages/common.html#POSITION_TARGET_TYPEMASK
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Valid options are: MAV_FRAME_GLOBAL_INT = 5, MAV_FRAME_GLOBAL_RELATIVE_ALT_INT = 6, MAV_FRAME_GLOBAL_TERRAIN_ALT_INT = 11.
     */
    coordinate_frame: MavFrame
  }

  /**
   * MAVLink message ID: 87
   * Reports the current commanded vehicle position, velocity, and acceleration as specified by the autopilot. This should match the commands sent in SET_POSITION_TARGET_GLOBAL_INT if the vehicle is being controlled this way..
   */
  export interface PositionTargetGlobalInt extends Message {
    /**
     * Timestamp (time since system boot). The rationale for the timestamp in the setpoint is to allow the system to compensate for the transport delay of the setpoint. This allows the system to compensate processing latency..
     */
    time_boot_ms: number
    /**
     * X Position in WGS84 frame.
     */
    lat_int: number
    /**
     * Y Position in WGS84 frame.
     */
    lon_int: number
    /**
     * Altitude (MSL, AGL or relative to home altitude, depending on frame).
     */
    alt: number
    /**
     * X velocity in NED frame.
     */
    vx: number
    /**
     * Y velocity in NED frame.
     */
    vy: number
    /**
     * Z velocity in NED frame.
     */
    vz: number
    /**
     * X acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afx: number
    /**
     * Y acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afy: number
    /**
     * Z acceleration or force (if bit 10 of type_mask is set) in NED frame in meter / s^2 or N.
     */
    afz: number
    /**
     * yaw setpoint.
     */
    yaw: number
    /**
     * yaw rate setpoint.
     */
    yaw_rate: number
    /**
     * Bitmap to indicate which dimensions should be ignored by the vehicle..
     */
    type_mask: BitFlag // TODO: PositionTargetTypemask https://mavlink.io/en/messages/common.html#POSITION_TARGET_TYPEMASK
    /**
     * Valid options are: MAV_FRAME_GLOBAL_INT = 5, MAV_FRAME_GLOBAL_RELATIVE_ALT_INT = 6, MAV_FRAME_GLOBAL_TERRAIN_ALT_INT = 11.
     */
    coordinate_frame: MavFrame
  }

  /**
   * MAVLink message ID: 89
   * The offset in X, Y, Z and yaw between the LOCAL_POSITION_NED messages of MAV X and the global coordinate frame in NED coordinates. Coordinate frame is right-handed, Z-axis down (aeronautical frame, NED / north-east-down convention).
   */
  export interface LocalPositionNedSystemGlobalOffset extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * X Position.
     */
    x: number
    /**
     * Y Position.
     */
    y: number
    /**
     * Z Position.
     */
    z: number
    /**
     * Roll.
     */
    roll: number
    /**
     * Pitch.
     */
    pitch: number
    /**
     * Yaw.
     */
    yaw: number
  }

  /**
   * MAVLink message ID: 90
   * Sent from simulation to autopilot. This packet is useful for high throughput applications such as hardware in the loop simulations..
   */
  export interface HilState extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Roll angle.
     */
    roll: number
    /**
     * Pitch angle.
     */
    pitch: number
    /**
     * Yaw angle.
     */
    yaw: number
    /**
     * Body frame roll / phi angular speed.
     */
    rollspeed: number
    /**
     * Body frame pitch / theta angular speed.
     */
    pitchspeed: number
    /**
     * Body frame yaw / psi angular speed.
     */
    yawspeed: number
    /**
     * Latitude.
     */
    lat: number
    /**
     * Longitude.
     */
    lon: number
    /**
     * Altitude.
     */
    alt: number
    /**
     * Ground X Speed (Latitude).
     */
    vx: number
    /**
     * Ground Y Speed (Longitude).
     */
    vy: number
    /**
     * Ground Z Speed (Altitude).
     */
    vz: number
    /**
     * X acceleration.
     */
    xacc: number
    /**
     * Y acceleration.
     */
    yacc: number
    /**
     * Z acceleration.
     */
    zacc: number
  }

  /**
   * MAVLink message ID: 91
   * Sent from autopilot to simulation. Hardware in the loop control outputs.
   */
  export interface HilControls extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Control output -1 .. 1.
     */
    roll_ailerons: number
    /**
     * Control output -1 .. 1.
     */
    pitch_elevator: number
    /**
     * Control output -1 .. 1.
     */
    yaw_rudder: number
    /**
     * Throttle 0 .. 1.
     */
    throttle: number
    /**
     * Aux 1, -1 .. 1.
     */
    aux1: number
    /**
     * Aux 2, -1 .. 1.
     */
    aux2: number
    /**
     * Aux 3, -1 .. 1.
     */
    aux3: number
    /**
     * Aux 4, -1 .. 1.
     */
    aux4: number
    /**
     * System mode..
     */
    mode: Type<MavMode>
    /**
     * Navigation mode (MAV_NAV_MODE).
     */
    nav_mode: number
  }

  /**
   * MAVLink message ID: 92
   * Sent from simulation to autopilot. The RAW values of the RC channels received. The standard PPM modulation is as follows: 1000 microseconds: 0%, 2000 microseconds: 100%. Individual receivers/transmitters might violate this specification..
   */
  export interface HilRcInputsRaw extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * RC channel 1 value.
     */
    chan1_raw: number
    /**
     * RC channel 2 value.
     */
    chan2_raw: number
    /**
     * RC channel 3 value.
     */
    chan3_raw: number
    /**
     * RC channel 4 value.
     */
    chan4_raw: number
    /**
     * RC channel 5 value.
     */
    chan5_raw: number
    /**
     * RC channel 6 value.
     */
    chan6_raw: number
    /**
     * RC channel 7 value.
     */
    chan7_raw: number
    /**
     * RC channel 8 value.
     */
    chan8_raw: number
    /**
     * RC channel 9 value.
     */
    chan9_raw: number
    /**
     * RC channel 10 value.
     */
    chan10_raw: number
    /**
     * RC channel 11 value.
     */
    chan11_raw: number
    /**
     * RC channel 12 value.
     */
    chan12_raw: number
    /**
     * Receive signal strength indicator in device-dependent units/scale. Values: [0-254], 255: invalid/unknown..
     */
    rssi: number
  }

  /**
   * MAVLink message ID: 93
   * Sent from autopilot to simulation. Hardware in the loop control outputs (replacement for HIL_CONTROLS).
   */
  export interface HilActuatorControls extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Flags as bitfield, 1: indicate simulation using lockstep..
     */
    flags: number
    /**
     * Control outputs -1 .. 1. Channel assignment depends on the simulated hardware..
     */
    controls: number[] // Array of 16 elements
    /**
     * System mode. Includes arming state..
     */
    mode: BitFlag // TODO: MavModeFlag https://mavlink.io/en/messages/common.html#MAV_MODE_FLAG
  }

  /**
   * MAVLink message ID: 100
   * Optical flow from a flow sensor (e.g. optical mo
   */
  export interface OpticalFlow extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Flow in x-sensor direction, angular-speed compensated.
     */
    flow_comp_m_x: number
    /**
     * Flow in y-sensor direction, angular-speed compensated.
     */
    flow_comp_m_y: number
    /**
     * Ground distance. Positive value: distance known. Negative value: Unknown distance.
     */
    ground_distance: number
    /**
     * Flow in x-sensor direction.
     */
    flow_x: number
    /**
     * Flow in y-sensor direction.
     */
    flow_y: number
    /**
     * Sensor ID.
     */
    sensor_id: number
    /**
     * Optical flow quality / confidence. 0: bad, 255: maximum quality.
     */
    quality: number
    /**
     * Flow rate about X axis.
     */
    flow_rate_x: number
    /**
     * Flow rate about Y axis.
     */
    flow_rate_y: number
  }

  /**
   * MAVLink message ID: 101
   * Global position/attitude estimate from a vision source..
   */
  export interface GlobalVisionPositionEstimate extends Message {
    /**
     * Timestamp (UNIX time or since system boot).
     */
    usec: number
    /**
     * Global X position.
     */
    x: number
    /**
     * Global Y position.
     */
    y: number
    /**
     * Global Z position.
     */
    z: number
    /**
     * Roll angle.
     */
    roll: number
    /**
     * Pitch angle.
     */
    pitch: number
    /**
     * Yaw angle.
     */
    yaw: number
    /**
     * Row-major representation of pose 6x6 cross-covariance matrix upper right triangle (states: x_global, y_global, z_global, roll, pitch, yaw; first six entries are the first ROW, next five entries are the second ROW, etc.). If unknown, assign NaN value to first element in the array..
     */
    covariance: number[] // Array of 21 elements
    /**
     * Estimate reset counter. This should be incremented when the estimate resets in any of the dimensions (position, velocity, attitude, angular speed). This is designed to be used when e.g an external SLAM system detects a loop-closure and the estimate jumps..
     */
    reset_counter: number
  }

  /**
   * MAVLink message ID: 102
   * Local position/attitude estimate from a vision source..
   */
  export interface VisionPositionEstimate extends Message {
    /**
     * Timestamp (UNIX time or time since system boot).
     */
    usec: number
    /**
     * Local X position.
     */
    x: number
    /**
     * Local Y position.
     */
    y: number
    /**
     * Local Z position.
     */
    z: number
    /**
     * Roll angle.
     */
    roll: number
    /**
     * Pitch angle.
     */
    pitch: number
    /**
     * Yaw angle.
     */
    yaw: number
    /**
     * Row-major representation of pose 6x6 cross-covariance matrix upper right triangle (states: x, y, z, roll, pitch, yaw; first six entries are the first ROW, next five entries are the second ROW, etc.). If unknown, assign NaN value to first element in the array..
     */
    covariance: number[] // Array of 21 elements
    /**
     * Estimate reset counter. This should be incremented when the estimate resets in any of the dimensions (position, velocity, attitude, angular speed). This is designed to be used when e.g an external SLAM system detects a loop-closure and the estimate jumps..
     */
    reset_counter: number
  }

  /**
   * MAVLink message ID: 103
   * Speed estimate from a vision source..
   */
  export interface VisionSpeedEstimate extends Message {
    /**
     * Timestamp (UNIX time or time since system boot).
     */
    usec: number
    /**
     * Global X speed.
     */
    x: number
    /**
     * Global Y speed.
     */
    y: number
    /**
     * Global Z speed.
     */
    z: number
    /**
     * Row-major representation of 3x3 linear velocity covariance matrix (states: vx, vy, vz; 1st three entries - 1st row, etc.). If unknown, assign NaN value to first element in the array..
     */
    covariance: number[] // Array of 9 elements
    /**
     * Estimate reset counter. This should be incremented when the estimate resets in any of the dimensions (position, velocity, attitude, angular speed). This is designed to be used when e.g an external SLAM system detects a loop-closure and the estimate jumps..
     */
    reset_counter: number
  }

  /**
   * MAVLink message ID: 104
   * Global position estimate from a Vicon motion system source..
   */
  export interface ViconPositionEstimate extends Message {
    /**
     * Timestamp (UNIX time or time since system boot).
     */
    usec: number
    /**
     * Global X position.
     */
    x: number
    /**
     * Global Y position.
     */
    y: number
    /**
     * Global Z position.
     */
    z: number
    /**
     * Roll angle.
     */
    roll: number
    /**
     * Pitch angle.
     */
    pitch: number
    /**
     * Yaw angle.
     */
    yaw: number
    /**
     * Row-major representation of 6x6 pose cross-covariance matrix upper right triangle (states: x, y, z, roll, pitch, yaw; first six entries are the first ROW, next five entries are the second ROW, etc.). If unknown, assign NaN value to first element in the array..
     */
    covariance: number[] // Array of 21 elements
  }

  /**
   * MAVLink message ID: 105
   * The IMU readings in SI units in NED body frame.
   */
  export interface HighresImu extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X acceleration.
     */
    xacc: number
    /**
     * Y acceleration.
     */
    yacc: number
    /**
     * Z acceleration.
     */
    zacc: number
    /**
     * Angular speed around X axis.
     */
    xgyro: number
    /**
     * Angular speed around Y axis.
     */
    ygyro: number
    /**
     * Angular speed around Z axis.
     */
    zgyro: number
    /**
     * X Magnetic field.
     */
    xmag: number
    /**
     * Y Magnetic field.
     */
    ymag: number
    /**
     * Z Magnetic field.
     */
    zmag: number
    /**
     * Absolute pressure.
     */
    abs_pressure: number
    /**
     * Differential pressure.
     */
    diff_pressure: number
    /**
     * Altitude calculated from pressure.
     */
    pressure_alt: number
    /**
     * Temperature.
     */
    temperature: number
    /**
     * Bitmap for fields that have updated since last message, bit 0 = xacc, bit 12: temperature.
     */
    fields_updated: number
    /**
     * Id. Ids are numbered from 0 and map to IMUs numbered from 1 (e.g. IMU1 will have a message with id=0).
     */
    id: number
  }

  /**
   * MAVLink message ID: 106
   * Optical flow from an angular rate flow sensor (e.g. PX4FLOW or mo
   */
  export interface OpticalFlowRad extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Integration time. Divide integrated_x and integrated_y by the integration time to obtain average flow. The integration time also indicates the..
     */
    integration_time_us: number
    /**
     * Flow around X axis (Sensor RH rotation about the X axis induces a positive flow. Sensor linear motion along the positive Y axis induces a negative flow.).
     */
    integrated_x: number
    /**
     * Flow around Y axis (Sensor RH rotation about the Y axis induces a positive flow. Sensor linear motion along the positive X axis induces a positive flow.).
     */
    integrated_y: number
    /**
     * RH rotation around X axis.
     */
    integrated_xgyro: number
    /**
     * RH rotation around Y axis.
     */
    integrated_ygyro: number
    /**
     * RH rotation around Z axis.
     */
    integrated_zgyro: number
    /**
     * Time since the distance was sampled..
     */
    time_delta_distance_us: number
    /**
     * Distance to the center of the flow field. Positive value (including zero): distance known. Negative value: Unknown distance..
     */
    distance: number
    /**
     * Temperature.
     */
    temperature: number
    /**
     * Sensor ID.
     */
    sensor_id: number
    /**
     * Optical flow quality / confidence. 0: no valid flow, 255: maximum quality.
     */
    quality: number
  }

  /**
   * MAVLink message ID: 107
   * The IMU readings in SI units in NED body frame.
   */
  export interface HilSensor extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X acceleration.
     */
    xacc: number
    /**
     * Y acceleration.
     */
    yacc: number
    /**
     * Z acceleration.
     */
    zacc: number
    /**
     * Angular speed around X axis in body frame.
     */
    xgyro: number
    /**
     * Angular speed around Y axis in body frame.
     */
    ygyro: number
    /**
     * Angular speed around Z axis in body frame.
     */
    zgyro: number
    /**
     * X Magnetic field.
     */
    xmag: number
    /**
     * Y Magnetic field.
     */
    ymag: number
    /**
     * Z Magnetic field.
     */
    zmag: number
    /**
     * Absolute pressure.
     */
    abs_pressure: number
    /**
     * Differential pressure (airspeed).
     */
    diff_pressure: number
    /**
     * Altitude calculated from pressure.
     */
    pressure_alt: number
    /**
     * Temperature.
     */
    temperature: number
    /**
     * Bitmap for fields that have updated since last message, bit 0 = xacc, bit 12: temperature, bit 31: full reset of attitude/position/velocities/etc was performed in sim..
     */
    fields_updated: number
  }

  /**
   * MAVLink message ID: 108
   * Status of simulation environment, if used.
   */
  export interface SimState extends Message {
    /**
     * True attitude quaternion component 1, w (1 in null-rotation).
     */
    q1: number
    /**
     * True attitude quaternion component 2, x (0 in null-rotation).
     */
    q2: number
    /**
     * True attitude quaternion component 3, y (0 in null-rotation).
     */
    q3: number
    /**
     * True attitude quaternion component 4, z (0 in null-rotation).
     */
    q4: number
    /**
     * Attitude roll expressed as Euler angles, not recommended except for human-readable outputs.
     */
    roll: number
    /**
     * Attitude pitch expressed as Euler angles, not recommended except for human-readable outputs.
     */
    pitch: number
    /**
     * Attitude yaw expressed as Euler angles, not recommended except for human-readable outputs.
     */
    yaw: number
    /**
     * X acceleration.
     */
    xacc: number
    /**
     * Y acceleration.
     */
    yacc: number
    /**
     * Z acceleration.
     */
    zacc: number
    /**
     * Angular speed around X axis.
     */
    xgyro: number
    /**
     * Angular speed around Y axis.
     */
    ygyro: number
    /**
     * Angular speed around Z axis.
     */
    zgyro: number
    /**
     * Latitude.
     */
    lat: number
    /**
     * Longitude.
     */
    lon: number
    /**
     * Altitude.
     */
    alt: number
    /**
     * Horizontal position standard deviation.
     */
    std_dev_horz: number
    /**
     * Vertical position standard deviation.
     */
    std_dev_vert: number
    /**
     * True velocity in north direction in earth-fixed NED frame.
     */
    vn: number
    /**
     * True velocity in east direction in earth-fixed NED frame.
     */
    ve: number
    /**
     * True velocity in down direction in earth-fixed NED frame.
     */
    vd: number
  }

  /**
   * MAVLink message ID: 109
   * Status generated by radio and injected into MAVLink stream..
   */
  export interface RadioStatus extends Message {
    /**
     * Count of radio packet receive errors (since boot)..
     */
    rxerrors: number
    /**
     * Count of error corrected radio packets (since boot)..
     */
    fixed: number
    /**
     * Local (message sender) recieved signal strength indication in device-dependent units/scale. Values: [0-254], 255: invalid/unknown..
     */
    rssi: number
    /**
     * Remote (message receiver) signal strength indication in device-dependent units/scale. Values: [0-254], 255: invalid/unknown..
     */
    remrssi: number
    /**
     * Remaining free transmitter buffer space..
     */
    txbuf: number
    /**
     * Local background noise level. These are device dependent RSSI values (scale as approx 2x dB on SiK radios). Values: [0-254], 255: invalid/unknown..
     */
    noise: number
    /**
     * Remote background noise level. These are device dependent RSSI values (scale as approx 2x dB on SiK radios). Values: [0-254], 255: invalid/unknown..
     */
    remnoise: number
  }

  /**
   * MAVLink message ID: 110
   * File transfer message.
   */
  export interface FileTransferProtocol extends Message {
    /**
     * Network ID (0 for broadcast).
     */
    target_network: number
    /**
     * System ID (0 for broadcast).
     */
    target_system: number
    /**
     * Component ID (0 for broadcast).
     */
    target_component: number
    /**
     * Variable length payload. The length is defined by the remaining message length when subtracting the header and other fields.The entire content of this block is opaque unless you understand any the encoding message_type.The particular encoding used can be extension specific and might not always be documented as part of the mavlink specification..
     */
    payload: number[] // Array of 251 elements
  }

  /**
   * MAVLink message ID: 111
   * Time synchronization message..
   */
  export interface Timesync extends Message {
    /**
     * Time sync timestamp 1.
     */
    tc1: number
    /**
     * Time sync timestamp 2.
     */
    ts1: number
  }

  /**
   * MAVLink message ID: 112
   * Camera-IMU triggering and synchronisation message..
   */
  export interface CameraTrigger extends Message {
    /**
     * Timestamp for image frame (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Image frame sequence.
     */
    seq: number
  }

  /**
   * MAVLink message ID: 113
   * The global position, as returned by the Global Positioning System (GPS). This isNOT the global position estimate of the sytem, but rather a RAW sensor value. See message GLOBAL_POSITION for the global position estimate..
   */
  export interface HilGps extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Latitude (WGS84).
     */
    lat: number
    /**
     * Longitude (WGS84).
     */
    lon: number
    /**
     * Altitude (MSL). Positive for up..
     */
    alt: number
    /**
     * GPS HDOP horizontal dilution of position. If unknown, set to: 65535.
     */
    eph: number
    /**
     * GPS VDOP vertical dilution of position. If unknown, set to: 65535.
     */
    epv: number
    /**
     * GPS ground speed. If unknown, set to: 65535.
     */
    vel: number
    /**
     * GPS velocity in north direction in earth-fixed NED frame.
     */
    vn: number
    /**
     * GPS velocity in east direction in earth-fixed NED frame.
     */
    ve: number
    /**
     * GPS velocity in down direction in earth-fixed NED frame.
     */
    vd: number
    /**
     * Course over ground (NOT heading, but direction of movement), 0.0..359.99 degrees. If unknown, set to: 65535.
     */
    cog: number
    /**
     * 0-1: no fix, 2: 2D fix, 3: 3D fix. Some applications will not
     */
    fix_type: number
    /**
     * Number of satellites visible. If unknown, set to 255.
     */
    satellites_visible: number
    /**
     * GPS ID (zero indexed). Used for multiple GPS inputs.
     */
    id: number
  }

  /**
   * MAVLink message ID: 114
   * Simulated optical flow from a flow sensor (e.g. PX4FLOW or optical mo
   */
  export interface HilOpticalFlow extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Integration time. Divide integrated_x and integrated_y by the integration time to obtain average flow. The integration time also indicates the..
     */
    integration_time_us: number
    /**
     * Flow in radians around X axis (Sensor RH rotation about the X axis induces a positive flow. Sensor linear motion along the positive Y axis induces a negative flow.).
     */
    integrated_x: number
    /**
     * Flow in radians around Y axis (Sensor RH rotation about the Y axis induces a positive flow. Sensor linear motion along the positive X axis induces a positive flow.).
     */
    integrated_y: number
    /**
     * RH rotation around X axis.
     */
    integrated_xgyro: number
    /**
     * RH rotation around Y axis.
     */
    integrated_ygyro: number
    /**
     * RH rotation around Z axis.
     */
    integrated_zgyro: number
    /**
     * Time since the distance was sampled..
     */
    time_delta_distance_us: number
    /**
     * Distance to the center of the flow field. Positive value (including zero): distance known. Negative value: Unknown distance..
     */
    distance: number
    /**
     * Temperature.
     */
    temperature: number
    /**
     * Sensor ID.
     */
    sensor_id: number
    /**
     * Optical flow quality / confidence. 0: no valid flow, 255: maximum quality.
     */
    quality: number
  }

  /**
   * MAVLink message ID: 115
   * Sent from simulation to autopilot, avoids in contrast to HIL_STATE singularities. This packet is useful for high throughput applications such as hardware in the loop simulations..
   */
  export interface HilStateQuaternion extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Vehicle attitude expressed as normalized quaternion in w, x, y, z order (with 1 0 0 0 being the null-rotation).
     */
    attitude_quaternion: number[] // Array of 4 elements
    /**
     * Body frame roll / phi angular speed.
     */
    rollspeed: number
    /**
     * Body frame pitch / theta angular speed.
     */
    pitchspeed: number
    /**
     * Body frame yaw / psi angular speed.
     */
    yawspeed: number
    /**
     * Latitude.
     */
    lat: number
    /**
     * Longitude.
     */
    lon: number
    /**
     * Altitude.
     */
    alt: number
    /**
     * Ground X Speed (Latitude).
     */
    vx: number
    /**
     * Ground Y Speed (Longitude).
     */
    vy: number
    /**
     * Ground Z Speed (Altitude).
     */
    vz: number
    /**
     * Indicated airspeed.
     */
    ind_airspeed: number
    /**
     * True airspeed.
     */
    true_airspeed: number
    /**
     * X acceleration.
     */
    xacc: number
    /**
     * Y acceleration.
     */
    yacc: number
    /**
     * Z acceleration.
     */
    zacc: number
  }

  /**
   * MAVLink message ID: 116
   * The RAW IMU readings for secondary 9DOF sensor setup. This message should contain the scaled values to the described units.
   */
  export interface ScaledImu2 extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * X acceleration.
     */
    xacc: number
    /**
     * Y acceleration.
     */
    yacc: number
    /**
     * Z acceleration.
     */
    zacc: number
    /**
     * Angular speed around X axis.
     */
    xgyro: number
    /**
     * Angular speed around Y axis.
     */
    ygyro: number
    /**
     * Angular speed around Z axis.
     */
    zgyro: number
    /**
     * X Magnetic field.
     */
    xmag: number
    /**
     * Y Magnetic field.
     */
    ymag: number
    /**
     * Z Magnetic field.
     */
    zmag: number
    /**
     * Temperature, 0: IMU does not provide temperature values. If the IMU is at 0C it must send 1 (0.01C)..
     */
    temperature: number
  }

  /**
   * MAVLink message ID: 117
   * Request a list of available logs. On some systems calling this may stop on-board logging until LOG_REQUEST_END is called. If there are no log files available this request shall be answered with one LOG_ENTRY message with id = 0 and num_logs = 0..
   */
  export interface LogRequestList extends Message {
    /**
     * First log id (0 for first available).
     */
    start: number
    /**
     * Last log id (0xffff for last available).
     */
    end: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 118
   * Reply to LOG_REQUEST_LIST.
   */
  export interface LogEntry extends Message {
    /**
     * UTC timestamp of log since 1970, or 0 if not available.
     */
    time_utc: number
    /**
     * Size of the log (may be approximate).
     */
    size: number
    /**
     * Log id.
     */
    id: number
    /**
     * Total number of logs.
     */
    num_logs: number
    /**
     * High log number.
     */
    last_log_num: number
  }

  /**
   * MAVLink message ID: 119
   * Request a chunk of a log.
   */
  export interface LogRequestData extends Message {
    /**
     * Offset into the log.
     */
    ofs: number
    /**
     * Number of bytes.
     */
    count: number
    /**
     * Log id (from LOG_ENTRY reply).
     */
    id: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 120
   * Reply to LOG_REQUEST_DATA.
   */
  export interface LogData extends Message {
    /**
     * Offset into the log.
     */
    ofs: number
    /**
     * Log id (from LOG_ENTRY reply).
     */
    id: number
    /**
     * Number of bytes (zero for end of log).
     */
    count: number
    /**
     * log data.
     */
    data: number[] // Array of 90 elements
  }

  /**
   * MAVLink message ID: 121
   * Erase all logs.
   */
  export interface LogErase extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 122
   * Stop log transfer and resume normal logging.
   */
  export interface LogRequestEnd extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 123
   * Data for injecting into the onboard GPS (used for DGPS).
   */
  export interface GpsInjectData extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Data length.
     */
    len: number
    /**
     * Raw data (110 is enough for 12 satellites of RTCMv2).
     */
    data: number[] // Array of 110 elements
  }

  /**
   * MAVLink message ID: 124
   * Second GPS data..
   */
  export interface Gps2Raw extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Latitude (WGS84).
     */
    lat: number
    /**
     * Longitude (WGS84).
     */
    lon: number
    /**
     * Altitude (MSL). Positive for up..
     */
    alt: number
    /**
     * Age of DGPS info.
     */
    dgps_age: number
    /**
     * GPS HDOP horizontal dilution of position. If unknown, set to: UINT16_MAX.
     */
    eph: number
    /**
     * GPS VDOP vertical dilution of position. If unknown, set to: UINT16_MAX.
     */
    epv: number
    /**
     * GPS ground speed. If unknown, set to: UINT16_MAX.
     */
    vel: number
    /**
     * Course over ground (NOT heading, but direction of movement): 0.0..359.99 degrees. If unknown, set to: UINT16_MAX.
     */
    cog: number
    /**
     * GPS fix type..
     */
    fix_type: GpsFixType
    /**
     * Number of satellites visible. If unknown, set to 255.
     */
    satellites_visible: number
    /**
     * Number of DGPS satellites.
     */
    dgps_numch: number
    /**
     * Yaw in earth frame from north.
     */
    yaw: number
  }

  /**
   * MAVLink message ID: 125
   * Power supply status.
   */
  export interface PowerStatus extends Message {
    /**
     * 5V rail voltage..
     */
    Vcc: number
    /**
     * Servo rail voltage..
     */
    Vservo: number
    /**
     * Bitmap of power supply status flags..
     */
    flags: BitFlag // TODO: MavPowerStatus https://mavlink.io/en/messages/common.html#MAV_POWER_STATUS
  }

  /**
   * MAVLink message ID: 126
   * Control a serial port. This can be used for raw access to an onboard serial peripheral such as a GPS or telemetry radio. It is designed to make it possible to update the devices firmware via MAVLink messages or change the devices settings. A message with zero bytes can be used to change just the baudrate..
   */
  export interface SerialControl extends Message {
    /**
     * Baudrate of transfer. Zero means no change..
     */
    baudrate: number
    /**
     * Timeout for reply data.
     */
    timeout: number
    /**
     * Serial control device type..
     */
    device: SerialControlDev
    /**
     * Bitmap of serial control flags..
     */
    flags: BitFlag // TODO: SerialControlFlag https://mavlink.io/en/messages/common.html#SERIAL_CONTROL_FLAG
    /**
     * how many bytes in this transfer.
     */
    count: number
    /**
     * serial data.
     */
    data: number[] // Array of 70 elements
  }

  /**
   * MAVLink message ID: 127
   * RTK GPS data. Gives information on the relative baseline calculation the GPS is reporting.
   */
  export interface GpsRtk extends Message {
    /**
     * Time since boot of last baseline message received..
     */
    time_last_baseline_ms: number
    /**
     * GPS Time of Week of last baseline.
     */
    tow: number
    /**
     * Current baseline in ECEF x or NED north component..
     */
    baseline_a_mm: number
    /**
     * Current baseline in ECEF y or NED east component..
     */
    baseline_b_mm: number
    /**
     * Current baseline in ECEF z or NED down component..
     */
    baseline_c_mm: number
    /**
     * Current estimate of baseline accuracy..
     */
    accuracy: number
    /**
     * Current number of integer ambiguity hypotheses..
     */
    iar_num_hypotheses: number
    /**
     * GPS Week Number of last baseline.
     */
    wn: number
    /**
     * Identification of connected RTK receiver..
     */
    rtk_receiver_id: number
    /**
     * GPS-specific health report for RTK data..
     */
    rtk_health: number
    /**
     * Rate of baseline messages being received by GPS.
     */
    rtk_rate: number
    /**
     * Current number of sats used for RTK calculation..
     */
    nsats: number
    /**
     * Coordinate system of baseline.
     */
    baseline_coords_type: RtkBaselineCoordinateSystem
  }

  /**
   * MAVLink message ID: 128
   * RTK GPS data. Gives information on the relative baseline calculation the GPS is reporting.
   */
  export interface Gps2Rtk extends Message {
    /**
     * Time since boot of last baseline message received..
     */
    time_last_baseline_ms: number
    /**
     * GPS Time of Week of last baseline.
     */
    tow: number
    /**
     * Current baseline in ECEF x or NED north component..
     */
    baseline_a_mm: number
    /**
     * Current baseline in ECEF y or NED east component..
     */
    baseline_b_mm: number
    /**
     * Current baseline in ECEF z or NED down component..
     */
    baseline_c_mm: number
    /**
     * Current estimate of baseline accuracy..
     */
    accuracy: number
    /**
     * Current number of integer ambiguity hypotheses..
     */
    iar_num_hypotheses: number
    /**
     * GPS Week Number of last baseline.
     */
    wn: number
    /**
     * Identification of connected RTK receiver..
     */
    rtk_receiver_id: number
    /**
     * GPS-specific health report for RTK data..
     */
    rtk_health: number
    /**
     * Rate of baseline messages being received by GPS.
     */
    rtk_rate: number
    /**
     * Current number of sats used for RTK calculation..
     */
    nsats: number
    /**
     * Coordinate system of baseline.
     */
    baseline_coords_type: RtkBaselineCoordinateSystem
  }

  /**
   * MAVLink message ID: 129
   * The RAW IMU readings for 3rd 9DOF sensor setup. This message should contain the scaled values to the described units.
   */
  export interface ScaledImu3 extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * X acceleration.
     */
    xacc: number
    /**
     * Y acceleration.
     */
    yacc: number
    /**
     * Z acceleration.
     */
    zacc: number
    /**
     * Angular speed around X axis.
     */
    xgyro: number
    /**
     * Angular speed around Y axis.
     */
    ygyro: number
    /**
     * Angular speed around Z axis.
     */
    zgyro: number
    /**
     * X Magnetic field.
     */
    xmag: number
    /**
     * Y Magnetic field.
     */
    ymag: number
    /**
     * Z Magnetic field.
     */
    zmag: number
    /**
     * Temperature, 0: IMU does not provide temperature values. If the IMU is at 0C it must send 1 (0.01C)..
     */
    temperature: number
  }

  /**
   * MAVLink message ID: 130
   * Handshake message to initiate, control and stop image streaming when using the Image Transmission Protocol: https://mavlink.io/en/services/image_transmission.html..
   */
  export interface DataTransmissionHandshake extends Message {
    /**
     * total data size (set on ACK only)..
     */
    size: number
    /**
     * Width of a matrix or image..
     */
    width: number
    /**
     * Height of a matrix or image..
     */
    height: number
    /**
     * Number of packets being sent (set on ACK only)..
     */
    packets: number
    /**
     * Type of requested/acknowledged data..
     */
    mavtype: MavlinkDataStreamType
    /**
     * Payload size per packet (normally 253 byte, see DATA field size in message ENCAPSULATED_DATA) (set on ACK only)..
     */
    payload: number
    /**
     * JPEG quality. Values: [1-100]..
     */
    jpg_quality: number
  }

  /**
   * MAVLink message ID: 131
   * Data packet for images sent using the Image Transmission Protocol: https://mavlink.io/en/services/image_transmission.html..
   */
  export interface EncapsulatedData extends Message {
    /**
     * sequence number (starting with 0 on every transmission).
     */
    seqnr: number
    /**
     * image data bytes.
     */
    data: number[] // Array of 253 elements
  }

  /**
   * MAVLink message ID: 132
   * Distance sensor information for an onboard rangefinder..
   */
  export interface DistanceSensor extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Minimum distance the sensor can measure.
     */
    min_distance: number
    /**
     * Maximum distance the sensor can measure.
     */
    max_distance: number
    /**
     * Current distance reading.
     */
    current_distance: number
    /**
     * Type of distance sensor..
     */
    mavtype: MavDistanceSensor
    /**
     * Onboard ID of the sensor.
     */
    id: number
    /**
     * Direction the sensor faces. downward-facing: ROTATION_PITCH_270, upward-facing: ROTATION_PITCH_90, backward-facing: ROTATION_PITCH_180, forward-facing: ROTATION_NONE, left-facing: ROTATION_YAW_90, right-facing: ROTATION_YAW_270.
     */
    orientation: MavSensorOrientation
    /**
     * Measurement variance. Max standard deviation is 6cm. 255 if unknown..
     */
    covariance: number
    /**
     * Horizontal Field of View (angle) where the distance measurement is valid and the field of view is known. Otherwise this is set to 0..
     */
    horizontal_fov: number
    /**
     * Vertical Field of View (angle) where the distance measurement is valid and the field of view is known. Otherwise this is set to 0..
     */
    vertical_fov: number
    /**
     * Quaternion of the sensor orientation in vehicle body frame (w, x, y, z order, zero-rotation is 1, 0, 0, 0). Zero-rotation is along the vehicle body x-axis. This field is required if the orientation is set to MAV_SENSOR_ROTATION_CUSTOM. Set it to 0 if invalid.".
     */
    quaternion: number[] // Array of 4 elements
    /**
     * Signal quality of the sensor. Specific to each sensor type, representing the relation of the signal strength with the target reflectivity, distance, size or aspect, but normalised as a percentage. 0 = unknown/unset signal quality, 1 = invalid signal, 100 = perfect signal..
     */
    signal_quality: number
  }

  /**
   * MAVLink message ID: 133
   * Request for terrain data and terrain status.
   */
  export interface TerrainRequest extends Message {
    /**
     * Bitmask of requested 4x4 grids (row major 8x7 array of grids, 56 bits).
     */
    mask: number
    /**
     * Latitude of SW corner of first grid.
     */
    lat: number
    /**
     * Longitude of SW corner of first grid.
     */
    lon: number
    /**
     * Grid spacing.
     */
    grid_spacing: number
  }

  /**
   * MAVLink message ID: 134
   * Terrain data sent from GCS. The lat/lon and grid_spacing must be the same as a lat/lon from a TERRAIN_REQUEST.
   */
  export interface TerrainData extends Message {
    /**
     * Latitude of SW corner of first grid.
     */
    lat: number
    /**
     * Longitude of SW corner of first grid.
     */
    lon: number
    /**
     * Grid spacing.
     */
    grid_spacing: number
    /**
     * Terrain data MSL.
     */
    data: number[]
    /**
     * bit within the terrain request mask.
     */
    gridbit: number
  }

  /**
   * MAVLink message ID: 135
   * Request that the vehicle report terrain height at the given location. Used by GCS to check if vehicle has all terrain data needed for a mission..
   */
  export interface TerrainCheck extends Message {
    /**
     * Latitude.
     */
    lat: number
    /**
     * Longitude.
     */
    lon: number
  }

  /**
   * MAVLink message ID: 136
   * Response from a TERRAIN_CHECK request.
   */
  export interface TerrainReport extends Message {
    /**
     * Latitude.
     */
    lat: number
    /**
     * Longitude.
     */
    lon: number
    /**
     * Terrain height MSL.
     */
    terrain_height: number
    /**
     * Current vehicle height above lat/lon terrain height.
     */
    current_height: number
    /**
     * grid spacing (zero if terrain at this location unavailable).
     */
    spacing: number
    /**
     * Number of 4x4 terrain blocks waiting to be received or read from disk.
     */
    pending: number
    /**
     * Number of 4x4 terrain blocks in memory.
     */
    loaded: number
  }

  /**
   * MAVLink message ID: 137
   * Barometer readings for 2nd barometer.
   */
  export interface ScaledPressure2 extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Absolute pressure.
     */
    press_abs: number
    /**
     * Differential pressure.
     */
    press_diff: number
    /**
     * Temperature measurement.
     */
    temperature: number
  }

  /**
   * MAVLink message ID: 138
   * Motion capture attitude and position.
   */
  export interface AttPosMocap extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Attitude quaternion (w, x, y, z order, zero-rotation is 1, 0, 0, 0).
     */
    q: number[] // Array of 4 elements
    /**
     * X position (NED).
     */
    x: number
    /**
     * Y position (NED).
     */
    y: number
    /**
     * Z position (NED).
     */
    z: number
    /**
     * Row-major representation of a pose 6x6 cross-covariance matrix upper right triangle (states: x, y, z, roll, pitch, yaw; first six entries are the first ROW, next five entries are the second ROW, etc.). If unknown, assign NaN value to first element in the array..
     */
    covariance: number[] // Array of 21 elements
  }

  /**
   * MAVLink message ID: 139
   * Set the vehicle attitude and body angular rates..
   */
  export interface SetActuatorControlTarget extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Actuator controls. Normed to -1..+1 where 0 is neutral position. Throttle for single rotation direction motors is 0..1, negative range for reverse direction. Standard mapping for attitude controls (group 0): (index 0-7): roll, pitch, yaw, throttle, flaps, spoilers, airbrakes, landing gear. Load a pass-through mixer to repurpose them as generic outputs..
     */
    controls: number[] // Array of 8 elements
    /**
     * Actuator group. The "_mlx" indicates this is a multi-instance message and a MAVLink parser should
     */
    group_mlx: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 140
   * Set the vehicle attitude and body angular rates..
   */
  export interface ActuatorControlTarget extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Actuator controls. Normed to -1..+1 where 0 is neutral position. Throttle for single rotation direction motors is 0..1, negative range for reverse direction. Standard mapping for attitude controls (group 0): (index 0-7): roll, pitch, yaw, throttle, flaps, spoilers, airbrakes, landing gear. Load a pass-through mixer to repurpose them as generic outputs..
     */
    controls: number[] // Array of 8 elements
    /**
     * Actuator group. The "_mlx" indicates this is a multi-instance message and a MAVLink parser should
     */
    group_mlx: number
  }

  /**
   * MAVLink message ID: 141
   * The current system altitude..
   */
  export interface Altitude extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * This altitude measure is initialized on system boot and monotonic (it is never reset, but represents the local altitude change). The only guarantee on this field is that it will never be reset and is consistent within a flight. The recommended value for this field is the uncorrected barometric altitude at boot time. This altitude will also drift and vary between flights..
     */
    altitude_monotonic: number
    /**
     * This altitude measure is strictly above mean sea level and might be non-monotonic (it might reset on events like GPS lock or when a new QNH value is set). It should be the altitude to which global altitude waypoints are compared to. Note that it is *not* the GPS altitude, however, most GPS modules already output MSL by default and not the WGS84 altitude..
     */
    altitude_amsl: number
    /**
     * This is the local altitude in the local coordinate frame. It is not the altitude above home, but in reference to the coordinate origin (0, 0, 0). It is up-positive..
     */
    altitude_local: number
    /**
     * This is the altitude above the home position. It resets on each change of the current home position..
     */
    altitude_relative: number
    /**
     * This is the altitude above terrain. It might be fed by a terrain database or an altimeter. Values smaller than -1000 should be interpreted as unknown..
     */
    altitude_terrain: number
    /**
     * This is not the altitude, but the clear space below the system according to the fused clearance estimate. It generally should max out at the maximum range of e.g. the laser altimeter. It is generally a moving target. A negative value indicates no measurement available..
     */
    bottom_clearance: number
  }

  /**
   * MAVLink message ID: 142
   * The autopilot is requesting a resource (file, binary, other type of data).
   */
  export interface ResourceRequest extends Message {
    /**
     * Request ID. This ID should be re-used when sending back URI contents.
     */
    request_id: number
    /**
     * The type of requested URI. 0 = a file via URL. 1 = a UAVCAN binary.
     */
    uri_type: number
    /**
     * The requested unique resource identifier (URI). It is not necessarily a straight domain name (depends on the URI type enum).
     */
    uri: number[] // Array of 120 elements
    /**
     * The way the autopilot wants to receive the URI. 0 = MAVLink FTP. 1 = binary stream..
     */
    transfer_type: number
    /**
     * The storage path the autopilot wants the URI to be stored in. Will only be valid if the transfer_type has a storage associated (e.g. MAVLink FTP)..
     */
    storage: number[] // Array of 120 elements
  }

  /**
   * MAVLink message ID: 143
   * Barometer readings for 3rd barometer.
   */
  export interface ScaledPressure3 extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Absolute pressure.
     */
    press_abs: number
    /**
     * Differential pressure.
     */
    press_diff: number
    /**
     * Temperature measurement.
     */
    temperature: number
  }

  /**
   * MAVLink message ID: 144
   * Current motion information from a designated system.
   */
  export interface FollowTarget extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    timestamp: number
    /**
     * button states or switches of a tracker device.
     */
    custom_state: number
    /**
     * Latitude (WGS84).
     */
    lat: number
    /**
     * Longitude (WGS84).
     */
    lon: number
    /**
     * Altitude (MSL).
     */
    alt: number
    /**
     * target velocity (0,0,0) for unknown.
     */
    vel: number[] // Array of 3 elements
    /**
     * linear target acceleration (0,0,0) for unknown.
     */
    acc: number[] // Array of 3 elements
    /**
     * (1 0 0 0 for unknown).
     */
    attitude_q: number[] // Array of 4 elements
    /**
     * (0 0 0 for unknown).
     */
    rates: number[] // Array of 3 elements
    /**
     * eph epv.
     */
    position_cov: number[] // Array of 3 elements
    /**
     * bit positions for tracker reporting capabilities (POS = 0, VEL = 1, ACCEL = 2, ATT + RATES = 3).
     */
    est_capabilities: number
  }

  /**
   * MAVLink message ID: 146
   * The smoothed, monotonic system state used to feed the control loops of the system..
   */
  export interface ControlSystemState extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X acceleration in body frame.
     */
    x_acc: number
    /**
     * Y acceleration in body frame.
     */
    y_acc: number
    /**
     * Z acceleration in body frame.
     */
    z_acc: number
    /**
     * X velocity in body frame.
     */
    x_vel: number
    /**
     * Y velocity in body frame.
     */
    y_vel: number
    /**
     * Z velocity in body frame.
     */
    z_vel: number
    /**
     * X position in local frame.
     */
    x_pos: number
    /**
     * Y position in local frame.
     */
    y_pos: number
    /**
     * Z position in local frame.
     */
    z_pos: number
    /**
     * Airspeed, set to -1 if unknown.
     */
    airspeed: number
    /**
     * Variance of body velocity estimate.
     */
    vel_variance: number[] // Array of 3 elements
    /**
     * Variance in local position.
     */
    pos_variance: number[] // Array of 3 elements
    /**
     * The attitude, represented as Quaternion.
     */
    q: number[] // Array of 4 elements
    /**
     * Angular rate in roll axis.
     */
    roll_rate: number
    /**
     * Angular rate in pitch axis.
     */
    pitch_rate: number
    /**
     * Angular rate in yaw axis.
     */
    yaw_rate: number
  }

  /**
   * MAVLink message ID: 147
   * Battery information. Updates GCS with flight controller battery status.
   */
  export interface BatteryStatus extends Message {
    /**
     * Consumed charge, -1: autopilot does not provide consumption estimate.
     */
    current_consumed: number
    /**
     * Consumed energy, -1: autopilot does not provide energy consumption estimate.
     */
    energy_consumed: number
    /**
     * Temperature of the battery. INT16_MAX for unknown temperature..
     */
    temperature: number
    /**
     * Battery voltage of cells. Cells above the valid cell count for this battery should have the UINT16_MAX value. If individual cell voltages are unknown or not measured for this battery, then the overall battery voltage should be filled in cell 0, with all others set to UINT16_MAX. If the voltage of the battery is greater than (UINT16_MAX - 1), then cell 0 should be set to (UINT16_MAX - 1), and cell 1 to the remaining voltage. This can be extended to multiple cells if the total voltage is greater than 2 * (UINT16_MAX - 1)..
     */
    voltages: number[] // Array of 10 elements
    /**
     * Battery current, -1: autopilot does not measure the current.
     */
    current_battery: number
    /**
     * Battery ID.
     */
    id: number
    /**
     * Function of the battery.
     */
    battery_function: MavBatteryFunction
    /**
     * Type (chemistry) of the battery.
     */
    mavtype: MavBatteryType
    /**
     * Remaining battery energy. Values: [0-100], -1: autopilot does not estimate the remaining battery..
     */
    battery_remaining: number
    /**
     * Remaining battery time, 0: autopilot does not provide remaining battery time estimate.
     */
    time_remaining: number
    /**
     * State for extent of discharge, provided by autopilot for warning or external reactions.
     */
    charge_state: MavBatteryChargeState
  }

  /**
   * MAVLink message ID: 148
   * Version and capability of autopilot software. This should be emitted in response to a request with MAV_CMD_REQUEST_MESSAGE..
   */
  export interface AutopilotVersion extends Message {
    /**
     * Bitmap of capabilities.
     */
    capabilities: BitFlag // TODO: MavProtocolCapability https://mavlink.io/en/messages/common.html#MAV_PROTOCOL_CAPABILITY
    /**
     * UID if provided by hardware (see uid2).
     */
    uid: number
    /**
     * Firmware version number.
     */
    flight_sw_version: number
    /**
     * Middleware version number.
     */
    middleware_sw_version: number
    /**
     * Operating system version number.
     */
    os_sw_version: number
    /**
     * HW / board version (last 8 bytes should be silicon ID, if any).
     */
    board_version: number
    /**
     * ID of the board vendor.
     */
    vendor_id: number
    /**
     * ID of the product.
     */
    product_id: number
    /**
     * Custom version field, commonly the first 8 bytes of the git hash. This is not an unique identifier, but should allow to identify the commit using the main version number even for very large code bases..
     */
    flight_custom_version: number[] // Array of 8 elements
    /**
     * Custom version field, commonly the first 8 bytes of the git hash. This is not an unique identifier, but should allow to identify the commit using the main version number even for very large code bases..
     */
    middleware_custom_version: number[] // Array of 8 elements
    /**
     * Custom version field, commonly the first 8 bytes of the git hash. This is not an unique identifier, but should allow to identify the commit using the main version number even for very large code bases..
     */
    os_custom_version: number[] // Array of 8 elements
    /**
     * UID if provided by hardware (supersedes the uid field. If this is non-zero
     */
    uid2: number[] // Array of 18 elements
  }

  /**
   * MAVLink message ID: 149
   * The location of a landing target. See: https://mavlink.io/en/services/landing_target.html.
   */
  export interface LandingTarget extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X-axis angular offset of the target from the center of the image.
     */
    angle_x: number
    /**
     * Y-axis angular offset of the target from the center of the image.
     */
    angle_y: number
    /**
     * Distance to the target from the vehicle.
     */
    distance: number
    /**
     * Size of target along x-axis.
     */
    size_x: number
    /**
     * Size of target along y-axis.
     */
    size_y: number
    /**
     * The ID of the target if multiple targets are present.
     */
    target_num: number
    /**
     * Coordinate frame used for following fields..
     */
    frame: MavFrame
    /**
     * X Position of the landing target in MAV_FRAME.
     */
    x: number
    /**
     * Y Position of the landing target in MAV_FRAME.
     */
    y: number
    /**
     * Z Position of the landing target in MAV_FRAME.
     */
    z: number
    /**
     * Quaternion of landing target orientation (w, x, y, z order, zero-rotation is 1, 0, 0, 0).
     */
    q: number[] // Array of 4 elements
    /**
     * Type of landing target.
     */
    mavtype: LandingTargetType
    /**
     * Boolean indicating whether the position fields (x, y, z, q, type) contain valid target position information (valid: 1, invalid: 0). Default is 0 (invalid)..
     */
    position_valid: number
  }

  /**
   * MAVLink message ID: 162
   * Status of geo-fencing. Sent in extended status stream when fencing enabled..
   */
  export interface FenceStatus extends Message {
    /**
     * Time (since boot) of last breach..
     */
    breach_time: number
    /**
     * Number of fence breaches..
     */
    breach_count: number
    /**
     * Breach status (0 if currently inside fence, 1 if outside)..
     */
    breach_status: number
    /**
     * Last breach type..
     */
    breach_type: FenceBreach
    /**
     * Active action to prevent fence breach.
     */
    breach_mitigation: FenceMitigate
  }

  /**
   * MAVLink message ID: 230
   * Estimator status message including flags, innovation test ratios and estimated accuracies. The flags message is an integer bitmask containing information on which EKF outputs are valid. See the ESTIMATOR_STATUS_FLAGS enum definition for further information. The innovation test ratios show the magnitude of the sensor innovation divided by the innovation check threshold. Under normal operation the innovation test ratios should be below 0.5 with occasional values up to 1.0. Values greater than 1.0 should be rare under normal operation and indicate that a measurement has been rejected by the filter. The user should be notified if an innovation test ratio greater than 1.0 is recorded. Notifications for values in the range between 0.5 and 1.0 should be optional and controllable by the user..
   */
  export interface EstimatorStatus extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Velocity innovation test ratio.
     */
    vel_ratio: number
    /**
     * Horizontal position innovation test ratio.
     */
    pos_horiz_ratio: number
    /**
     * Vertical position innovation test ratio.
     */
    pos_vert_ratio: number
    /**
     * Magnetometer innovation test ratio.
     */
    mag_ratio: number
    /**
     * Height above terrain innovation test ratio.
     */
    hagl_ratio: number
    /**
     * True airspeed innovation test ratio.
     */
    tas_ratio: number
    /**
     * Horizontal position 1-STD accuracy relative to the EKF local origin.
     */
    pos_horiz_accuracy: number
    /**
     * Vertical position 1-STD accuracy relative to the EKF local origin.
     */
    pos_vert_accuracy: number
    /**
     * Bitmap indicating which EKF outputs are valid..
     */
    flags: number[] // TODO: EstimatorStatusFlags https://mavlink.io/en/messages/common.html#ESTIMATOR_STATUS_FLAGS
  }

  /**
   * MAVLink message ID: 231
   * Wind covariance estimate from vehicle..
   */
  export interface WindCov extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Wind in X (NED) direction.
     */
    wind_x: number
    /**
     * Wind in Y (NED) direction.
     */
    wind_y: number
    /**
     * Wind in Z (NED) direction.
     */
    wind_z: number
    /**
     * Variability of the wind in XY. RMS of a 1 Hz lowpassed wind estimate..
     */
    var_horiz: number
    /**
     * Variability of the wind in Z. RMS of a 1 Hz lowpassed wind estimate..
     */
    var_vert: number
    /**
     * Altitude (MSL) that this measurement was taken at.
     */
    wind_alt: number
    /**
     * Horizontal speed 1-STD accuracy.
     */
    horiz_accuracy: number
    /**
     * Vertical speed 1-STD accuracy.
     */
    vert_accuracy: number
  }

  /**
   * MAVLink message ID: 232
   * GPS sensor input message.This is a raw sensor value sent by the GPS. This is NOT the global position estimate of the system..
   */
  export interface GpsInput extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * GPS time (from start of GPS week).
     */
    time_week_ms: number
    /**
     * Latitude (WGS84).
     */
    lat: number
    /**
     * Longitude (WGS84).
     */
    lon: number
    /**
     * Altitude (MSL). Positive for up..
     */
    alt: number
    /**
     * GPS HDOP horizontal dilution of position.
     */
    hdop: number
    /**
     * GPS VDOP vertical dilution of position.
     */
    vdop: number
    /**
     * GPS velocity in north direction in earth-fixed NED frame.
     */
    vn: number
    /**
     * GPS velocity in east direction in earth-fixed NED frame.
     */
    ve: number
    /**
     * GPS velocity in down direction in earth-fixed NED frame.
     */
    vd: number
    /**
     * GPS speed accuracy.
     */
    speed_accuracy: number
    /**
     * GPS horizontal accuracy.
     */
    horiz_accuracy: number
    /**
     * GPS vertical accuracy.
     */
    vert_accuracy: number
    /**
     * Bitmap indicating which GPS input flags fields to ignore.All other fields must be provided..
     */
    ignore_flags: BitFlag // TODO: GpsInputIgnoreFlags https://mavlink.io/en/messages/common.html#GPS_INPUT_IGNORE_FLAGS
    /**
     * GPS week number.
     */
    time_week: number
    /**
     * ID of the GPS for multiple GPS inputs.
     */
    gps_id: number
    /**
     * 0-1: no fix, 2: 2D fix, 3: 3D fix. 4: 3D with DGPS. 5: 3D with RTK.
     */
    fix_type: number
    /**
     * Number of satellites visible..
     */
    satellites_visible: number
    /**
     * Yaw of vehicle relative to Earth's North, zero means not available
     */
    yaw: number
  }

  /**
   * MAVLink message ID: 233
   * RTCM message for injecting into the onboard GPS (used for DGPS).
   */
  export interface GpsRtcmData extends Message {
    /**
     * LSB: 1 means message is fragmented, next 2 bits are the fragment ID, the remaining 5 bits are used for the sequence ID. Messages are only to be flushed to the GPS when the entire message has been reconstructed on the autopilot. The fragment ID specifies which order the fragments should be assembled into a buffer, while the sequence ID is used to detect a mismatch between different buffers. The buffer is considered fully reconstructed when either all 4 fragments are present, or all the fragments before the first fragment with a non full payload is received. This management is used to ensure that normal GPS operation doesn't corrupt RTCM data, and to recover from a unreliable transport delivery order..
     */
    flags: number
    /**
     * data length.
     */
    len: number
    /**
     * RTCM message (may be fragmented).
     */
    data: number[] // Array of 180 elements
  }

  /**
   * MAVLink message ID: 234
   * Message appropriate for high latency connections like Iridium.
   */
  export interface HighLatency extends Message {
    /**
     * A bitfield for
     */
    custom_mode: number
    /**
     * Latitude.
     */
    latitude: number
    /**
     * Longitude.
     */
    longitude: number
    /**
     * roll.
     */
    roll: number
    /**
     * pitch.
     */
    pitch: number
    /**
     * heading.
     */
    heading: number
    /**
     * heading setpoint.
     */
    heading_sp: number
    /**
     * Altitude above mean sea level.
     */
    altitude_amsl: number
    /**
     * Altitude setpoint relative to the home position.
     */
    altitude_sp: number
    /**
     * distance to target.
     */
    wp_distance: number
    /**
     * Bitmap of enabled system modes..
     */
    base_mode: BitFlag // TODO: MavModeFlag https://mavlink.io/en/messages/common.html#MAV_MODE_FLAG
    /**
     * The landed state. Is set to MAV_LANDED_STATE_UNDEFINED if landed state is unknown..
     */
    landed_state: MavLandedState
    /**
     * throttle (percentage).
     */
    throttle: number
    /**
     * airspeed.
     */
    airspeed: number
    /**
     * airspeed setpoint.
     */
    airspeed_sp: number
    /**
     * groundspeed.
     */
    groundspeed: number
    /**
     * climb rate.
     */
    climb_rate: number
    /**
     * Number of satellites visible. If unknown, set to 255.
     */
    gps_nsat: number
    /**
     * GPS Fix type..
     */
    gps_fix_type: GpsFixType
    /**
     * Remaining battery (percentage).
     */
    battery_remaining: number
    /**
     * Autopilot temperature (degrees C).
     */
    temperature: number
    /**
     * Air temperature (degrees C) from airspeed sensor.
     */
    temperature_air: number
    /**
     * failsafe (each bit represents a failsafe where 0=ok, 1=failsafe active (bit0:RC, bit1:batt, bit2:GPS, bit3:GCS, bit4:fence).
     */
    failsafe: number
    /**
     * current waypoint number.
     */
    wp_num: number
  }

  /**
   * MAVLink message ID: 235
   * Message appropriate for high latency connections like Iridium (version 2).
   */
  export interface HighLatency2 extends Message {
    /**
     * Timestamp (milliseconds since boot or Unix epoch).
     */
    timestamp: number
    /**
     * Latitude.
     */
    latitude: number
    /**
     * Longitude.
     */
    longitude: number
    /**
     * A bitfield for
     */
    custom_mode: number
    /**
     * Altitude above mean sea level.
     */
    altitude: number
    /**
     * Altitude setpoint.
     */
    target_altitude: number
    /**
     * Distance to target waypoint or position.
     */
    target_distance: number
    /**
     * Current waypoint number.
     */
    wp_num: number
    /**
     * Bitmap of failure flags..
     */
    failure_flags: BitFlag // TODO: HlFailureFlag https://mavlink.io/en/messages/common.html#HL_FAILURE_FLAG
    /**
     * Type of the MAV (quadrotor, helicopter, etc.).
     */
    mavtype: Type<MavType>
    /**
     * Autopilot type / class.
     */
    autopilot: Type<MavAutopilot>
    /**
     * Heading.
     */
    heading: number
    /**
     * Heading setpoint.
     */
    target_heading: number
    /**
     * Throttle.
     */
    throttle: number
    /**
     * Airspeed.
     */
    airspeed: number
    /**
     * Airspeed setpoint.
     */
    airspeed_sp: number
    /**
     * Groundspeed.
     */
    groundspeed: number
    /**
     * Windspeed.
     */
    windspeed: number
    /**
     * Wind heading.
     */
    wind_heading: number
    /**
     * Maximum error horizontal position since last message.
     */
    eph: number
    /**
     * Maximum error vertical position since last message.
     */
    epv: number
    /**
     * Air temperature from airspeed sensor.
     */
    temperature_air: number
    /**
     * Maximum climb rate magnitude since last message.
     */
    climb_rate: number
    /**
     * Battery level (-1 if field not provided)..
     */
    battery: number
    /**
     * Field for custom payload..
     */
    custom0: number
    /**
     * Field for custom payload..
     */
    custom1: number
    /**
     * Field for custom payload..
     */
    custom2: number
  }

  /**
   * MAVLink message ID: 241
   * Vibration levels and accelerometer clipping.
   */
  export interface Vibration extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Vibration levels on X-axis.
     */
    vibration_x: number
    /**
     * Vibration levels on Y-axis.
     */
    vibration_y: number
    /**
     * Vibration levels on Z-axis.
     */
    vibration_z: number
    /**
     * first accelerometer clipping count.
     */
    clipping_0: number
    /**
     * second accelerometer clipping count.
     */
    clipping_1: number
    /**
     * third accelerometer clipping count.
     */
    clipping_2: number
  }

  /**
   * MAVLink message ID: 242
   * This message can be requested by sending the MAV_CMD_GET_HOME_POSITION command. The position the system will return to and land on. The position is set automatically by the system during the takeoff in case it was not explicitly set by the operator before or after. The global and local positions encode the position in the respective coordinate frames, while the q parameter encodes the orientation of the surface. Under normal conditions it describes the heading and terrain slope, which can be used by the aircraft to adjust the approach. The approach 3D vector describes the point to which the system should fly in normal flight mode and then perform a landing sequence along the vector..
   */
  export interface HomePosition extends Message {
    /**
     * Latitude (WGS84).
     */
    latitude: number
    /**
     * Longitude (WGS84).
     */
    longitude: number
    /**
     * Altitude (MSL). Positive for up..
     */
    altitude: number
    /**
     * Local X position of this position in the local coordinate frame.
     */
    x: number
    /**
     * Local Y position of this position in the local coordinate frame.
     */
    y: number
    /**
     * Local Z position of this position in the local coordinate frame.
     */
    z: number
    /**
     * World to surface normal and heading transformation of the takeoff position. Used to indicate the heading and slope of the ground.
     */
    q: number[] // Array of 4 elements
    /**
     * Local X position of the end of the approach vector. Multicopters should set this position based on their takeoff path. Grass-landing fixed wing aircraft should set it the same way as multicopters. Runway-landing fixed wing aircraft should set it to the opposite direction of the takeoff, assuming the takeoff happened from the threshold / touchdown zone..
     */
    approach_x: number
    /**
     * Local Y position of the end of the approach vector. Multicopters should set this position based on their takeoff path. Grass-landing fixed wing aircraft should set it the same way as multicopters. Runway-landing fixed wing aircraft should set it to the opposite direction of the takeoff, assuming the takeoff happened from the threshold / touchdown zone..
     */
    approach_y: number
    /**
     * Local Z position of the end of the approach vector. Multicopters should set this position based on their takeoff path. Grass-landing fixed wing aircraft should set it the same way as multicopters. Runway-landing fixed wing aircraft should set it to the opposite direction of the takeoff, assuming the takeoff happened from the threshold / touchdown zone..
     */
    approach_z: number
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
  }

  /**
   * MAVLink message ID: 243
   * The position the system will return to and land on. The position is set automatically by the system during the takeoff in case it was not explicitly set by the operator before or after. The global and local positions encode the position in the respective coordinate frames, while the q parameter encodes the orientation of the surface. Under normal conditions it describes the heading and terrain slope, which can be used by the aircraft to adjust the approach. The approach 3D vector describes the point to which the system should fly in normal flight mode and then perform a landing sequence along the vector..
   */
  export interface SetHomePosition extends Message {
    /**
     * Latitude (WGS84).
     */
    latitude: number
    /**
     * Longitude (WGS84).
     */
    longitude: number
    /**
     * Altitude (MSL). Positive for up..
     */
    altitude: number
    /**
     * Local X position of this position in the local coordinate frame.
     */
    x: number
    /**
     * Local Y position of this position in the local coordinate frame.
     */
    y: number
    /**
     * Local Z position of this position in the local coordinate frame.
     */
    z: number
    /**
     * World to surface normal and heading transformation of the takeoff position. Used to indicate the heading and slope of the ground.
     */
    q: number[] // Array of 4 elements
    /**
     * Local X position of the end of the approach vector. Multicopters should set this position based on their takeoff path. Grass-landing fixed wing aircraft should set it the same way as multicopters. Runway-landing fixed wing aircraft should set it to the opposite direction of the takeoff, assuming the takeoff happened from the threshold / touchdown zone..
     */
    approach_x: number
    /**
     * Local Y position of the end of the approach vector. Multicopters should set this position based on their takeoff path. Grass-landing fixed wing aircraft should set it the same way as multicopters. Runway-landing fixed wing aircraft should set it to the opposite direction of the takeoff, assuming the takeoff happened from the threshold / touchdown zone..
     */
    approach_y: number
    /**
     * Local Z position of the end of the approach vector. Multicopters should set this position based on their takeoff path. Grass-landing fixed wing aircraft should set it the same way as multicopters. Runway-landing fixed wing aircraft should set it to the opposite direction of the takeoff, assuming the takeoff happened from the threshold / touchdown zone..
     */
    approach_z: number
    /**
     * System ID..
     */
    target_system: number
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
  }

  /**
   * MAVLink message ID: 244
   * The interval between messages for a particular MAVLink message ID. This message is the response to the MAV_CMD_GET_MESSAGE_INTERVAL command. This interface replaces DATA_STREAM..
   */
  export interface MessageInterval extends Message {
    /**
     * The interval between two messages. A value of -1 indicates this stream is disabled, 0 indicates it is not available, > 0 indicates the interval at which it is sent..
     */
    interval_us: number
    /**
     * The ID of the requested MAVLink message. v1.0 is limited to 254 messages..
     */
    message_id: number
  }

  /**
   * MAVLink message ID: 245
   * Provides state for additional features.
   */
  export interface ExtendedSysState extends Message {
    /**
     * The VTOL state if applicable. Is set to MAV_VTOL_STATE_UNDEFINED if UAV is not in VTOL configuration..
     */
    vtol_state: MavVtolState
    /**
     * The landed state. Is set to MAV_LANDED_STATE_UNDEFINED if landed state is unknown..
     */
    landed_state: MavLandedState
  }

  /**
   * MAVLink message ID: 246
   * The location and information of an ADSB vehicle.
   */
  export interface AdsbVehicle extends Message {
    /**
     * ICAO address.
     */
    ICAO_address: number
    /**
     * Latitude.
     */
    lat: number
    /**
     * Longitude.
     */
    lon: number
    /**
     * Altitude(ASL).
     */
    altitude: number
    /**
     * Course over ground.
     */
    heading: number
    /**
     * The horizontal velocity.
     */
    hor_velocity: number
    /**
     * The vertical velocity. Positive is up.
     */
    ver_velocity: number
    /**
     * Bitmap to indicate various statuses including valid data fields.
     */
    flags: BitFlag // TODO: AdsbFlags https://mavlink.io/en/messages/common.html#ADSB_FLAGS
    /**
     * Squawk code.
     */
    squawk: number
    /**
     * ADSB altitude type..
     */
    altitude_type: AdsbAltitudeType
    /**
     * The callsign, 8+null.
     */
    callsign: number[] // String as array of 9 chars
    /**
     * ADSB emitter type..
     */
    emitter_type: AdsbEmitterType
    /**
     * Time since last communication in seconds.
     */
    tslc: number
  }

  /**
   * MAVLink message ID: 247
   * Information about a potential collision.
   */
  export interface Collision extends Message {
    /**
     * Unique identifier, domain based on src field.
     */
    id: number
    /**
     * Estimated time until collision occurs.
     */
    time_to_minimum_delta: number
    /**
     * Closest vertical distance between vehicle and object.
     */
    altitude_minimum_delta: number
    /**
     * Closest horizontal distance between vehicle and object.
     */
    horizontal_minimum_delta: number
    /**
     * Collision data source.
     */
    src: MavCollisionSrc
    /**
     * Action that is being taken to avoid this collision.
     */
    action: MavCollisionAction
    /**
     * How concerned the aircraft is about this collision.
     */
    threat_level: MavCollisionThreatLevel
  }

  /**
   * MAVLink message ID: 248
   * Message implementing parts of the V2 payload specs in V1 frames for transitional support..
   */
  export interface V2Extension extends Message {
    /**
     * A code that identifies the software component that understands this message (analogous to USB device classes or mime type strings). If this code is less than 32768, it is considered a 'registered' protocol extension and the corresponding entry should be added to https://github.com/mavlink/mavlink/definition_files/extension_message_ids.xml. Software creators can register blocks of message IDs as needed (useful for GCS specific metadata, etc...). Message_types greater than 32767 are considered local experiments and should not be checked in to any widely distributed codebase..
     */
    message_type: number
    /**
     * Network ID (0 for broadcast).
     */
    target_network: number
    /**
     * System ID (0 for broadcast).
     */
    target_system: number
    /**
     * Component ID (0 for broadcast).
     */
    target_component: number
    /**
     * Variable length payload. The length must be encoded in the payload as part of the message_type protocol, e.g. by including the length as payload data, or by terminating the payload data with a non-zero marker. This is required in order to reconstruct zero-terminated payloads that are (or otherwise would be) trimmed by MAVLink 2 empty-byte truncation. The entire content of the payload block is opaque unless you understand the encoding message_type. The particular encoding used can be extension specific and might not always be documented as part of the MAVLink specification..
     */
    payload: number[] // Array of 249 elements
  }

  /**
   * MAVLink message ID: 249
   * Send raw controller memory. The
   */
  export interface MemoryVect extends Message {
    /**
     * Starting address of the debug variables.
     */
    address: number
    /**
     * Version code of the type variable. 0=unknown, type ignored and assumed int16_t. 1=as below.
     */
    ver: number
    /**
     * Type code of the memory variables. for ver = 1: 0=16 x int16_t, 1=16 x uint16_t, 2=16 x Q15, 3=16 x 1Q14.
     */
    mavtype: number
    /**
     * Memory contents at specified address.
     */
    value: number[]
  }

  /**
   * MAVLink message ID: 250
   * To debug something using a named 3D vector..
   */
  export interface DebugVect extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * x.
     */
    x: number
    /**
     * y.
     */
    y: number
    /**
     * z.
     */
    z: number
    /**
     * Name.
     */
    name: number[] // String as array of 10 chars
  }

  /**
   * MAVLink message ID: 251
   * Send a key-value pair as float. The
   */
  export interface NamedValueFloat extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Floating point value.
     */
    value: number
    /**
     * Name of the debug variable.
     */
    name: number[] // String as array of 10 chars
  }

  /**
   * MAVLink message ID: 252
   * Send a key-value pair as integer. The
   */
  export interface NamedValueInt extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Signed integer value.
     */
    value: number
    /**
     * Name of the debug variable.
     */
    name: number[] // String as array of 10 chars
  }

  /**
   * MAVLink message ID: 253
   * Status text message. These messages are printed in yellow in the COMM console of QGroundControl. WARNING: They consume quite some bandwidth, so
   */
  export interface Statustext extends Message {
    /**
     * Severity of status. Relies on the definitions within RFC-5424..
     */
    severity: MavSeverity
    /**
     * Status text message, without null termination character.
     */
    text: number[] // String as array of 50 chars
    /**
     * Unique (opaque) identifier for this statustext message.May be used to reassemble a logical long-statustext message from a sequence of chunks.A value of zero indicates this is the only chunk in the sequence and the message can be emitted immediately..
     */
    id: number
    /**
     * This chunk's sequence number; indexing is from zero.Any null character in the text field is taken to mean this was the last chunk..
     */
    chunk_seq: number
  }

  /**
   * MAVLink message ID: 254
   * Send a debug value. The index is used to discriminate between values. These values show up in the plot of QGroundControl as DEBUG N..
   */
  export interface Debug extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * DEBUG value.
     */
    value: number
    /**
     * index of debug variable.
     */
    ind: number
  }

  /**
   * MAVLink message ID: 256
   * Setup a MAVLink2 signing key. If called with secret_key of all zero and zero initial_timestamp will disable signing.
   */
  export interface SetupSigning extends Message {
    /**
     * initial timestamp.
     */
    initial_timestamp: number
    /**
     * system id of the target.
     */
    target_system: number
    /**
     * component ID of the target.
     */
    target_component: number
    /**
     * signing key.
     */
    secret_key: number[] // Array of 32 elements
  }

  /**
   * MAVLink message ID: 257
   * Report button state change..
   */
  export interface ButtonChange extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Time of last change of button state..
     */
    last_change_ms: number
    /**
     * Bitmap for state of buttons..
     */
    state: number
  }

  /**
   * MAVLink message ID: 258
   * Control vehicle tone generation (buzzer)..
   */
  export interface PlayTune extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * tune in board specific format.
     */
    tune: number[] // String as array of 30 chars
    /**
     * tune extension (appended to tune).
     */
    tune2: number[] // String as array of 200 chars
  }

  /**
   * MAVLink message ID: 259
   * Information about a camera. Can be requested with a MAV_CMD_REQUEST_MESSAGE command..
   */
  export interface CameraInformation extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Version of the camera firmware, encoded as: (Dev & 0xff) << 24 | (Patch & 0xff) << 16 | (Minor & 0xff) << 8 | (Major & 0xff).
     */
    firmware_version: number
    /**
     * Focal length.
     */
    focal_length: number
    /**
     * Image sensor size horizontal.
     */
    sensor_size_h: number
    /**
     * Image sensor size vertical.
     */
    sensor_size_v: number
    /**
     * Bitmap of camera capability flags..
     */
    flags: BitFlag // TODO: CameraCapFlags https://mavlink.io/en/messages/common.html#CAMERA_CAP_FLAGS
    /**
     * Horizontal image resolution.
     */
    resolution_h: number
    /**
     * Vertical image resolution.
     */
    resolution_v: number
    /**
     * Camera definition version (iteration).
     */
    cam_definition_version: number
    /**
     * Name of the camera vendor.
     */
    vendor_name: number[] // Array of 32 elements
    /**
     * Name of the camera model.
     */
    model_name: number[] // Array of 32 elements
    /**
     * Reserved for a lens ID.
     */
    lens_id: number
    /**
     * Camera definition URI (if any, otherwise only basic functions will be available). HTTP- (http://) and MAVLink FTP- (mavlinkftp://) formatted URIs are allowed (and both must be supported by any GCS that implements the Camera Protocol)..
     */
    cam_definition_uri: number[] // String as array of 140 chars
  }

  /**
   * MAVLink message ID: 260
   * Settings of a camera. Can be requested with a MAV_CMD_REQUEST_MESSAGE command..
   */
  export interface CameraSettings extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Camera mode.
     */
    mode_id: CameraMode
    /**
     * Current zoom level (0.0 to 100.0, NaN if not known).
     */
    zoomLevel: number
    /**
     * Current focus level (0.0 to 100.0, NaN if not known).
     */
    focusLevel: number
  }

  /**
   * MAVLink message ID: 261
   * Information about a storage medium. This message is sent in response to a request with MAV_CMD_REQUEST_MESSAGE and whenever the status of the storage changes (STORAGE_STATUS).
   */
  export interface StorageInformation extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Total capacity. If storage is not ready (STORAGE_STATUS_READY) value will be ignored..
     */
    total_capacity: number
    /**
     * Used capacity. If storage is not ready (STORAGE_STATUS_READY) value will be ignored..
     */
    used_capacity: number
    /**
     * Available storage capacity. If storage is not ready (STORAGE_STATUS_READY) value will be ignored..
     */
    available_capacity: number
    /**
     * Read speed..
     */
    read_speed: number
    /**
     * Write speed..
     */
    write_speed: number
    /**
     * Storage ID (1 for first, 2 for second, etc.).
     */
    storage_id: number
    /**
     * Number of storage devices.
     */
    storage_count: number
    /**
     * Status of storage.
     */
    status: StorageStatus
  }

  /**
   * MAVLink message ID: 262
   * Information about the status of a capture. Can be requested with a MAV_CMD_REQUEST_MESSAGE command..
   */
  export interface CameraCaptureStatus extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Image capture interval.
     */
    image_interval: number
    /**
     * Time since recording started.
     */
    recording_time_ms: number
    /**
     * Available storage capacity..
     */
    available_capacity: number
    /**
     * Current status of image capturing (0: idle, 1: capture in progress, 2: interval set but idle, 3: interval set and capture in progress).
     */
    image_status: number
    /**
     * Current status of video capturing (0: idle, 1: capture in progress).
     */
    video_status: number
    /**
     * Total number of images captured ('forever', or until reset using MAV_CMD_STORAGE_FORMAT)..
     */
    image_count: number
  }

  /**
   * MAVLink message ID: 263
   * Information about a captured image. This is emitted every time a message is captured. It may be re-requested using MAV_CMD_REQUEST_MESSAGE, using param2 to indicate the sequence number for the missing image..
   */
  export interface CameraImageCaptured extends Message {
    /**
     * Timestamp (time since UNIX epoch) in UTC. 0 for unknown..
     */
    time_utc: number
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Latitude where image was taken.
     */
    lat: number
    /**
     * Longitude where capture was taken.
     */
    lon: number
    /**
     * Altitude (MSL) where image was taken.
     */
    alt: number
    /**
     * Altitude above ground.
     */
    relative_alt: number
    /**
     * Quaternion of camera orientation (w, x, y, z order, zero-rotation is 0, 0, 0, 0).
     */
    q: number[] // Array of 4 elements
    /**
     * Zero based index of this image (i.e. a new image will have index CAMERA_CAPTURE_STATUS.image count -1).
     */
    image_index: number
    /**
     * Camera ID (1 for first, 2 for second, etc.).
     */
    camera_id: number
    /**
     * Boolean indicating success (1) or failure (0) while capturing this image..
     */
    capture_result: number
    /**
     * URL of image taken. Either local storage or http://foo.jpg if camera provides an HTTP interface..
     */
    file_url: number[] // String as array of 205 chars
  }

  /**
   * MAVLink message ID: 264
   * Information about flight since last arming..
   */
  export interface FlightInformation extends Message {
    /**
     * Timestamp at arming (time since UNIX epoch) in UTC, 0 for unknown.
     */
    arming_time_utc: number
    /**
     * Timestamp at takeoff (time since UNIX epoch) in UTC, 0 for unknown.
     */
    takeoff_time_utc: number
    /**
     * Universally unique identifier (UUID) of flight, should correspond to name of log files.
     */
    flight_uuid: number
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
  }

  /**
   * MAVLink message ID: 265
   * Orientation of a mount.
   */
  export interface MountOrientation extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Roll in global frame (set to NaN for invalid)..
     */
    roll: number
    /**
     * Pitch in global frame (set to NaN for invalid)..
     */
    pitch: number
    /**
     * Yaw relative to vehicle (set to NaN for invalid)..
     */
    yaw: number
    /**
     * Yaw in absolute frame relative to Earth's North, north is 0 (set to NaN for invalid)..
     */
    yaw_absolute: number
  }

  /**
   * MAVLink message ID: 266
   * A message containing logged data (see also MAV_CMD_LOGGING_START).
   */
  export interface LoggingData extends Message {
    /**
     * sequence number (can wrap).
     */
    sequence: number
    /**
     * system ID of the target.
     */
    target_system: number
    /**
     * component ID of the target.
     */
    target_component: number
    /**
     * data length.
     */
    length: number
    /**
     * offset into data where first message starts. This can be used for recovery, when a previous message got lost (set to 255 if no start exists)..
     */
    first_message_offset: number
    /**
     * logged data.
     */
    data: number[] // Array of 249 elements
  }

  /**
   * MAVLink message ID: 267
   * A message containing logged data which requires a LOGGING_ACK to be sent back.
   */
  export interface LoggingDataAcked extends Message {
    /**
     * sequence number (can wrap).
     */
    sequence: number
    /**
     * system ID of the target.
     */
    target_system: number
    /**
     * component ID of the target.
     */
    target_component: number
    /**
     * data length.
     */
    length: number
    /**
     * offset into data where first message starts. This can be used for recovery, when a previous message got lost (set to 255 if no start exists)..
     */
    first_message_offset: number
    /**
     * logged data.
     */
    data: number[] // Array of 249 elements
  }

  /**
   * MAVLink message ID: 268
   * An ack for a LOGGING_DATA_ACKED message.
   */
  export interface LoggingAck extends Message {
    /**
     * sequence number (must match the one in LOGGING_DATA_ACKED).
     */
    sequence: number
    /**
     * system ID of the target.
     */
    target_system: number
    /**
     * component ID of the target.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 269
   * Information about video stream. It may be requested using MAV_CMD_REQUEST_MESSAGE, where param2 indicates the video stream id: 0 for all streams, 1 for first, 2 for second, etc..
   */
  export interface VideoStreamInformation extends Message {
    /**
     * Frame rate..
     */
    framerate: number
    /**
     * Bit rate..
     */
    bitrate: number
    /**
     * Bitmap of stream status flags..
     */
    flags: VideoStreamStatusFlags
    /**
     * Horizontal resolution..
     */
    resolution_h: number
    /**
     * Vertical resolution..
     */
    resolution_v: number
    /**
     * Video image rotation clockwise..
     */
    rotation: number
    /**
     * Horizontal Field of view..
     */
    hfov: number
    /**
     * Video Stream ID (1 for first, 2 for second, etc.).
     */
    stream_id: number
    /**
     * Number of streams available..
     */
    count: number
    /**
     * Type of stream..
     */
    mavtype: VideoStreamType
    /**
     * Stream name..
     */
    name: number[] // String as array of 32 chars
    /**
     * Video stream URI (TCP or RTSP URI ground station should connect to) or port number (UDP port ground station should listen to)..
     */
    uri: number[] // String as array of 160 chars
  }

  /**
   * MAVLink message ID: 270
   * Information about the status of a video stream. It may be requested using MAV_CMD_REQUEST_MESSAGE..
   */
  export interface VideoStreamStatus extends Message {
    /**
     * Frame rate.
     */
    framerate: number
    /**
     * Bit rate.
     */
    bitrate: number
    /**
     * Bitmap of stream status flags.
     */
    flags: VideoStreamStatusFlags
    /**
     * Horizontal resolution.
     */
    resolution_h: number
    /**
     * Vertical resolution.
     */
    resolution_v: number
    /**
     * Video image rotation clockwise.
     */
    rotation: number
    /**
     * Horizontal Field of view.
     */
    hfov: number
    /**
     * Video Stream ID (1 for first, 2 for second, etc.).
     */
    stream_id: number
  }

  /**
   * MAVLink message ID: 280
   * Information about a high level gimbal manager. This message should be requested by a ground station using MAV_CMD_REQUEST_MESSAGE..
   */
  export interface GimbalManagerInformation extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Bitmap of gimbal capability flags..
     */
    cap_flags: BitFlag // TODO: GimbalManagerCapFlags https://mavlink.io/en/messages/common.html#GIMBAL_MANAGER_CAP_FLAGS
    /**
     * Maximum tilt/pitch angle (positive: up, negative: down).
     */
    tilt_max: number
    /**
     * Minimum tilt/pitch angle (positive: up, negative: down).
     */
    tilt_min: number
    /**
     * Maximum tilt/pitch angular rate (positive: up, negative: down).
     */
    tilt_rate_max: number
    /**
     * Maximum pan/yaw angle (positive: to the right, negative: to the left).
     */
    pan_max: number
    /**
     * Minimum pan/yaw angle (positive: to the right, negative: to the left).
     */
    pan_min: number
    /**
     * Minimum pan/yaw angular rate (positive: to the right, negative: to the left).
     */
    pan_rate_max: number
    /**
     * Gimbal device ID that this gimbal manager is responsible for..
     */
    gimbal_device_id: number
  }

  /**
   * MAVLink message ID: 281
   * Current status about a high level gimbal manager. This message should be broadcast at a low regular rate (e.g. 5Hz)..
   */
  export interface GimbalManagerStatus extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * High level gimbal manager flags currently applied..
     */
    flags: GimbalManagerFlags
    /**
     * Gimbal device ID that this gimbal manager is responsible for..
     */
    gimbal_device_id: number
  }

  /**
   * MAVLink message ID: 282
   * High level message to control a gimbal's attitude. This message is to be sent to the gimbal manager (e.g. from a ground station). Angles and rates can be set to NaN according to
   */
  export interface GimbalManagerSetAttitude extends Message {
    /**
     * High level gimbal manager flags to use..
     */
    flags: GimbalManagerFlags
    /**
     * Quaternion components, w, x, y, z (1 0 0 0 is the null-rotation, the frame is depends on whether the flag GIMBAL_MANAGER_FLAGS_YAW_LOCK is set).
     */
    q: number[] // Array of 4 elements
    /**
     * X component of angular velocity, positive is banking to the right, NaN to be ignored..
     */
    angular_velocity_x: number
    /**
     * Y component of angular velocity, positive is tilting up, NaN to be ignored..
     */
    angular_velocity_y: number
    /**
     * Z component of angular velocity, positive is panning to the right, NaN to be ignored..
     */
    angular_velocity_z: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Component ID of gimbal device to address (or 1-6 for non-MAVLink gimbal), 0 for all gimbal device components. (Send command multiple times for more than one but not all gimbals.).
     */
    gimbal_device_id: number
  }

  /**
   * MAVLink message ID: 283
   * Information about a low level gimbal. This message should be requested by the gimbal manager or a ground station using MAV_CMD_REQUEST_MESSAGE..
   */
  export interface GimbalDeviceInformation extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Version of the gimbal firmware, encoded as: (Dev & 0xff) << 24 | (Patch & 0xff) << 16 | (Minor & 0xff) << 8 | (Major & 0xff).
     */
    firmware_version: number
    /**
     * Maximum tilt/pitch angle (positive: up, negative: down).
     */
    tilt_max: number
    /**
     * Minimum tilt/pitch angle (positive: up, negative: down).
     */
    tilt_min: number
    /**
     * Maximum tilt/pitch angular rate (positive: up, negative: down).
     */
    tilt_rate_max: number
    /**
     * Maximum pan/yaw angle (positive: to the right, negative: to the left).
     */
    pan_max: number
    /**
     * Minimum pan/yaw angle (positive: to the right, negative: to the left).
     */
    pan_min: number
    /**
     * Minimum pan/yaw angular rate (positive: to the right, negative: to the left).
     */
    pan_rate_max: number
    /**
     * Bitmap of gimbal capability flags..
     */
    cap_flags: BitFlag // TODO: GimbalDeviceCapFlags https://mavlink.io/en/messages/common.html#GIMBAL_DEVICE_CAP_FLAGS
    /**
     * Name of the gimbal vendor.
     */
    vendor_name: number[] // Array of 32 elements
    /**
     * Name of the gimbal model.
     */
    model_name: number[] // Array of 32 elements
  }

  /**
   * MAVLink message ID: 284
   * Low level message to control a gimbal device's attitude. This message is to be sent from the gimbal manager to the gimbal device component. Angles and rates can be set to NaN according to
   */
  export interface GimbalDeviceSetAttitude extends Message {
    /**
     * Quaternion components, w, x, y, z (1 0 0 0 is the null-rotation, the frame is depends on whether the flag GIMBAL_DEVICE_FLAGS_YAW_LOCK is set, set all fields to NaN if only angular velocity should be used).
     */
    q: number[] // Array of 4 elements
    /**
     * X component of angular velocity, positive is banking to the right, NaN to be ignored..
     */
    angular_velocity_x: number
    /**
     * Y component of angular velocity, positive is tilting up, NaN to be ignored..
     */
    angular_velocity_y: number
    /**
     * Z component of angular velocity, positive is panning to the right, NaN to be ignored..
     */
    angular_velocity_z: number
    /**
     * Low level gimbal flags..
     */
    flags: GimbalDeviceFlags
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 285
   * Message reporting the status of a gimbal device. This message should be broadcasted by a gimbal device component. The angles encoded in the quaternion are in the global frame (roll: positive is tilt to the right, pitch: positive is tilting up, yaw is turn to the right). This message should be broadcast at a low regular rate (e.g. 10Hz)..
   */
  export interface GimbalDeviceAttitudeStatus extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * Quaternion components, w, x, y, z (1 0 0 0 is the null-rotation, the frame is depends on whether the flag GIMBAL_DEVICE_FLAGS_YAW_LOCK is set).
     */
    q: number[] // Array of 4 elements
    /**
     * X component of angular velocity (NaN if unknown).
     */
    angular_velocity_x: number
    /**
     * Y component of angular velocity (NaN if unknown).
     */
    angular_velocity_y: number
    /**
     * Z component of angular velocity (NaN if unknown).
     */
    angular_velocity_z: number
    /**
     * Failure flags (0 for no failure).
     */
    failure_flags: number // TODO: GimbalDeviceErrorFlags https://mavlink.io/en/messages/common.html#GIMBAL_DEVICE_ERROR_FLAGS
    /**
     * Current gimbal flags set..
     */
    flags: GimbalDeviceFlags
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 286
   * Low level message containing autopilot state relevant for a gimbal device. This message is to be sent from the gimbal manager to the gimbal device component. The data of this message server for the gimbal's estimator corrections in particular horizon compensation, as well as the autopilot's control intention e.g. feed forward angular control in z-axis..
   */
  export interface AutopilotStateForGimbalDevice extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_us: number
    /**
     * Quaternion components of autopilot attitude: w, x, y, z (1 0 0 0 is the null-rotation, Hamiltonian convention)..
     */
    q: number[] // Array of 4 elements
    /**
     * Estimated delay of the attitude data..
     */
    q_estimated_delay_us: number
    /**
     * X Speed in NED (North, East, Down)..
     */
    vx: number
    /**
     * Y Speed in NED (North, East, Down)..
     */
    vy: number
    /**
     * Z Speed in NED (North, East, Down)..
     */
    vz: number
    /**
     * Estimated delay of the speed data..
     */
    v_estimated_delay_us: number
    /**
     * Feed forward Z component of angular velocity, positive is yawing to the right, NaN to be ignored. This is to indicate if the autopilot is actively yawing..
     */
    feed_forward_angular_velocity_z: number
    /**
     * Bitmap indicating which estimator outputs are valid..
     */
    estimator_status: BitFlag // TODO: EstimatorStatusFlags https://mavlink.io/en/messages/common.html#ESTIMATOR_STATUS_FLAGS
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * The landed state. Is set to MAV_LANDED_STATE_UNDEFINED if landed state is unknown..
     */
    landed_state: MavLandedState
  }

  /**
   * MAVLink message ID: 287
   * High level message to control a gimbal's tilt and pan angles. This message is to be sent to the gimbal manager (e.g. from a ground station). Angles and rates can be set to NaN according to
   */
  export interface GimbalManagerSetTiltpan extends Message {
    /**
     * High level gimbal manager flags to use..
     */
    flags: GimbalManagerFlags
    /**
     * Tilt/pitch angle (positive: up, negative: down, NaN to be ignored)..
     */
    tilt: number
    /**
     * Pan/yaw angle (positive: to the right, negative: to the left, NaN to be ignored)..
     */
    pan: number
    /**
     * Tilt/pitch angular rate (positive: up, negative: down, NaN to be ignored)..
     */
    tilt_rate: number
    /**
     * Pan/yaw angular rate (positive: to the right, negative: to the left, NaN to be ignored)..
     */
    pan_rate: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Component ID of gimbal device to address (or 1-6 for non-MAVLink gimbal), 0 for all gimbal device components. (Send command multiple times for more than one but not all gimbals.).
     */
    gimbal_device_id: number
  }

  /**
   * MAVLink message ID: 299
   * Configure WiFi AP SSID, password, and mode. This message is re-emitted as an acknowledgement by the AP. The message may also be explicitly requested using MAV_CMD_REQUEST_MESSAGE.
   */
  export interface WifiConfigAp extends Message {
    /**
     * Name of Wi-Fi network (SSID). Blank to leave it unchanged when setting. Current SSID when sent back as a response..
     */
    ssid: number[] // String as array of 32 chars
    /**
     * Password. Blank for an open AP. MD5 hash when message is sent back as a response..
     */
    password: number[] // String as array of 64 chars
    /**
     * WiFi Mode..
     */
    mode: WifiConfigApMode
    /**
     * Message acceptance response (sent back to GS)..
     */
    response: WifiConfigApResponse
  }

  /**
   * MAVLink message ID: 300
   * Version and capability of protocol version. This message can be requested with MAV_CMD_REQUEST_MESSAGE and is used as part of the handshaking to establish which MAVLink version should be used on the network. Every node should respond to a request for PROTOCOL_VERSION to enable the handshaking. Library implementers should consider adding this into the default decoding state machine to allow the protocol core to respond directly..
   */
  export interface ProtocolVersion extends Message {
    /**
     * Currently active MAVLink version number * 100: v1.0 is 100, v2.0 is 200, etc..
     */
    version: number
    /**
     * Minimum MAVLink version supported.
     */
    min_version: number
    /**
     * Maximum MAVLink version supported (set to the same value as version by default).
     */
    max_version: number
    /**
     * The first 8 bytes (not characters printed in hex!) of the git hash..
     */
    spec_version_hash: number[] // Array of 8 elements
    /**
     * The first 8 bytes (not characters printed in hex!) of the git hash..
     */
    library_version_hash: number[] // Array of 8 elements
  }

  /**
   * MAVLink message ID: 301
   * The location and information of an AIS vessel.
   */
  export interface AisVessel extends Message {
    /**
     * Mobile Marine Service Identifier, 9 decimal digits.
     */
    MMSI: number
    /**
     * Latitude.
     */
    lat: number
    /**
     * Longitude.
     */
    lon: number
    /**
     * Course over ground.
     */
    COG: number
    /**
     * True heading.
     */
    heading: number
    /**
     * Speed over ground.
     */
    velocity: number
    /**
     * Distance from lat/lon location to bow.
     */
    dimension_bow: number
    /**
     * Distance from lat/lon location to stern.
     */
    dimension_stern: number
    /**
     * Time since last communication in seconds.
     */
    tslc: number
    /**
     * Bitmask to indicate various statuses including valid data fields.
     */
    flags: BitFlag // TODO: AisFlags: https://mavlink.io/en/messages/common.html#AIS_FLAGS
    /**
     * Turn rate.
     */
    turn_rate: number
    /**
     * Navigational status.
     */
    navigational_status: AisNavStatus
    /**
     * Type of vessels.
     */
    mavtype: AisType
    /**
     * Distance from lat/lon location to port side.
     */
    dimension_port: number
    /**
     * Distance from lat/lon location to starboard side.
     */
    dimension_starboard: number
    /**
     * The vessel callsign.
     */
    callsign: number[] // String as array of 7 chars
    /**
     * The vessel name.
     */
    name: number[] // String as array of 20 chars
  }

  /**
   * MAVLink message ID: 310
   * General status information of an UAVCAN node. Please refer to the definition of the UAVCAN message "uavcan.protocol.NodeStatus" for the background information. The UAVCAN specification is available at http://uavcan.org..
   */
  export interface UavcanNodeStatus extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Time since the start-up of the node..
     */
    uptime_sec: number
    /**
     * Vendor-specific status information..
     */
    vendor_specific_status_code: number
    /**
     * Generalized node health status..
     */
    health: UavcanNodeHealth
    /**
     * Generalized operating mode..
     */
    mode: UavcanNodeMode
    /**
     * Not used currently..
     */
    sub_mode: number
  }

  /**
   * MAVLink message ID: 311
   * General information describing a particular UAVCAN node. Please refer to the definition of the UAVCAN service "uavcan.protocol.GetNodeInfo" for the background information. This message should be emitted by the system whenever a new node appears online, or an existing node reboots. Additionally, it can be emitted upon request from the other end of the MAVLink channel (see MAV_CMD_UAVCAN_GET_NODE_INFO). It is also not prohibited to emit this message unconditionally at a low frequency. The UAVCAN specification is available at http://uavcan.org..
   */
  export interface UavcanNodeInfo extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Time since the start-up of the node..
     */
    uptime_sec: number
    /**
     * Version control system (VCS) revision identifier (e.g. git short commit hash). Zero if unknown..
     */
    sw_vcs_commit: number
    /**
     * Node name string. For example, "sapog.px4.io"..
     */
    name: number[] // String as array of 80 chars
    /**
     * Hardware major version number..
     */
    hw_version_major: number
    /**
     * Hardware minor version number..
     */
    hw_version_minor: number
    /**
     * Hardware unique 128-bit ID..
     */
    hw_unique_id: number[] // Array of 16 elements
    /**
     * Software major version number..
     */
    sw_version_major: number
    /**
     * Software minor version number..
     */
    sw_version_minor: number
  }

  /**
   * MAVLink message ID: 320
   * Request to read the value of a parameter with the either the param_id string id or param_index..
   */
  export interface ParamExtRequestRead extends Message {
    /**
     * Parameter index. Set to -1 to
     */
    param_index: number
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Parameter id, terminated by NULL if the length is less than 16 human-readable chars and WITHOUT null termination (NULL) byte if the length is exactly 16 chars - applications have to provide 16+1 bytes storage if the ID is stored as string.
     */
    param_id: number[] // String as array of 16 chars
  }

  /**
   * MAVLink message ID: 321
   * Request all parameters of this component. After this request, all parameters are emitted..
   */
  export interface ParamExtRequestList extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 322
   * Emit the value of a parameter. The inclusion of param_count and param_index in the message allows the recipient to keep track of received parameters and allows them to re-request missing parameters after a loss or timeout..
   */
  export interface ParamExtValue extends Message {
    /**
     * Total number of parameters.
     */
    param_count: number
    /**
     * Index of this parameter.
     */
    param_index: number
    /**
     * Parameter id, terminated by NULL if the length is less than 16 human-readable chars and WITHOUT null termination (NULL) byte if the length is exactly 16 chars - applications have to provide 16+1 bytes storage if the ID is stored as string.
     */
    param_id: number[] // String as array of 16 chars
    /**
     * Parameter value.
     */
    param_value: number[] // String as array of 128 chars
    /**
     * Parameter type..
     */
    param_type: MavParamExtType
  }

  /**
   * MAVLink message ID: 323
   * Set a parameter value. In order to deal with message loss (and retransmission of PARAM_EXT_SET), when setting a parameter value and the new value is the same as the current value, you will immediately get a PARAM_ACK_ACCEPTED response. If the current state is PARAM_ACK_IN_PROGRESS, you will accordingly receive a PARAM_ACK_IN_PROGRESS in response..
   */
  export interface ParamExtSet extends Message {
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Parameter id, terminated by NULL if the length is less than 16 human-readable chars and WITHOUT null termination (NULL) byte if the length is exactly 16 chars - applications have to provide 16+1 bytes storage if the ID is stored as string.
     */
    param_id: number[] // String as array of 16 chars
    /**
     * Parameter value.
     */
    param_value: number[] // String as array of 128 chars
    /**
     * Parameter type..
     */
    param_type: MavParamExtType
  }

  /**
   * MAVLink message ID: 324
   * Response from a PARAM_EXT_SET message..
   */
  export interface ParamExtAck extends Message {
    /**
     * Parameter id, terminated by NULL if the length is less than 16 human-readable chars and WITHOUT null termination (NULL) byte if the length is exactly 16 chars - applications have to provide 16+1 bytes storage if the ID is stored as string.
     */
    param_id: number[] // String as array of 16 chars
    /**
     * Parameter value (new value if PARAM_ACK_ACCEPTED, current value otherwise).
     */
    param_value: number[] // String as array of 128 chars
    /**
     * Parameter type..
     */
    param_type: MavParamExtType
    /**
     * Result code..
     */
    param_result: ParamAck
  }

  /**
   * MAVLink message ID: 330
   * Obstacle distances in front of the sensor, starting from the left in increment degrees to the right.
   */
  export interface ObstacleDistance extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Distance of obstacles around the vehicle with index 0 corresponding to north + angle_offset, unless otherwise specified in the frame. A value of 0 is valid and means that the obstacle is practically touching the sensor. A value of max_distance +1 means no obstacle is present. A value of UINT16_MAX for unknown/not used. In a array element, one unit corresponds to 1cm..
     */
    distances: number[] // Array of 72 elements
    /**
     * Minimum distance the sensor can measure..
     */
    min_distance: number
    /**
     * Maximum distance the sensor can measure..
     */
    max_distance: number
    /**
     * Class id of the distance sensor type..
     */
    sensor_type: MavDistanceSensor
    /**
     * Angular width in degrees of each array element. Increment direction is clockwise. This field is ignored if increment_f is non-zero..
     */
    increment: number
    /**
     * Angular width in degrees of each array element as a float. If non-zero then this value is used instead of the uint8_t increment field. Positive is clockwise direction, negative is counter-clockwise..
     */
    increment_f: number
    /**
     * Relative angle offset of the 0-index element in the distances array. Value of 0 corresponds to forward. Positive is clockwise direction, negative is counter-clockwise..
     */
    angle_offset: number
    /**
     * Coordinate frame of reference for the yaw rotation and offset of the sensor data. Defaults to MAV_FRAME_GLOBAL, which is north aligned. For body-mounted sensors
     */
    frame: MavFrame
  }

  /**
   * MAVLink message ID: 331
   * Odometry message to communicate odometry information with an external interface. Fits ROS REP 147 standard for aerial vehicles (http://www.ros.org/reps/rep-0147.html)..
   */
  export interface Odometry extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X Position.
     */
    x: number
    /**
     * Y Position.
     */
    y: number
    /**
     * Z Position.
     */
    z: number
    /**
     * Quaternion components, w, x, y, z (1 0 0 0 is the null-rotation).
     */
    q: number[] // Array of 4 elements
    /**
     * X linear speed.
     */
    vx: number
    /**
     * Y linear speed.
     */
    vy: number
    /**
     * Z linear speed.
     */
    vz: number
    /**
     * Roll angular speed.
     */
    rollspeed: number
    /**
     * Pitch angular speed.
     */
    pitchspeed: number
    /**
     * Yaw angular speed.
     */
    yawspeed: number
    /**
     * Row-major representation of a 6x6 pose cross-covariance matrix upper right triangle (states: x, y, z, roll, pitch, yaw; first six entries are the first ROW, next five entries are the second ROW, etc.). If unknown, assign NaN value to first element in the array..
     */
    pose_covariance: number[] // Array of 21 elements
    /**
     * Row-major representation of a 6x6 velocity cross-covariance matrix upper right triangle (states: vx, vy, vz, rollspeed, pitchspeed, yawspeed; first six entries are the first ROW, next five entries are the second ROW, etc.). If unknown, assign NaN value to first element in the array..
     */
    velocity_covariance: number[] // Array of 21 elements
    /**
     * Coordinate frame of reference for the pose data..
     */
    frame_id: MavFrame
    /**
     * Coordinate frame of reference for the velocity in free space (twist) data..
     */
    child_frame_id: MavFrame
    /**
     * Estimate reset counter. This should be incremented when the estimate resets in any of the dimensions (position, velocity, attitude, angular speed). This is designed to be used when e.g an external SLAM system detects a loop-closure and the estimate jumps..
     */
    reset_counter: number
    /**
     * Type of estimator that is providing the odometry..
     */
    estimator_type: MavEstimatorType
  }

  /**
   * MAVLink message ID: 332
   * Describe a trajectory using an array of up-to 5 waypoints in the local frame (MAV_FRAME_LOCAL_NED)..
   */
  export interface TrajectoryRepresentationWaypoints extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X-coordinate of waypoint, set to NaN if not being used.
     */
    pos_x: number[] // Array of 5 elements
    /**
     * Y-coordinate of waypoint, set to NaN if not being used.
     */
    pos_y: number[] // Array of 5 elements
    /**
     * Z-coordinate of waypoint, set to NaN if not being used.
     */
    pos_z: number[] // Array of 5 elements
    /**
     * X-velocity of waypoint, set to NaN if not being used.
     */
    vel_x: number[] // Array of 5 elements
    /**
     * Y-velocity of waypoint, set to NaN if not being used.
     */
    vel_y: number[] // Array of 5 elements
    /**
     * Z-velocity of waypoint, set to NaN if not being used.
     */
    vel_z: number[] // Array of 5 elements
    /**
     * X-acceleration of waypoint, set to NaN if not being used.
     */
    acc_x: number[] // Array of 5 elements
    /**
     * Y-acceleration of waypoint, set to NaN if not being used.
     */
    acc_y: number[] // Array of 5 elements
    /**
     * Z-acceleration of waypoint, set to NaN if not being used.
     */
    acc_z: number[] // Array of 5 elements
    /**
     * Yaw angle, set to NaN if not being used.
     */
    pos_yaw: number[] // Array of 5 elements
    /**
     * Yaw rate, set to NaN if not being used.
     */
    vel_yaw: number[] // Array of 5 elements
    /**
     * Scheduled action for each waypoint, UINT16_MAX if not being used..
     */
    command: number[] // Array of 5 elements
    /**
     * Number of valid points (up-to 5 waypoints are possible).
     */
    valid_points: number
  }

  /**
   * MAVLink message ID: 333
   * Describe a trajectory using an array of up-to 5 bezier control points in the local frame (MAV_FRAME_LOCAL_NED)..
   */
  export interface TrajectoryRepresentationBezier extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * X-coordinate of bezier control points. Set to NaN if not being used.
     */
    pos_x: number[] // Array of 5 elements
    /**
     * Y-coordinate of bezier control points. Set to NaN if not being used.
     */
    pos_y: number[] // Array of 5 elements
    /**
     * Z-coordinate of bezier control points. Set to NaN if not being used.
     */
    pos_z: number[] // Array of 5 elements
    /**
     * Bezier time horizon. Set to NaN if velocity/acceleration should not be incorporated.
     */
    delta: number[] // Array of 5 elements
    /**
     * Yaw. Set to NaN for unchanged.
     */
    pos_yaw: number[] // Array of 5 elements
    /**
     * Number of valid control points (up-to 5 points are possible).
     */
    valid_points: number
  }

  /**
   * MAVLink message ID: 334
   * Report current used cellular network status.
   */
  export interface CellularStatus extends Message {
    /**
     * Mobile country code. If unknown, set to UINT16_MAX.
     */
    mcc: number
    /**
     * Mobile network code. If unknown, set to UINT16_MAX.
     */
    mnc: number
    /**
     * Location area code. If unknown, set to 0.
     */
    lac: number
    /**
     * Cellular modem status.
     */
    status: CellularStatusFlag
    /**
     * Failure reason when status in in CELLUAR_STATUS_FAILED.
     */
    failure_reason: CellularNetworkFailedReason
    /**
     * Cellular network radio type: gsm, cdma, lte....
     */
    mavtype: CellularNetworkRadioType
    /**
     * Signal quality in percent. If unknown, set to UINT8_MAX.
     */
    quality: number
  }

  /**
   * MAVLink message ID: 335
   * Status of the Iridium SBD link..
   */
  export interface IsbdLinkStatus extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    timestamp: number
    /**
     * Timestamp of the last successful sbd session. The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    last_heartbeat: number
    /**
     * Number of failed SBD sessions..
     */
    failed_sessions: number
    /**
     * Number of successful SBD sessions..
     */
    successful_sessions: number
    /**
     * Signal quality equal to the number of bars displayed on the ISU signal strength indicator. Range is 0 to 5, where 0 indicates no signal and 5 indicates maximum signal strength..
     */
    signal_quality: number
    /**
     * 1: Ring call pending, 0: No call pending..
     */
    ring_pending: number
    /**
     * 1: Transmission session pending, 0: No transmission session pending..
     */
    tx_session_pending: number
    /**
     * 1: Receiving session pending, 0: No receiving session pending..
     */
    rx_session_pending: number
  }

  /**
   * MAVLink message ID: 336
   * Configure cellular modems. This message is re-emitted as an acknowledgement by the modem. The message may also be explicitly requested using MAV_CMD_REQUEST_MESSAGE..
   */
  export interface CellularConfig extends Message {
    /**
     * Enable / disable PIN on the SIM card. 0: Unchange setttings 1: PIN disabled, 2: PIN enabled..
     */
    enable_pin: number
    /**
     * PIN sent to the simcard. Blank when PIN is disabled. Empty when message is sent back as a response..
     */
    pin: number[] // String as array of 32 chars
    /**
     * Name of the cellular APN. Blank to leave it unchanged when setting. Current APN when sent back as a response..
     */
    apn: number[] // String as array of 32 chars
    /**
     * Required PUK code in case the user failed to authenticate 3 times with the PIN..
     */
    puk: number[] // String as array of 32 chars
    /**
     * Configure whether roaming is allowed, 0: settings not changed, 1: roaming disabled, 2: roaming enabled..
     */
    roaming: number
    /**
     * Message acceptance response (sent back to GS)..
     */
    response: CellularConfigResponse
  }

  /**
   * MAVLink message ID: 339
   * RPM sensor data message..
   */
  export interface RawRpm extends Message {
    /**
     * Indicated rate.
     */
    frequency: number
    /**
     * Index of this RPM sensor (0-indexed).
     */
    index: number
  }

  /**
   * MAVLink message ID: 340
   * The global position resulting from GPS and sensor fusion..
   */
  export interface UtmGlobalPosition extends Message {
    /**
     * Time of applicability of position (microseconds since UNIX epoch)..
     */
    time: number
    /**
     * Latitude (WGS84).
     */
    lat: number
    /**
     * Longitude (WGS84).
     */
    lon: number
    /**
     * Altitude (WGS84).
     */
    alt: number
    /**
     * Altitude above ground.
     */
    relative_alt: number
    /**
     * Next waypoint, latitude (WGS84).
     */
    next_lat: number
    /**
     * Next waypoint, longitude (WGS84).
     */
    next_lon: number
    /**
     * Next waypoint, altitude (WGS84).
     */
    next_alt: number
    /**
     * Ground X speed (latitude, positive north).
     */
    vx: number
    /**
     * Ground Y speed (longitude, positive east).
     */
    vy: number
    /**
     * Ground Z speed (altitude, positive down).
     */
    vz: number
    /**
     * Horizontal position uncertainty (standard deviation).
     */
    h_acc: number
    /**
     * Altitude uncertainty (standard deviation).
     */
    v_acc: number
    /**
     * Speed uncertainty (standard deviation).
     */
    vel_acc: number
    /**
     * Time until next update. Set to 0 if unknown or in data driven mode..
     */
    update_rate: number
    /**
     * Unique UAS ID..
     */
    uas_id: number[] // Array of 18 elements
    /**
     * Flight state.
     */
    flight_state: UtmFlightState
    /**
     * Bitwise OR combination of the data available flags..
     */
    flags: BitFlag // TODO: UtmDataAvailFlags https://mavlink.io/en/messages/common.html#UTM_DATA_AVAIL_FLAGS
  }

  /**
   * MAVLink message ID: 350
   * Large debug/prototyping array. The message uses the maximum available payload for data. The array_id and name fields are used to discriminate between messages in code and in user interfaces (respectively). Do not
   */
  export interface DebugFloatArray extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Unique ID used to discriminate between arrays.
     */
    array_id: number
    /**
     * Name, for human-friendly display in a Ground Control Station.
     */
    name: number[] // String as array of 10 chars
    /**
     * data.
     */
    data: number[] // Array of 58 elements
  }

  /**
   * MAVLink message ID: 360
   * Vehicle status report that is sent out while orbit execution is in progress (see MAV_CMD_DO_ORBIT)..
   */
  export interface OrbitExecutionStatus extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Radius of the orbit circle. Positive values orbit clockwise, negative values orbit counter-clockwise..
     */
    radius: number
    /**
     * X coordinate of center point. Coordinate system depends on frame field: local = x position in meters * 1e4, global = latitude in degrees * 1e7..
     */
    x: number
    /**
     * Y coordinate of center point.Coordinate system depends on frame field: local = x position in meters * 1e4, global = latitude in degrees * 1e7..
     */
    y: number
    /**
     * Altitude of center point. Coordinate system depends on frame field..
     */
    z: number
    /**
     * The coordinate system of the fields: x, y, z..
     */
    frame: MavFrame
  }

  /**
   * MAVLink message ID: 370
   * Smart Battery information (static/infrequent update).
   */
  export interface SmartBatteryInfo extends Message {
    /**
     * Capacity when full according to manufacturer, -1: field not provided..
     */
    capacity_full_specification: number
    /**
     * Capacity when full (accounting for battery degradation), -1: field not provided..
     */
    capacity_full: number
    /**
     * Serial number. -1: field not provided..
     */
    serial_number: number
    /**
     * Charge/discharge cycle count. -1: field not provided..
     */
    cycle_count: number
    /**
     * Battery weight. 0: field not provided..
     */
    weight: number
    /**
     * Minimum per-cell voltage when discharging. If not supplied set to UINT16_MAX value..
     */
    discharge_minimum_voltage: number
    /**
     * Minimum per-cell voltage when charging. If not supplied set to UINT16_MAX value..
     */
    charging_minimum_voltage: number
    /**
     * Minimum per-cell voltage when resting. If not supplied set to UINT16_MAX value..
     */
    resting_minimum_voltage: number
    /**
     * Battery ID.
     */
    id: number
    /**
     * Static device name. Encode as manufacturer and product names separated using an underscore..
     */
    device_name: number[] // String as array of 50 chars
  }

  /**
   * MAVLink message ID: 373
   * Telemetry of power generation system. Alternator or mechanical generator..
   */
  export interface GeneratorStatus extends Message {
    /**
     * Status flags..
     */
    status: BitFlag // TODO: MavGeneratorStatusFlag https://mavlink.io/en/messages/common.html#TUNE_FORMAT
    /**
     * Current into/out of battery. Positive for out. Negative for in. NaN: field not provided..
     */
    battery_current: number
    /**
     * Current going to the UAV. If battery current not available this is the DC current from the generator. Positive for out. Negative for in. NaN: field not provided.
     */
    load_current: number
    /**
     * The power being generated. NaN: field not provided.
     */
    power_generated: number
    /**
     * Voltage of the bus seen at the generator, or battery bus if battery bus is controlled by generator and at a different voltage to main bus..
     */
    bus_voltage: number
    /**
     * The target battery current. Positive for out. Negative for in. NaN: field not provided.
     */
    bat_current_setpoint: number
    /**
     * Speed of electrical generator or alternator. UINT16_MAX: field not provided..
     */
    generator_speed: number
    /**
     * The temperature of the rectifier or power converter. INT16_MAX: field not provided..
     */
    rectifier_temperature: number
    /**
     * The temperature of the mechanical motor, fuel cell core or generator. INT16_MAX: field not provided..
     */
    generator_temperature: number
  }

  /**
   * MAVLink message ID: 375
   * The raw values of the actuator outputs (e.g. on Pixhawk, from MAIN, AUX ports). This message supersedes SERVO_OUTPUT_RAW..
   */
  export interface ActuatorOutputStatus extends Message {
    /**
     * Timestamp (since system boot)..
     */
    time_usec: number
    /**
     * Active outputs.
     */
    active: number
    /**
     * Servo / motor output array values. Zero values indicate unused channels..
     */
    actuator: number[] // Array of 32 elements
  }

  /**
   * MAVLink message ID: 380
   * Time/duration estimates for various events and actions given the current vehicle state and position..
   */
  export interface TimeEstimateToTarget extends Message {
    /**
     * Estimated time to complete the vehicle's configured "safe return" action from its current position (e.g. RTL, Smart RTL, etc.). -1 indicates that the vehicle is landed, or that no time estimate available..
     */
    safe_return: number
    /**
     * Estimated time for vehicle to complete the LAND action from its current position. -1 indicates that the vehicle is landed, or that no time estimate available..
     */
    land: number
    /**
     * Estimated time for reaching/completing the currently active mission item. -1 means no time estimate available..
     */
    mission_next_item: number
    /**
     * Estimated time for completing the current mission. -1 means no mission active and/or no estimate available..
     */
    mission_end: number
    /**
     * Estimated time for completing the current commanded action (i.e. Go To, Takeoff, Land, etc.). -1 means no action active and/or no estimate available..
     */
    commanded_action: number
  }

  /**
   * MAVLink message ID: 385
   * Message for transporting "arbitrary" variable-length data from one component to another (broadcast is not forbidden, but discouraged). The encoding of the data is usually extension specific, i.e. determined by the source, and is usually not documented as part of the MAVLink specification..
   */
  export interface Tunnel extends Message {
    /**
     * A code that identifies the content of the payload (0 for unknown, which is the default). If this code is less than 32768, it is a 'registered' payload type and the corresponding code should be added to the MAV_TUNNEL_PAYLOAD_TYPE enum. Software creators can register blocks of types as needed. Codes greater than 32767 are considered local experiments and should not be checked in to any widely distributed codebase..
     */
    payload_type: MavTunnelPayloadType
    /**
     * System ID (can be 0 for broadcast, but this is discouraged).
     */
    target_system: number
    /**
     * Component ID (can be 0 for broadcast, but this is discouraged).
     */
    target_component: number
    /**
     * Length of the data transported in payload.
     */
    payload_length: number
    /**
     * Variable length payload. The payload length is defined by payload_length. The entire content of this block is opaque unless you understand the encoding specified by payload_type..
     */
    payload: number[] // Array of 128 elements
  }

  /**
   * MAVLink message ID: 390
   * Hardware status sent by an onboard computer..
   */
  export interface OnboardComputerStatus extends Message {
    /**
     * Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number..
     */
    time_usec: number
    /**
     * Time since system boot..
     */
    uptime: number
    /**
     * Amount of used RAM on the component system. A value of UINT32_MAX implies the field is unused..
     */
    ram_usage: number
    /**
     * Total amount of RAM on the component system. A value of UINT32_MAX implies the field is unused..
     */
    ram_total: number
    /**
     * Storage type: 0: HDD, 1: SSD, 2: EMMC, 3: SD card (non-removable), 4: SD card (removable). A value of UINT32_MAX implies the field is unused..
     */
    storage_type: number[] // Array of 4 elements
    /**
     * Amount of used storage space on the component system. A value of UINT32_MAX implies the field is unused..
     */
    storage_usage: number[] // Array of 4 elements
    /**
     * Total amount of storage space on the component system. A value of UINT32_MAX implies the field is unused..
     */
    storage_total: number[] // Array of 4 elements
    /**
     * Link type: 0-9: UART, 10-19: Wired network, 20-29: Wifi, 30-39: Point-to-point proprietary, 40-49: Mesh proprietary.
     */
    link_type: number[] // Array of 6 elements
    /**
     * Network traffic from the component system. A value of UINT32_MAX implies the field is unused..
     */
    link_tx_rate: number[] // Array of 6 elements
    /**
     * Network traffic to the component system. A value of UINT32_MAX implies the field is unused..
     */
    link_rx_rate: number[] // Array of 6 elements
    /**
     * Network capacity from the component system. A value of UINT32_MAX implies the field is unused..
     */
    link_tx_max: number[] // Array of 6 elements
    /**
     * Network capacity to the component system. A value of UINT32_MAX implies the field is unused..
     */
    link_rx_max: number[] // Array of 6 elements
    /**
     * Fan speeds. A value of INT16_MAX implies the field is unused..
     */
    fan_speed: number[]
    /**
     * Type of the onboard computer: 0: Mission computer primary, 1: Mission computer backup 1, 2: Mission computer backup 2, 3: Compute node, 4-5: Compute spares, 6-9: Payload computers..
     */
    mavtype: number
    /**
     * CPU usage on the component in percent (100 - idle). A value of UINT8_MAX implies the field is unused..
     */
    cpu_cores: number[] // Array of 8 elements
    /**
     * Combined CPU usage as the last 10 slices of 100 MS (a histogram). This allows to identify spikes in load that max out the system, but only for a short amount of time. A value of UINT8_MAX implies the field is unused..
     */
    cpu_combined: number[] // Array of 10 elements
    /**
     * GPU usage on the component in percent (100 - idle). A value of UINT8_MAX implies the field is unused..
     */
    gpu_cores: number[] // Array of 4 elements
    /**
     * Combined GPU usage as the last 10 slices of 100 MS (a histogram). This allows to identify spikes in load that max out the system, but only for a short amount of time. A value of UINT8_MAX implies the field is unused..
     */
    gpu_combined: number[] // Array of 10 elements
    /**
     * Temperature of the board. A value of INT8_MAX implies the field is unused..
     */
    temperature_board: number
    /**
     * Temperature of the CPU core. A value of INT8_MAX implies the field is unused..
     */
    temperature_core: number[]
  }

  /**
   * MAVLink message ID: 395
   * Information about a component. For camera components instead
   */
  export interface ComponentInformation extends Message {
    /**
     * Timestamp (time since system boot)..
     */
    time_boot_ms: number
    /**
     * The type of metadata being requested..
     */
    metadata_type: CompMetadataType
    /**
     * Unique uid for this metadata which a gcs can
     */
    metadata_uid: number
    /**
     * Unique uid for the translation file associated with the metadata..
     */
    translation_uid: number
    /**
     * Component definition URI. If prefix mavlinkftp:// file is downloaded from vehicle over mavlink ftp protocol. If prefix http[s]:// file is downloaded over internet. Files are json format. They can end in .gz to indicate file is in gzip format..
     */
    metadata_uri: number[] // String as array of 70 chars
    /**
     * The translations for strings within the metadata file. If null the either do not exist or may be included in the metadata file itself. The translations specified here supercede any which may be in the metadata file itself. The uri format is the same as component_metadata_uri . Files are in Json Translation spec format. Empty string indicates no tranlsation file..
     */
    translation_uri: number[] // String as array of 70 chars
  }

  /**
   * MAVLink message ID: 400
   * Play vehicle tone/tune (buzzer). Supersedes message PLAY_TUNE..
   */
  export interface PlayTuneV2 extends Message {
    /**
     * Tune format.
     */
    format: number // TODO: Add missing TuneFormat (https://github.com/mavlink/rust-mavlink/issues/120)
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
    /**
     * Tune definition as a NULL-terminated string..
     */
    tune: number[] // String as array of 248 chars
  }

  /**
   * MAVLink message ID: 401
   * Tune formats supported by vehicle. This should be emitted as response to MAV_CMD_REQUEST_MESSAGE..
   */
  export interface SupportedTunes extends Message {
    /**
     * Bitfield of supported tune formats..
     */
    format: number // TODO: Add missing TuneFormat (https://github.com/mavlink/rust-mavlink/issues/120)
    /**
     * System ID.
     */
    target_system: number
    /**
     * Component ID.
     */
    target_component: number
  }

  /**
   * MAVLink message ID: 9000
   * Cumulative distance traveled for each reported wheel..
   */
  export interface WheelDistance extends Message {
    /**
     * Timestamp (synced to UNIX time or since system boot)..
     */
    time_usec: number
    /**
     * Distance reported by individual wheel encoders. Forward rotations increase values, reverse rotations decrease them. Not all wheels will necessarily have wheel encoders; the mapping of encoders to wheel positions must be agreed/understood by the endpoints..
     */
    distance: number[] // Array of 16 elements
    /**
     * Number of wheels reported..
     */
    count: number
  }

  /**
   * MAVLink message ID: 12900
   * Data for filling the OpenDroneID Basic ID message. This and the below messages are primarily meant for feeding data to/from an OpenDroneID implementation. E.g. https://github.com/opendroneid/opendroneid-core-c. These messages are compatible with the ASTM Remote ID standard at https://www.astm.org/Standards/F3411.htm and the ASD-STAN Direct Remote ID standard. The usage of these messages is documented at https://mavlink.io/en/services/opendroneid.html..
   */
  export interface OpenDroneIdBasicId extends Message {
    /**
     * System ID (0 for broadcast)..
     */
    target_system: number
    /**
     * Component ID (0 for broadcast)..
     */
    target_component: number
    /**
     * Only used for drone ID data received from other UAs. See detailed description at https://mavlink.io/en/services/opendroneid.html. .
     */
    id_or_mac: number[] // Array of 20 elements
    /**
     * Indicates the format for the uas_id field of this message..
     */
    id_type: MavOdidIdType
    /**
     * Indicates the type of UA (Unmanned Aircraft)..
     */
    ua_type: MavOdidUaType
    /**
     * UAS (Unmanned Aircraft System) ID following the format specified by id_type. Shall be filled with nulls in the unused portion of the field..
     */
    uas_id: number[] // Array of 20 elements
  }

  /**
   * MAVLink message ID: 12901
   * Data for filling the OpenDroneID Location message. The float data types are 32-bit IEEE 754. The Location message provides the location, altitude, direction and speed of the aircraft..
   */
  export interface OpenDroneIdLocation extends Message {
    /**
     * Current latitude of the unmanned aircraft. If unknown: 0 (both Lat/Lon)..
     */
    latitude: number
    /**
     * Current longitude of the unmanned aircraft. If unknown: 0 (both Lat/Lon)..
     */
    longitude: number
    /**
     * The altitude calculated from the barometric pressue. Reference is against 29.92inHg or 1013.2mb.
     * If unknown: -1000 m..
     */
    altitude_barometric: number
    /**
     * The geodetic altitude as defined by WGS84. If unknown: -1000 m..
     */
    altitude_geodetic: number
    /**
     * The current height of the unmanned aircraft above the take-off location or the ground as indicated
     * by height_reference. If unknown: -1000 m..
     */
    height: number
    /**
     * Seconds after the full hour with reference to UTC time. Typically the GPS outputs a time-of-week value
     * in milliseconds. First convert that to UTC and then convert for this field using
     * ((float) (time_week_ms % (60*60*1000))) / 1000..
     */
    timestamp: number
    /**
     * Direction over ground (not heading, but direction of movement) measured clockwise from true North:
     * 0 - 35999 centi-degrees. If unknown: 36100 centi-degrees..
     */
    direction: number
    /**
     * Ground speed. Positive only. If unknown: 25500 cm/s. If speed is larger than 25425 cm/s
     */
    speed_horizontal: number
    /**
     * The vertical speed. Up is positive. If unknown: 6300 cm/s. If speed is larger than 6200 cm/s
     */
    speed_vertical: number
    /**
     * System ID (0 for broadcast)..
     */
    target_system: number
    /**
     * Component ID (0 for broadcast)..
     */
    target_component: number
    /**
     * Only used for drone ID data received from other UAs. See detailed description at
     * https://mavlink.io/en/services/opendroneid.html. .
     */
    id_or_mac: number[] // Array of 20 elements
    /**
     * Indicates whether the unmanned aircraft is on the ground or in the air..
     */
    status: MavOdidStatus
    /**
     * Indicates the reference point for the height field..
     */
    height_reference: MavOdidHeightRef
    /**
     * The accuracy of the horizontal position..
     */
    horizontal_accuracy: MavOdidHorAcc
    /**
     * The accuracy of the vertical position..
     */
    vertical_accuracy: MavOdidVerAcc
    /**
     * The accuracy of the barometric altitude..
     */
    barometer_accuracy: MavOdidVerAcc
    /**
     * The accuracy of the horizontal and vertical speed..
     */
    speed_accuracy: MavOdidSpeedAcc
    /**
     * The accuracy of the timestamps..
     */
    timestamp_accuracy: MavOdidTimeAcc
  }

  /**
   * MAVLink message ID: 12902
   * Data for filling the OpenDroneID Authentication message.
   * The Authentication Message defines a field that can provide a means of authenticity for the identity of the
   * UAS (Unmanned Aircraft System). The Authentication message can have two different formats.
   * Five data pages are supported. For data page 0, the fields PageCount, Length and TimeStamp are present and
   * AuthData is only 17 bytes. For data page 1 through 4, PageCount, Length and TimeStamp are not present and
   * the size of AuthData is 23 bytes..
   */
  export interface OpenDroneIdAuthentication extends Message {
    /**
     * This field is only present for page 0. 32 bit Unix Timestamp in seconds since 00:00:00 01/01/2019..
     */
    timestamp: number
    /**
     * System ID (0 for broadcast)..
     */
    target_system: number
    /**
     * Component ID (0 for broadcast)..
     */
    target_component: number
    /**
     * Only used for drone ID data received from other UAs.
     * See detailed description at https://mavlink.io/en/services/opendroneid.html. .
     */
    id_or_mac: number[] // Array of 20 elements
    /**
     * Indicates the type of authentication..
     */
    authentication_type: MavOdidAuthType
    /**
     * Allowed range is 0 - 4..
     */
    data_page: number
    /**
     * This field is only present for page 0. Allowed range is 0 - 5..
     */
    page_count: number
    /**
     * This field is only present for page 0. Total bytes of authentication_data from all data pages.
     * Allowed range is 0 - 109 (17 + 23*4)..
     */
    length: number
    /**
     * Opaque authentication data. For page 0, the size is only 17 bytes. For other pages, the size is 23 bytes.
     * Shall be filled with nulls in the unused portion of the field..
     */
    authentication_data: number[] // Array of 23 elements
  }

  /**
   * MAVLink message ID: 12903
   * Data for filling the OpenDroneID Self ID message. The Self ID Message is an opportunity for the operator
   * to (optionally) declare their identity and purpose of the flight.
   * This message can provide additional information that could reduce the threat profile of a
   * UA (Unmanned Aircraft) flying in a particular area or manner..
   */
  export interface OpenDroneIdSelfId extends Message {
    /**
     * System ID (0 for broadcast)..
     */
    target_system: number
    /**
     * Component ID (0 for broadcast)..
     */
    target_component: number
    /**
     * Only used for drone ID data received from other UAs. See detailed description at
     * https://mavlink.io/en/services/opendroneid.html. .
     */
    id_or_mac: number[] // Array of 20 elements
    /**
     * Indicates the type of the description field..
     */
    description_type: MavOdidDescType
    /**
     * Text description or numeric value expressed as ASCII characters. Shall be filled
     * with nulls in the unused portion of the field..
     */
    description: number[] // String as array of 23 chars
  }

  /**
   * MAVLink message ID: 12904
   * Data for filling the OpenDroneID System message.
   * The System Message contains general system information including the operator location
   * and possible aircraft group information..
   */
  export interface OpenDroneIdSystem extends Message {
    /**
     * Latitude of the operator. If unknown: 0 (both Lat/Lon)..
     */
    operator_latitude: number
    /**
     * Longitude of the operator. If unknown: 0 (both Lat/Lon)..
     */
    operator_longitude: number
    /**
     * Area Operations Ceiling relative to WGS84. If unknown: -1000 m..
     */
    area_ceiling: number
    /**
     * Area Operations Floor relative to WGS84. If unknown: -1000 m..
     */
    area_floor: number
    /**
     * Number of aircraft in the area, group or formation (default 1)..
     */
    area_count: number
    /**
     * Radius of the cylindrical area of the group or formation (default 0)..
     */
    area_radius: number
    /**
     * System ID (0 for broadcast)..
     */
    target_system: number
    /**
     * Component ID (0 for broadcast)..
     */
    target_component: number
    /**
     * Only used for drone ID data received from other UAs. See detailed description at
     * https://mavlink.io/en/services/opendroneid.html. .
     */
    id_or_mac: number[] // Array of 20 elements
    /**
     * Specifies the operator location type..
     */
    operator_location_type: Type<MavOdidOperatorLocationType>
    /**
     * Specifies the classification type of the UA..
     */
    classification_type: Type<MavOdidClassificationType>
    /**
     * When classification_type is MAV_ODID_CLASSIFICATION_TYPE_EU, specifies the category of the UA..
     */
    category_eu: Type<MavOdidCategoryEu>
    /**
     * When classification_type is MAV_ODID_CLASSIFICATION_TYPE_EU, specifies the class of the UA..
     */
    class_eu: Type<MavOdidCategoryEu>
  }

  /**
   * MAVLink message ID: 12905
   * Data for filling the OpenDroneID Operator ID message, which contains the
   * CAA (Civil Aviation Authority) issued operator ID..
   */
  export interface OpenDroneIdOperatorId extends Message {
    /**
     * System ID (0 for broadcast)..
     */
    target_system: number
    /**
     * Component ID (0 for broadcast)..
     */
    target_component: number
    /**
     * Only used for drone ID data received from other UAs. See detailed description at
     * https://mavlink.io/en/services/opendroneid.html.
     */
    id_or_mac: number[] // Array of 20 elements
    /**
     * Indicates the type of the operator_id field..
     */
    operator_id_type: Type<MavOdidOperatorIdType>
    /**
     * Text description or numeric value expressed as ASCII characters. Shall be filled with nulls in the
     * unused portion of the field..
     */
    operator_id: number[] // String as array of 20 chars
  }

  /**
   * MAVLink message ID: 12915
   * An OpenDroneID message pack is a container for multiple encoded OpenDroneID messages
   * (i.e. not in the format given for the above messages descriptions but after encoding
   * into the compressed OpenDroneID byte format). Used e.g. when transmitting on Bluetooth 5.0
   * Long Range/Extended Advertising or on WiFi Neighbor Aware Networking..
   */
  export interface OpenDroneIdMessagePack extends Message {
    /**
     * System ID (0 for broadcast)..
     */
    target_system: number
    /**
     * Component ID (0 for broadcast)..
     */
    target_component: number
    /**
     * This field must currently always be equal to 25 (bytes),
     * since all encoded OpenDroneID messages are specificed to have this length..
     */
    single_message_size: number
    /**
     * Number of encoded messages in the pack (not the number of bytes). Allowed range is 1 - 10..
     */
    msg_pack_size: number
    /**
     * Concatenation of encoded OpenDroneID messages. Shall be filled with nulls in the unused portion of the field..
     */
    messages: number[] // Array of 250 elements
  }
}
