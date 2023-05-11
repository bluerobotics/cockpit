/**
 * Possible types for waypoints. Usually used to decide what function should the waypoint perform.
 */
export enum WaypointType {
  PASS_BY = 'Pass by',
  TAKEOFF = 'Takeoff',
  LAND = 'Land',
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
