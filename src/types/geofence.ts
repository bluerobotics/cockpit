import type { CockpitMission, WaypointCoordinates } from '@/types/mission'

/**
 * Geographical coordinates in the format [latitude, longitude].
 */
export type FenceLatLng = WaypointCoordinates

/**
 * A polygon-shaped geofence. May be inclusion (vehicle must stay inside)
 * or exclusion (vehicle must stay outside).
 */
export interface FencePolygon {
  /**
   * Unique identification for the polygon.
   */
  id: string
  /**
   * If true, the vehicle is restricted to the inside of the polygon.
   * If false, the vehicle is restricted to the outside of the polygon.
   */
  inclusion: boolean
  /**
   * Ordered list of polygon vertices. Polygons are 2D — altitude limits are
   * enforced via vehicle parameters (FENCE_ALT_MAX/MIN, GF_MAX_VER_DIST).
   */
  vertices: FenceLatLng[]
}

/**
 * A circle-shaped geofence. May be inclusion (vehicle must stay inside)
 * or exclusion (vehicle must stay outside).
 */
export interface FenceCircle {
  /**
   * Unique identification for the circle.
   */
  id: string
  /**
   * If true, the vehicle is restricted to the inside of the circle.
   * If false, the vehicle is restricted to the outside of the circle.
   */
  inclusion: boolean
  /**
   * Geographical coordinates of the circle center.
   */
  center: FenceLatLng
  /**
   * Radius of the circle in meters.
   */
  radius: number
}

/**
 * Optional point the vehicle should return to when the geofence is breached.
 * Stored separately from polygons/circles. On ArduPilot Plane this can be
 * overridden by rally points when FENCE_RET_RALLY = 1. Not honored by PX4.
 */
export interface BreachReturnPoint {
  /**
   * Geographical coordinates of the breach return point.
   */
  coordinates: FenceLatLng
  /**
   * Altitude (meters, relative to home) the vehicle should fly to.
   */
  altitude: number
}

/**
 * Complete geofence plan as used at runtime in Cockpit. Schema mirrors the
 * de-facto MAVLink-ecosystem `.plan` `geoFence` block (version 2) so files
 * can round-trip with other ground stations. Polygons store vertices as
 * `[lat, lon]`; circles store `{ center: [lat, lon], radius }`;
 * `breachReturn` is the structured `BreachReturnPoint` (separate
 * `coordinates` and `altitude`). Note that the on-disk JSON form represents
 * the breach return as a `[lat, lon, alt]` tuple — see `MavlinkPlanFile`
 * for that wire shape.
 */
export interface GeoFencePlan {
  /**
   * Schema version. Matches the `.plan` `geoFence.version` field.
   */
  version: 2
  /**
   * Inclusion and exclusion polygons.
   */
  polygons: FencePolygon[]
  /**
   * Inclusion and exclusion circles.
   */
  circles: FenceCircle[]
  /**
   * Optional breach return point.
   */
  breachReturn?: BreachReturnPoint
}

/**
 * Cockpit-native fence file. Wraps a `GeoFencePlan` in a small envelope so
 * the file can be unambiguously identified on import (cf. `.cmp` mission
 * files).
 */
export interface CockpitFencePlanFile {
  /**
   * Cockpit fence file version. Currently `0`.
   */
  version: number
  /**
   * Discriminator used by the importer.
   */
  fileType: 'CockpitFencePlan'
  /**
   * The actual fence plan.
   */
  plan: GeoFencePlan
}

/**
 * Subset of the MAVLink-ecosystem `.plan` JSON document we need to parse
 * and emit for round-tripping with other ground stations. We only model
 * the `geoFence` block exhaustively; the `mission` and `rallyPoints`
 * blocks are treated as opaque so we can preserve them on round-trip.
 */
export interface MavlinkPlanFile {
  /**
   * Always `'Plan'` for a `.plan` file.
   */
  fileType: 'Plan'
  /**
   * Plan-file schema version.
   */
  version: number
  /**
   * Originating ground station name.
   */
  groundStation?: string
  /**
   * Mission section (kept opaque for round-trip).
   */
  mission?: unknown
  /**
   * Rally points section (kept opaque for round-trip).
   */
  rallyPoints?: unknown
  /**
   * Geofence section.
   */
  geoFence?: {
    /**
     * Schema version. Cockpit only reads `version === 2`.
     */
    version: number
    /**
     * Polygons array (`.plan` schema).
     */
    polygons?: {
      /**
       * Per-polygon schema version.
       */
      version: number
      /**
       * Whether the polygon is an inclusion fence.
       */
      inclusion: boolean
      /**
       * Vertex list, each `[lat, lon]`.
       */
      polygon: [number, number][]
    }[]
    /**
     * Circles array (`.plan` schema).
     */
    circles?: {
      /**
       * Per-circle schema version.
       */
      version: number
      /**
       * Whether the circle is an inclusion fence.
       */
      inclusion: boolean
      /**
       * Center coordinates and radius.
       */
      circle: {
        /**
         * Center coordinates `[lat, lon]`.
         */
        center: [number, number]
        /**
         * Radius in meters.
         */
        radius: number
      }
    }[]
    /**
     * Breach return point as `[lat, lon, alt]`.
     */
    breachReturn?: [number, number, number]
  }
}

/**
 * Validates that a parsed JSON object is a `CockpitFencePlanFile`.
 * @param { unknown } maybeFile The parsed JSON to inspect.
 * @returns { boolean } True if the object is a valid Cockpit fence file.
 */
export const instanceOfCockpitFencePlanFile = (maybeFile: unknown): maybeFile is CockpitFencePlanFile => {
  if (!maybeFile || typeof maybeFile !== 'object') return false
  const f = maybeFile as Partial<CockpitFencePlanFile>
  if (f.fileType !== 'CockpitFencePlan') return false
  if (typeof f.version !== 'number') return false
  return instanceOfGeoFencePlan(f.plan)
}

/**
 * Lightweight envelope check for a MAVLink-ecosystem `.plan` file.
 * Validates only the outer `fileType === 'Plan'` discriminator and that
 * `version` is a number; the inner `mission` / `geoFence` blocks are not
 * inspected and must be validated by the caller before use.
 * @param { unknown } maybeFile The parsed JSON to inspect.
 * @returns { boolean } True if the object looks like a `.plan` envelope.
 */
export const instanceOfMavlinkPlanFile = (maybeFile: unknown): maybeFile is MavlinkPlanFile => {
  if (!maybeFile || typeof maybeFile !== 'object') return false
  const f = maybeFile as Partial<MavlinkPlanFile>
  return f.fileType === 'Plan' && typeof f.version === 'number'
}

/**
 * Validates that a parsed object conforms to the `GeoFencePlan` shape.
 * @param { unknown } maybePlan The parsed JSON to inspect.
 * @returns { boolean } True if the object is a valid `GeoFencePlan`.
 */
export const instanceOfGeoFencePlan = (maybePlan: unknown): maybePlan is GeoFencePlan => {
  if (!maybePlan || typeof maybePlan !== 'object') return false
  const p = maybePlan as Partial<GeoFencePlan>
  if (p.version !== 2) return false
  if (!Array.isArray(p.polygons)) return false
  if (!Array.isArray(p.circles)) return false
  return true
}

/**
 * Re-export of `CockpitMission` to keep both mission and fence type
 * imports near each other in callers that produce a combined `.plan`.
 */
export type { CockpitMission }
