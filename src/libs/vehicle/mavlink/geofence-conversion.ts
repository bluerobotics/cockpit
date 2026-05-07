import { v4 as uuid } from 'uuid'

import { MavCmd, MavFrame, MAVLinkType, MavMissionType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import type { BreachReturnPoint, FenceCircle, FenceLatLng, FencePolygon, GeoFencePlan } from '@/types/geofence'

const COORD_SCALE = 1e7

/**
 * Builds a `MISSION_ITEM_INT` for a single fence vertex/circle/return point.
 * @param { number } seq Sequence index of the item in the upload.
 * @param { number } system_id Target system ID.
 * @param { MavCmd } command MAV_CMD to use for this item.
 * @param { MavFrame } frame Coordinate frame for this item.
 * @param { number } param1 Item-specific parameter 1 (vertex count or radius).
 * @param { number } lat Latitude in decimal degrees.
 * @param { number } lon Longitude in decimal degrees.
 * @param { number } alt Altitude in meters (used by breach return point only).
 * @returns { Message.MissionItemInt } The encoded mission item.
 */
const buildFenceItem = (
  seq: number,
  system_id: number,
  command: MavCmd,
  frame: MavFrame,
  param1: number,
  lat: number,
  lon: number,
  alt: number
): Message.MissionItemInt => ({
  target_system: system_id,
  target_component: 1,
  type: MAVLinkType.MISSION_ITEM_INT,
  seq,
  frame: { type: frame },
  command: { type: command },
  current: 0,
  autocontinue: 1,
  param1,
  param2: 0,
  param3: 0,
  param4: 0,
  x: Math.round(lat * COORD_SCALE),
  y: Math.round(lon * COORD_SCALE),
  z: alt,
  mission_type: { type: MavMissionType.MAV_MISSION_TYPE_FENCE },
})

/**
 * Encodes a `GeoFencePlan` into a flat `MissionItemInt[]` ready to be uploaded
 * via the MAVLink mission micro-service with `mission_type = MAV_MISSION_TYPE_FENCE`.
 *
 * Polygon vertices belonging to the same polygon are sent sequentially and
 * carry the same `param1 = vertex_count`. The vehicle uses the change in
 * `command` or `param1` to detect polygon boundaries.
 *
 * The optional breach return point is emitted last with
 * `MAV_FRAME_GLOBAL_RELATIVE_ALT` so altitude is interpreted relative to home.
 * @param { GeoFencePlan } plan The plan to encode.
 * @param { number } system_id Target system ID for the items.
 * @returns { Message.MissionItemInt[] } The flat sequence of mission items.
 */
export const convertGeoFencePlanToMavlink = (plan: GeoFencePlan, system_id: number): Message.MissionItemInt[] => {
  const items: Message.MissionItemInt[] = []

  plan.polygons.forEach((polygon) => {
    if (polygon.vertices.length < 3) return
    const command = polygon.inclusion
      ? MavCmd.MAV_CMD_NAV_FENCE_POLYGON_VERTEX_INCLUSION
      : MavCmd.MAV_CMD_NAV_FENCE_POLYGON_VERTEX_EXCLUSION
    const vertexCount = polygon.vertices.length
    polygon.vertices.forEach(([lat, lon]) => {
      items.push(buildFenceItem(items.length, system_id, command, MavFrame.MAV_FRAME_GLOBAL, vertexCount, lat, lon, 0))
    })
  })

  plan.circles.forEach((circle) => {
    const command = circle.inclusion
      ? MavCmd.MAV_CMD_NAV_FENCE_CIRCLE_INCLUSION
      : MavCmd.MAV_CMD_NAV_FENCE_CIRCLE_EXCLUSION
    const [lat, lon] = circle.center
    items.push(buildFenceItem(items.length, system_id, command, MavFrame.MAV_FRAME_GLOBAL, circle.radius, lat, lon, 0))
  })

  if (plan.breachReturn) {
    const [lat, lon] = plan.breachReturn.coordinates
    items.push(
      buildFenceItem(
        items.length,
        system_id,
        MavCmd.MAV_CMD_NAV_FENCE_RETURN_POINT,
        MavFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT,
        0,
        lat,
        lon,
        plan.breachReturn.altitude
      )
    )
  }

  return items
}

const POLYGON_INCLUSION = 'MAV_CMD_NAV_FENCE_POLYGON_VERTEX_INCLUSION'
const POLYGON_EXCLUSION = 'MAV_CMD_NAV_FENCE_POLYGON_VERTEX_EXCLUSION'
const CIRCLE_INCLUSION = 'MAV_CMD_NAV_FENCE_CIRCLE_INCLUSION'
const CIRCLE_EXCLUSION = 'MAV_CMD_NAV_FENCE_CIRCLE_EXCLUSION'
const RETURN_POINT = 'MAV_CMD_NAV_FENCE_RETURN_POINT'

const isPolygonCommand = (cmd: string): boolean => cmd === POLYGON_INCLUSION || cmd === POLYGON_EXCLUSION

const itemCoordinates = (item: Message.MissionItemInt): FenceLatLng => [item.x / COORD_SCALE, item.y / COORD_SCALE]

/**
 * Decodes a flat `MissionItemInt[]` (downloaded from the vehicle with
 * `mission_type = MAV_MISSION_TYPE_FENCE`) back into a `GeoFencePlan`.
 *
 * Polygons are reassembled by accumulating consecutive items with the same
 * polygon command until `param1` (vertex count) vertices have been collected.
 * Mismatched commands or vertex counts mid-polygon throw a descriptive error
 * so callers can flag corrupted/partial fence downloads.
 * @param { Message.MissionItemInt[] } items Items downloaded from the vehicle.
 * @returns { GeoFencePlan } The decoded geofence plan.
 */
export const convertMavlinkToGeoFencePlan = (items: Message.MissionItemInt[]): GeoFencePlan => {
  const polygons: FencePolygon[] = []
  const circles: FenceCircle[] = []
  let breachReturn: BreachReturnPoint | undefined = undefined

  let pendingVertices: FenceLatLng[] = []
  let pendingCommand: string | undefined = undefined
  let pendingExpectedCount = 0

  const flushPendingPolygon = (): void => {
    if (pendingVertices.length === 0) return
    if (pendingCommand === undefined) return
    polygons.push({
      id: uuid(),
      inclusion: pendingCommand === POLYGON_INCLUSION,
      vertices: pendingVertices,
    })
    pendingVertices = []
    pendingCommand = undefined
    pendingExpectedCount = 0
  }

  for (const item of items) {
    const command = item.command.type as string

    if (isPolygonCommand(command)) {
      const vertexCount = Math.round(item.param1)
      if (pendingCommand === undefined) {
        pendingCommand = command
        pendingExpectedCount = vertexCount
        pendingVertices = [itemCoordinates(item)]
      } else if (pendingCommand !== command || pendingExpectedCount !== vertexCount) {
        // Bad polygon item format — vertex count or command changed mid-polygon.
        throw new Error(
          `[Fence download] Bad polygon item format at seq ${item.seq}. Polygon vertices have inconsistent command or count.`
        )
      } else {
        pendingVertices.push(itemCoordinates(item))
      }

      if (pendingVertices.length === pendingExpectedCount) {
        flushPendingPolygon()
      }
      continue
    }

    if (pendingVertices.length > 0) {
      // Incomplete polygon — non-vertex command appears before the polygon is closed.
      throw new Error(
        `[Fence download] Incomplete polygon at seq ${item.seq}. Expected ${pendingExpectedCount} vertices, got ${pendingVertices.length}.`
      )
    }

    if (command === CIRCLE_INCLUSION || command === CIRCLE_EXCLUSION) {
      circles.push({
        id: uuid(),
        inclusion: command === CIRCLE_INCLUSION,
        center: itemCoordinates(item),
        radius: item.param1,
      })
      continue
    }

    if (command === RETURN_POINT) {
      breachReturn = {
        coordinates: itemCoordinates(item),
        altitude: item.z,
      }
      continue
    }

    throw new Error(`[Fence download] Unsupported command '${command}' at seq ${item.seq}.`)
  }

  if (pendingVertices.length > 0) {
    throw new Error(
      `[Fence download] Incomplete polygon at end of items. Expected ${pendingExpectedCount} vertices, got ${pendingVertices.length}.`
    )
  }

  return { version: 2, polygons, circles, breachReturn }
}

/**
 * Creates an empty geofence plan.
 * @returns { GeoFencePlan } An empty plan with no polygons, circles, or breach return.
 */
export const emptyGeoFencePlan = (): GeoFencePlan => ({ version: 2, polygons: [], circles: [] })
