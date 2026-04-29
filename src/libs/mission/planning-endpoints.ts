import { distanceInMeters } from '@/libs/map/utils-map'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

/**
 * Decides which end of an existing planning a new element clicked at `coordinates` belongs to, so
 * right-click additions attach to the nearest endpoint instead of always extending the route's end.
 * @param {WaypointCoordinates} coordinates - Position the new element was requested at.
 * @param {Waypoint[]} waypoints - Current planning waypoints, in route order.
 * @returns {number | null} `0` to splice at the start of the planning, or `null` to append at the end.
 */
export const endpointSplicePosition = (coordinates: WaypointCoordinates, waypoints: Waypoint[]): number | null => {
  if (waypoints.length < 2) return null
  const first = waypoints[0].coordinates
  const last = waypoints[waypoints.length - 1].coordinates
  return distanceInMeters(coordinates, first) < distanceInMeters(coordinates, last) ? 0 : null
}
