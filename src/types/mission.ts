import { MavCmd, MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { BatteryChemistry } from '@/libs/vehicle/types'

/**
 * Possible types for mission commands.
 */
export enum MissionCommandType {
  MAVLINK_NAV_COMMAND = 'MAVLINK_NAV_COMMAND',
  MAVLINK_NON_NAV_COMMAND = 'MAVLINK_NON_NAV_COMMAND',
}

export type MavlinkNavCommand = {
  /**
   * MAVLink navigation command type.
   */
  type: MissionCommandType.MAVLINK_NAV_COMMAND
  /**
   * The command to be executed by the mission.
   */
  command: MavCmd
  /**
   * The first parameter of the mission command.
   */
  param1: number
  /**
   * The second parameter of the mission command.
   */
  param2: number
  /**
   * The third parameter of the mission command.
   */
  param3: number
  /**
   * The fourth parameter of the mission command.
   */
  param4: number
}

export type MavlinkNonNavCommand = {
  /**
   * MAVLink non-navigation command type.
   */
  type: MissionCommandType.MAVLINK_NON_NAV_COMMAND
  /**
   * MAVLink non-navigation command.
   */
  command: MavCmd
  /**
   * The first parameter of the non-navigation command.
   */
  param1: number
  /**
   * The second parameter of the non-navigation command.
   */
  param2: number
  /**
   * The third parameter of the non-navigation command.
   */
  param3: number
  /**
   * The fourth parameter of the non-navigation command.
   */
  param4: number
  /**
   * The x parameter of the non-navigation command.
   */
  x: number
  /**
   * The y parameter of the non-navigation command.
   */
  y: number
  /**
   * The z parameter of the non-navigation command.
   */
  z: number
}

export type MissionCommand = MavlinkNavCommand | MavlinkNonNavCommand

/**
 * Possible types for waypoints. Usually used to decide what function should the waypoint perform.
 */
export enum AltitudeReferenceType {
  ABSOLUTE_RELATIVE_TO_MSL = 'Absolute (relative to mean sea level)',
  RELATIVE_TO_HOME = 'Relative to home',
  RELATIVE_TO_TERRAIN = 'Relative to terrain',
}

export type WaypointCoordinates = [number, number]

export type ContextMenuTypes = 'survey' | 'waypoint' | 'map'

export type Waypoint = {
  /**
   * Unique identification for the waypoint.
   */
  id: string
  /**
   * Geographical coordinates of the waypoint in the following format: [latitude, longitude].
   */
  coordinates: WaypointCoordinates
  /**
   * Altitude of the waypoint.
   */
  altitude: number
  /**
   * Type of reference to the altitude value.
   */
  altitudeReferenceType: AltitudeReferenceType
  /**
   * The commands to be executed by the waypoint, in sequence.
   */
  commands: MissionCommand[]
}

export type CockpitMission = {
  /**
   * Version of the mission file. Used for compatibility checking.
   */
  version: number
  /**
   * General Cockpit settings
   */
  settings: {
    /**
     * The coordinates of the map center when the user saved the file
     */
    mapCenter: WaypointCoordinates
    /**
     * The zoom of the map when the user saved the file
     */
    zoom: number
    /**
     * The altitude to be used for the next placed waypoint
     */
    currentWaypointAltitude: number
    /**
     * To use or not altitudes relative to the home altitude
     */
    currentWaypointAltitudeRefType: AltitudeReferenceType
    /**
     * The default speed to be used on the mission
     */
    defaultCruiseSpeed: number
  }
  /**
   * The waypoints of the mission
   */
  waypoints: Waypoint[]
}

/**
 * Survey object that contains the information about the survey to be performed.
 */
export interface Survey {
  /**
   * Unique identification for the survey.
   */
  id: string
  /**
   * Coordinates of the polygon that will be surveyed.
   */
  polygonCoordinates: WaypointCoordinates[]
  /**
   * Density of the scan.
   */
  distanceBetweenLines: number
  /**
   * Angle of the survey lines.
   */
  surveyLinesAngle: number
  /**
   * Executable mission waypoints.
   */
  waypoints: Waypoint[]
}

// TODO - Replace leaflet types with agnostic types
export type SurveyPolygon = {
  /**
   * The coordinates of the polygon that will be converted into a survey.
   */
  polygonPositions: WaypointCoordinates[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const instanceOfCockpitMission = (maybeMission: any): maybeMission is CockpitMission => {
  if (!maybeMission || typeof maybeMission !== 'object') {
    return false
  }

  const requiredKeys = ['version', 'settings', 'waypoints']
  const requiredSettingsKeys = [
    'mapCenter',
    'zoom',
    'currentWaypointAltitude',
    'currentWaypointAltitudeRefType',
    'defaultCruiseSpeed',
  ]

  const isValidMission =
    requiredKeys.every((key) => maybeMission[key] !== undefined) &&
    requiredSettingsKeys.every((key) => maybeMission.settings[key] !== undefined)

  return isValidMission
}

export type MissionLoadingCallback = (loadingPercentage: number) => Promise<void>
export const defaultLoadingCallback: MissionLoadingCallback = async (): Promise<void> => {
  return
}

/**
 * Geographical coordinates for a Point of Interest, in the format [latitude, longitude].
 */
export type PointOfInterestCoordinates = WaypointCoordinates

// For now, let's use string for icon and color. We can refine this later.
/**
 * Represents the icon for a Point of Interest.
 * For now, this is a string (e.g., mdi-icon-name or URL), but can be an enum later.
 */
export type PointOfInterestIcon = string
/**
 * Represents the color for a Point of Interest (e.g., hex code or color name).
 */
export type PointOfInterestColor = string

/**
 * Interface representing a Point of Interest (POI) on the map.
 */
export interface PointOfInterest {
  /**
   * Unique identification for the POI.
   */
  id: string
  /**
   * Name of the POI.
   */
  name: string
  /**
   * Description of the POI.
   */
  description: string
  /**
   * Geographical coordinates of the POI.
   */
  coordinates: PointOfInterestCoordinates
  /**
   * Icon representing the POI.
   */
  icon: PointOfInterestIcon
  /**
   * Color of the POI marker/icon.
   */
  color: PointOfInterestColor
  /** Timestamp of creation or last update */
  timestamp: number
}

export type ClosestSegmentInfo = {
  /**
   * Index of the segment in the polyline.
   */
  segmentIndex: number
  /**
   * Closest point on the segment to the mouse cursor.
   */
  closestPointOnSegment: L.Point
  /**
   * Distance from the mouse cursor to the closest point on the segment.
   */
  distanceInPixels: number
}

/**
 * Interface representing a leg of a mission (a segment between two waypoints).
 */
export type MissionLeg = {
  /**
   * Distance of the leg in meters.
   */
  distanceMeters: number
  /**
   * Speed of the leg in meters per second.
   */
  speedMps: number
}

/**
 * Configuration for mission estimates.
 */
export interface MissionEstimatesByVehicleConfig {
  /**
   * Vehicle type as defined in MAVLink
   */
  vehicleType: MavType
  /**
   * The legs of the mission including speed and distance between waypoints.
   */
  legs: MissionLeg[]
  /**
   * The waypoints of the mission.
   */
  waypoints: Waypoint[]
  /**
   * Indicates if the vehicle has a high drag sensor.
   */
  hasHighDragSensor?: boolean
  /**
   * The extra payload weight in kilograms.
   */
  extraPayloadKg?: number
  /**
   * The battery capacity in watt-hours.
   */
  batteryCapacityWh?: number
  /**
   * The original battery mass in kilograms.
   */
  batteryChemistry?: BatteryChemistry
}

/**
 * Vehicle-specific mission estimates.
 */
export interface VehicleMissionEstimate {
  /**
   * Calculates the estimated time to complete the mission in seconds.
   */
  timeToCompleteMission: (inputs: MissionEstimatesByVehicleConfig) => number
  /**
   * Calculates the total energy consumption for the mission in watt-hours.
   */
  totalEnergy: (inputs: MissionEstimatesByVehicleConfig) => number
}
