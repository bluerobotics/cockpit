import type { Survey, Waypoint } from '@/types/mission'

/**
 * Whether the planner already has a live mission in memory.
 * @param {Waypoint[]} waypoints - Current planning waypoints.
 * @param {Survey[]} surveys - Current planning surveys.
 * @returns {boolean} True when either list still has items.
 */
export const hasLivePlanningMission = (waypoints: Waypoint[], surveys: Survey[]): boolean =>
  waypoints.length > 0 || surveys.length > 0
