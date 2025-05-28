import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'

import { MessageIntervalOptions } from './types'

/**
 * The default frequency in Hertz used for each message type.
 * When initially connecting to the vehicle, the GCS will usually request each of these messages at the specified frequency.
 */
export const defaultMessageFrequency = {
  [MAVLinkType.RAW_IMU]: 2,
  [MAVLinkType.SCALED_IMU2]: 2,
  [MAVLinkType.SCALED_IMU3]: 2,
  [MAVLinkType.SCALED_PRESSURE]: 2,
  [MAVLinkType.SCALED_PRESSURE2]: 2,
  [MAVLinkType.SCALED_PRESSURE3]: 2,
  [MAVLinkType.SYS_STATUS]: 2,
  [MAVLinkType.POWER_STATUS]: 2,
  [MAVLinkType.MEMINFO]: 2,
  [MAVLinkType.GPS_RAW_INT]: 2,
  [MAVLinkType.GPS_RTK]: 2,
  [MAVLinkType.GPS2_RAW]: 2,
  [MAVLinkType.GPS2_RTK]: 2,
  [MAVLinkType.NAV_CONTROLLER_OUTPUT]: 2,
  [MAVLinkType.FENCE_STATUS]: 2,
  [MAVLinkType.GLOBAL_POSITION_INT]: 3,
  [MAVLinkType.SERVO_OUTPUT_RAW]: 2,
  [MAVLinkType.RC_CHANNELS]: 2,
  [MAVLinkType.RC_CHANNELS_RAW]: 2,
  [MAVLinkType.ATTITUDE]: 16,
  [MAVLinkType.SIMSTATE]: 10,
  [MAVLinkType.AHRS2]: 16,
  [MAVLinkType.PID_TUNING]: 10,
  [MAVLinkType.VFR_HUD]: 16,
  [MAVLinkType.AHRS]: 16,
  [MAVLinkType.SYSTEM_TIME]: 3,
  [MAVLinkType.RANGEFINDER]: 3,
  [MAVLinkType.DISTANCE_SENSOR]: 3,
  [MAVLinkType.BATTERY_STATUS]: 3,
  [MAVLinkType.GIMBAL_DEVICE_ATTITUDE_STATUS]: 16,
  [MAVLinkType.OPTICAL_FLOW]: 3,
  [MAVLinkType.MAG_CAL_REPORT]: 3,
  [MAVLinkType.MAG_CAL_PROGRESS]: 3,
  [MAVLinkType.EKF_STATUS_REPORT]: 3,
  [MAVLinkType.VIBRATION]: 3,
  [MAVLinkType.PARAM_VALUE]: 2,
}

export const defaultMessageIntervalsOptions: Record<string, MessageIntervalOptions> = Object.fromEntries(
  Object.entries(defaultMessageFrequency).map(([messageType, frequencyHz]) => [
    messageType,
    { intervalType: 'custom', frequencyHz },
  ])
)
