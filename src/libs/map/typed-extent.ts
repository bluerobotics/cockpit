import { localFrame } from '@/libs/map/local-frame'
import type { WaypointCoordinates } from '@/types/mission'

// A mistyped extra digit would otherwise build an area the path generator sweeps line by line, so every typed
// extent is held to a range a survey can be flown at.
export const minExtentInMeters = 1
export const maxExtentInMeters = 100000

/**
 * Holds a typed extent to the range a survey can be flown at, keeping its sign, which is how a negative extent
 * grows the shape to the side opposite the cursor.
 * @param {number} value - The extent that was typed, in meters.
 * @param {number} fallback - Extent to keep when nothing usable was typed.
 * @returns {number} The extent to build with, in meters, negative when it was typed that way.
 */
export const clampExtent = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value === 0) return fallback

  const magnitude = Math.min(maxExtentInMeters, Math.max(minExtentInMeters, Math.abs(value)))
  return value < 0 ? -magnitude : magnitude
}

/**
 * Walks a given distance from one coordinate in the direction of another, which is how a typed extent takes over
 * a segment whose direction is still being chosen with the cursor.
 * @param {WaypointCoordinates} from - Coordinate the distance is walked from.
 * @param {WaypointCoordinates} towards - Coordinate giving the direction to walk in.
 * @param {number} distanceInMeters - How far to walk.
 * @returns {WaypointCoordinates} The coordinate at that distance, or the origin when there is no direction yet.
 */
export const pointAtDistanceToward = (
  from: WaypointCoordinates,
  towards: WaypointCoordinates,
  distanceInMeters: number
): WaypointCoordinates => {
  const { toLocal, toCoordinates } = localFrame(from)
  const { x, y } = toLocal(towards)
  const magnitude = Math.hypot(x, y)
  if (magnitude === 0) return from

  const scale = distanceInMeters / magnitude
  return toCoordinates({ x: x * scale, y: y * scale })
}
