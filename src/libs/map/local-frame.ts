import { earthRadiusMeters } from '@/libs/mission/general-estimates'
import { degrees, radians } from '@/libs/utils'
import type { WaypointCoordinates } from '@/types/mission'

/** A point in the local east/north plane, in meters from the frame's anchor. */
export interface LocalPoint {
  /** Meters east of the anchor. */
  x: number
  /** Meters north of the anchor. */
  y: number
}

/** Converters between coordinates and a local east/north plane anchored at one point. */
export interface LocalFrame {
  /** Projects a coordinate into the frame. */
  toLocal: (coordinates: WaypointCoordinates) => LocalPoint
  /** Lifts a point in the frame back to a coordinate. */
  toCoordinates: (localPoint: LocalPoint) => WaypointCoordinates
}

/**
 * Rectangles are built and measured in this plane, the same equirectangular projection the mission estimates
 * use, because a spherical quad cannot have four square corners and equal opposite sides at once: walking great
 * circles instead leaves the far side of a 300 m rectangle a third of a meter long.
 * @param {WaypointCoordinates} anchor - Coordinate the plane is centered on.
 * @returns {LocalFrame} Converters in and out of the plane anchored at that coordinate.
 */
export const localFrame = (anchor: WaypointCoordinates): LocalFrame => {
  const cosAnchorLatitude = Math.cos(radians(anchor[0]))
  return {
    toLocal: (coordinates) => ({
      x: earthRadiusMeters * radians(coordinates[1] - anchor[1]) * cosAnchorLatitude,
      y: earthRadiusMeters * radians(coordinates[0] - anchor[0]),
    }),
    toCoordinates: ({ x, y }) => [
      anchor[0] + degrees(y / earthRadiusMeters),
      anchor[1] + degrees(x / (earthRadiusMeters * cosAnchorLatitude)),
    ],
  }
}
