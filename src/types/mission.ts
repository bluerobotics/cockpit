/**
 * Possible types for waypoints. Usually used to decide what function should the waypoint perform.
 */
export enum WaypointType {
  PASS_BY = 'Pass by',
  HOME = 'Home',
}

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
   * The type of the waypoint. Usually used to decide what function should the waypoint perform.
   */
  type: WaypointType
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
     * The type to be used for the next placed waypoint
     */
    currentWaypointType: WaypointType
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
  const requiredKeys = ['version', 'settings', 'waypoints']
  const requiredSettingsKeys = [
    'mapCenter',
    'zoom',
    'currentWaypointType',
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
