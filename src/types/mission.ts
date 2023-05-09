/**
 * Possible types for waypoints. Usually used to decide what function should the waypoint perform.
 */
export enum WaypointType {
  PASS_BY = 'Pass by',
  TAKEOFF = 'Takeoff',
  LAND = 'Land',
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
   * The type of the waypoint. Usually used to decide what function should the waypoint perform.
   */
  type: WaypointType
}
