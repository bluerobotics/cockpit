import { waypointAltitudesAmsl } from '@/libs/hazards/hazard-checks'
import { type TerrainVehicleClass, surfaceHeight } from '@/libs/terrain/mission-profile'
import { AltitudeReferenceType } from '@/types/mission'

/** Height a newly placed aerial waypoint holds over home. */
export const DEFAULT_AIR_HEIGHT_OVER_HOME_M = 30

/**
 * The height a waypoint is placed at, and what that height is measured from.
 */
export interface PlacementAltitude {
  /**
   * Height in meters, in its own reference.
   */
  altitude: number
  /**
   * What the height is measured from.
   */
  altitudeReferenceType: AltitudeReferenceType
}

/**
 * What the terrain model reads where a waypoint is going, and the clearance the vehicle keeps.
 */
export interface PlacementContext {
  /**
   * How the planned vehicle meets the terrain; only an aircraft is settled against the ground.
   */
  vehicleClass: TerrainVehicleClass
  /**
   * Ground under the waypoint, null where the model has no data.
   */
  groundAtWaypointM: number | null
  /**
   * Ground under home, null where the model has no data or home is not set.
   */
  groundAtHomeM: number | null
  /**
   * Water surface height, which an aircraft clears instead of the seabed.
   */
  waterLevelM: number
  /**
   * Least clearance to keep over that surface, in meters.
   */
  clearanceM: number
}

/**
 * Height a newly placed waypoint starts at, before any terrain is read: an aircraft holds a height over
 * home, which flies without terrain on the vehicle, and every other vehicle keeps the home-relative zero the
 * planner has always used.
 * @param {TerrainVehicleClass} vehicleClass How the planned vehicle meets the terrain.
 * @returns {PlacementAltitude} The starting height and reference.
 */
export const defaultPlacementAltitude = (vehicleClass: TerrainVehicleClass): PlacementAltitude => ({
  altitude: vehicleClass === 'air' ? DEFAULT_AIR_HEIGHT_OVER_HOME_M : 0,
  altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME,
})

/**
 * Settles the height of an aircraft waypoint against the ground under it: a terrain-relative height is
 * left as planned, and a fixed height that would put the waypoint inside the terrain rises to the
 * clearance instead.
 * @param {PlacementAltitude} wanted Height the placement asked for.
 * @param {PlacementContext} context What the model reads there, and the clearance to keep.
 * @returns {PlacementAltitude} Where to place it, the same object when nothing had to move.
 */
export const settlePlacementAltitude = (
  wanted: PlacementAltitude,
  { vehicleClass, groundAtWaypointM, groundAtHomeM, waterLevelM, clearanceM }: PlacementContext
): PlacementAltitude => {
  checkWaypointAltitudeOnce()
  if (vehicleClass !== 'air' || groundAtWaypointM === null) return wanted
  // One height over the ground clears it wherever it is read, and an unreadable model (offline) says nothing
  // about the ground, so a terrain-relative height never moves.
  if (wanted.altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_TERRAIN) return wanted
  const homeSurfaceM = groundAtHomeM === null ? null : surfaceHeight(groundAtHomeM, waterLevelM)
  const [amslM] = waypointAltitudesAmsl([wanted], [groundAtWaypointM], homeSurfaceM)
  const lowestM = surfaceHeight(groundAtWaypointM, waterLevelM) + clearanceM
  if (amslM === undefined || amslM >= lowestM) return wanted
  if (wanted.altitudeReferenceType === AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL) {
    return { ...wanted, altitude: Math.ceil(lowestM) }
  }
  return homeSurfaceM === null ? wanted : { ...wanted, altitude: Math.ceil(lowestM - homeSurfaceM) }
}

let selfChecked = false

const checkWaypointAltitudeOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const air = { vehicleClass: 'air' as TerrainVehicleClass, groundAtHomeM: 500, waterLevelM: 0, clearanceM: 26 }
  const placed = defaultPlacementAltitude('air')
  assert(
    placed.altitude === DEFAULT_AIR_HEIGHT_OVER_HOME_M &&
      placed.altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_HOME,
    'An aircraft waypoint is placed 30 m above home'
  )
  const overTerrain = { altitude: 30, altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_TERRAIN }
  assert(
    settlePlacementAltitude(overTerrain, { ...air, groundAtWaypointM: 800 }) === overTerrain,
    'A terrain-relative height the model resolves is left where it is'
  )
  assert(
    settlePlacementAltitude(overTerrain, { ...air, groundAtWaypointM: null }) === overTerrain,
    'Without terrain data a terrain-relative height is left where it is'
  )
  const fixed = { altitude: 30, altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME }
  assert(
    settlePlacementAltitude(fixed, { ...air, groundAtWaypointM: 800 }).altitude === 326,
    'A home-relative height inside a hill rises to the clearance over it'
  )
  assert(
    settlePlacementAltitude(fixed, { ...air, groundAtWaypointM: 400 }) === fixed,
    'A home-relative height already clear of the ground is left where it is'
  )
  assert(
    settlePlacementAltitude({ ...fixed, altitude: 0 }, { ...air, vehicleClass: 'underwater', groundAtWaypointM: -40 })
      .altitude === 0,
    'A submarine keeps the depth it was given'
  )
}
