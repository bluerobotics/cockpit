import { v4 as uuid } from 'uuid'

import type { MavParamType } from '@/libs/connection/m2r/dialects/ardupilotmega/MavParamType'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { round } from '@/libs/utils'
import { AlertLevel } from '@/types/alert'
import { type Waypoint, AltitudeReferenceType, WaypointType } from '@/types/mission'

import {
  MavCmd,
  MavFrame,
  MAVLinkType,
  MavMissionType,
  MavSeverity,
} from '../../connection/m2r/messages/mavlink2rest-enum'
import type { VehicleConfigurationSettings } from '../types'

const cockpitMavlinkFrameCorrespondency: [MavFrame, AltitudeReferenceType][] = [
  [MavFrame.MAV_FRAME_GLOBAL_INT, AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL],
  [MavFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT, AltitudeReferenceType.RELATIVE_TO_HOME],
  [MavFrame.MAV_FRAME_GLOBAL_TERRAIN_ALT_INT, AltitudeReferenceType.RELATIVE_TO_TERRAIN],
]

const mavlinkFrameFromCockpitAltRef = (cockpitAltRef: AltitudeReferenceType): MavFrame | undefined => {
  const correspondency = cockpitMavlinkFrameCorrespondency.find((corresp) => corresp[1] === cockpitAltRef)
  return correspondency === undefined ? undefined : correspondency[0]
}

const cockpitAltRefFromMavlinkFrame = (mavframe: MavFrame): AltitudeReferenceType | undefined => {
  const correspondency = cockpitMavlinkFrameCorrespondency.find((corresp) => corresp[0] === mavframe)
  return correspondency === undefined ? undefined : correspondency[1]
}

export const convertCockpitWaypointsToMavlink = (
  cockpitWaypoints: Waypoint[],
  system_id: number
): Message.MissionItemInt[] => {
  return cockpitWaypoints.map((cockpitWaypoint, i) => {
    return {
      target_system: system_id,
      target_component: 1,
      type: MAVLinkType.MISSION_ITEM_INT,
      seq: i,
      frame: {
        type:
          mavlinkFrameFromCockpitAltRef(cockpitWaypoint.altitudeReferenceType) ||
          MavFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
      },
      command: { type: MavCmd.MAV_CMD_NAV_WAYPOINT },
      current: 0,
      autocontinue: 1,
      param1: 0,
      param2: 5,
      param3: 0,
      param4: 999,
      x: round(cockpitWaypoint.coordinates[0] * Math.pow(10, 7)),
      y: round(cockpitWaypoint.coordinates[1] * Math.pow(10, 7)),
      z: Number(cockpitWaypoint.altitude),
      mission_type: { type: MavMissionType.MAV_MISSION_TYPE_MISSION },
    }
  })
}

export const convertMavlinkWaypointsToCockpit = (mavlinkWaypoints: Message.MissionItemInt[]): Waypoint[] => {
  return mavlinkWaypoints.map((mavlinkWaypoint) => {
    return {
      id: uuid(),
      coordinates: [mavlinkWaypoint.x / Math.pow(10, 7), mavlinkWaypoint.y / Math.pow(10, 7)],
      altitude: mavlinkWaypoint.z,
      altitudeReferenceType:
        cockpitAltRefFromMavlinkFrame(mavlinkWaypoint.frame.type) || AltitudeReferenceType.RELATIVE_TO_HOME,
      type: WaypointType.PASS_BY,
    }
  })
}

export const alertLevelFromMavSeverity = {
  // System is unusable. This is a "panic" condition.
  [MavSeverity.MAV_SEVERITY_EMERGENCY]: AlertLevel.Critical,
  // Action should be taken immediately. Indicates error in non-critical systems.
  [MavSeverity.MAV_SEVERITY_ALERT]: AlertLevel.Critical,
  // Action must be taken immediately. Indicates failure in a primary system.
  [MavSeverity.MAV_SEVERITY_CRITICAL]: AlertLevel.Critical,
  // Indicates an error in secondary/redundant systems.
  [MavSeverity.MAV_SEVERITY_ERROR]: AlertLevel.Error,
  // Indicates about a possible future error if this is not resolved within a given timeframe. Example would be a low battery warning.
  [MavSeverity.MAV_SEVERITY_WARNING]: AlertLevel.Warning,
  // An unusual event has occurred, though not an error condition. This should be investigated for the root cause.
  [MavSeverity.MAV_SEVERITY_NOTICE]: AlertLevel.Warning,
  // Normal operational messages. Useful for logging. No action is required for these messages.
  [MavSeverity.MAV_SEVERITY_INFO]: AlertLevel.Info,
  // Useful non-operational messages that can assist in debugging. These should not occur during normal operation.
  [MavSeverity.MAV_SEVERITY_DEBUG]: AlertLevel.Info,
}

/**
 * Data needed for setting a parameter on a ArduPilot vehicle
 */
export interface ArduPilotParameterSetData extends VehicleConfigurationSettings {
  /**
   * Name of the parameter to be set
   */
  id: string
  /**
   * New value for the parameter
   */
  value: number
  /**
   * Parameter type (e.g.: INT8, UINT16)
   */
  type?: MavParamType
}

/**
 * Options for setting a message interval to default or disabled
 */
export interface MessageIntervalDefaultOrDisabledOrDontTouch {
  /**
   * Type of interval to be set
   * 'default' - Use the default interval (as configured by vehicle/other GCS)
   * 'disabled' - Disable the message transmission (set interval to -1)
   * 'dontTouch' - Don't send any request to the vehicle to change the interval (leave as it is)
   */
  intervalType: 'default' | 'disabled' | 'dontTouch'
}

/**
 * Options for setting a message interval
 */
export interface MessageIntervalCustom {
  /**
   * Type of interval to be set
   * 'custom' - Set a custom interval in Hz
   */
  intervalType: 'custom'
  /**
   * Frequency in Hz. Only used if intervalType is 'custom'
   */
  frequencyHz?: number
}

export type MessageIntervalOptions = MessageIntervalDefaultOrDisabledOrDontTouch | MessageIntervalCustom
