import { v4 as uuid } from 'uuid'

import { MavCmd } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import {
  type MavlinkNonNavCommand,
  type MissionCommand,
  type Waypoint,
  type WaypointCoordinates,
  AltitudeReferenceType,
  MissionCommandType,
} from '@/types/mission'

import {
  type PathStation,
  type ProfilePoint,
  type TerrainProfileContext,
  type TerrainProfileSample,
  type TerrainVehicleClass,
  densifyPath,
  pointAltitudesAmsl,
  surfaceHeight,
} from './mission-profile'

/**
 * Reads the conservative ground height under some positions.
 */
export type GroundSampler = (coordinates: WaypointCoordinates[]) => Promise<(number | null)[]>

/**
 * A mission whose terrain-relative waypoints were turned into sea-level ones.
 */
export interface ResolvedTerrainMission {
  /**
   * The mission waypoints, with any added between them.
   */
  waypoints: Waypoint[]
  /**
   * Waypoints added to hold the height over the ground between the original ones.
   */
  addedWaypoints: number
  /**
   * Terrain-relative waypoints left as they were, because the ground on their leg is unknown.
   */
  unresolvedWaypoints: number
}

/**
 * How fast a vehicle can change height while flying its mission.
 */
export interface ClimbPerformance {
  /**
   * Horizontal speed along the mission, in meters per second.
   */
  cruiseSpeedMs: number
  /**
   * Fastest climb, in meters per second.
   */
  climbRateMs: number
  /**
   * Fastest descent, in meters per second.
   */
  sinkRateMs: number
  /**
   * True for vehicles that slow down to make a climb (multirotors), false for those that cannot.
   */
  slowsToClimb: boolean
}

/**
 * A stretch where the planned path asks for more climb or descent than the vehicle has.
 */
export interface ClimbFinding {
  /**
   * Whether the vehicle cannot follow the path, or follows it by slowing down.
   */
  kind: 'climb-limit' | 'descent-limit' | 'slows-to-climb'
  /**
   * Leg it lies on.
   */
  legIndex: number
  /**
   * Where it begins, meters from the start.
   */
  fromM: number
  /**
   * Where it ends, meters from the start.
   */
  toM: number
  /**
   * Steepest grade over the stretch, in percent.
   */
  gradePercent: number
  /**
   * Speed the vehicle slows to, for those that slow to climb, in meters per second.
   */
  slowedSpeedMs: number
}

// Close enough to the model's own 30 m spacing that a resolved leg sees every ridge in it.
const RESOLVE_SPACING_M = 25
// Grades are read over this run so one noisy sample is not mistaken for a cliff.
const GRADE_WINDOW_M = 100

/**
 * Indices of the fewest stations whose straight lines never pass below the wanted altitudes and
 * never exceed them by more than a tolerance.
 * @param {number[]} distancesM Station distances along the path.
 * @param {number[]} wantedM Wanted altitude at each station.
 * @param {number} toleranceM How far above the wanted altitude a line may pass.
 * @returns {number[]} Kept station indices, first and last included, ascending.
 */
const simplifyAbove = (distancesM: number[], wantedM: number[], toleranceM: number): number[] => {
  const last = wantedM.length - 1
  if (last < 1) return last === 0 ? [0] : []
  const kept = new Set<number>([0, last])
  const spans: [number, number][] = [[0, last]]
  while (spans.length > 0) {
    const [start, end] = spans.pop()!
    let worst = -1
    let worstExcess = 0
    for (let index = start + 1; index < end; index++) {
      const fraction = (distancesM[index] - distancesM[start]) / (distancesM[end] - distancesM[start] || 1)
      const line = wantedM[start] + (wantedM[end] - wantedM[start]) * fraction
      const excess = Math.max(wantedM[index] - line, line - wantedM[index] - toleranceM)
      if (excess > worstExcess) {
        worstExcess = excess
        worst = index
      }
    }
    if (worst < 0) continue
    kept.add(worst)
    spans.push([start, worst], [worst, end])
  }
  return [...kept].sort((a, b) => a - b)
}

const navCommandsLike = (waypoint: Waypoint): MissionCommand[] => {
  const nav = waypoint.commands.find(
    (command) =>
      command.type === MissionCommandType.MAVLINK_NAV_COMMAND && command.command === MavCmd.MAV_CMD_NAV_WAYPOINT
  )
  return [
    nav
      ? { ...nav, param1: 0 }
      : {
          type: MissionCommandType.MAVLINK_NAV_COMMAND,
          command: MavCmd.MAV_CMD_NAV_WAYPOINT,
          param1: 0,
          param2: 5,
          param3: 0,
          param4: 999,
        },
  ]
}

const wantedAlongLeg = (
  stations: PathStation[],
  ground: (number | null)[],
  startAglM: number,
  endAglM: number,
  surface: (groundM: number) => number,
  ceilingM: number
): number[] | null => {
  const wanted: number[] = []
  for (const [index, station] of stations.entries()) {
    const height = ground[index]
    if (height === null) return null
    wanted.push(Math.min(ceilingM, surface(height) + startAglM + (endAglM - startAglM) * station.legFraction))
  }
  return wanted
}

/**
 * Turns an aircraft mission's terrain-relative waypoints into sea-level ones, adding waypoints in
 * between wherever a straight line would drift from the wanted height over the ground, so the
 * vehicle holds that height without terrain data of its own.
 * @param {Waypoint[]} waypoints Mission waypoints, home excluded.
 * @param {WaypointCoordinates} home Home position the mission starts from.
 * @param {GroundSampler} sampleGround Conservative ground sampler.
 * @param {TerrainProfileContext} context Vehicle and water level.
 * @param {number} toleranceM How far above the wanted height the path may pass.
 * @param {TerrainVehicleClass[]} vehicleClasses Vehicles resolved; submarines hold their height over the seabed, never
 *   above the water surface.
 * @returns {Promise<ResolvedTerrainMission>} The resolved mission.
 */
export const resolveTerrainFollowing = async (
  waypoints: Waypoint[],
  home: WaypointCoordinates,
  sampleGround: GroundSampler,
  context: TerrainProfileContext,
  toleranceM: number,
  vehicleClasses: TerrainVehicleClass[] = ['air']
): Promise<ResolvedTerrainMission> => {
  const relative = waypoints.some(
    (waypoint) => waypoint.altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_TERRAIN
  )
  if (!relative || !vehicleClasses.includes(context.vehicleClass)) {
    return { waypoints, addedWaypoints: 0, unresolvedWaypoints: 0 }
  }
  checkTerrainFollowingOnce()
  const surface = (groundM: number): number =>
    context.vehicleClass === 'air' ? surfaceHeight(groundM, context.waterLevelM) : groundM
  const ceilingM = context.vehicleClass === 'underwater' ? context.waterLevelM : Infinity

  const points: ProfilePoint[] = [
    {
      coordinates: home,
      altitude: 0,
      altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME,
      waypointIndex: null,
    },
    ...waypoints.map((waypoint, waypointIndex) => ({ ...waypoint, waypointIndex })),
  ]
  const groundAtPoints = await sampleGround(points.map((point) => point.coordinates))
  const amsl = pointAltitudesAmsl(points, groundAtPoints, context)

  const resolved: Waypoint[] = []
  let addedWaypoints = 0
  let unresolvedWaypoints = 0
  for (const [index, waypoint] of waypoints.entries()) {
    const startAmsl = amsl[index]
    const startGround = groundAtPoints[index]
    const endAmsl = amsl[index + 1]
    if (waypoint.altitudeReferenceType !== AltitudeReferenceType.RELATIVE_TO_TERRAIN) {
      resolved.push(waypoint)
      continue
    }
    const stations = densifyPath([points[index].coordinates, waypoint.coordinates], RESOLVE_SPACING_M)
    const ground = await sampleGround(stations.map((station) => station.coordinates))
    const wanted =
      startAmsl === undefined || startGround === null || endAmsl === undefined
        ? null
        : wantedAlongLeg(stations, ground, startAmsl - surface(startGround), waypoint.altitude, surface, ceilingM)
    if (!wanted) {
      unresolvedWaypoints += 1
      resolved.push(waypoint)
      continue
    }
    const kept = simplifyAbove(
      stations.map((station) => station.distanceM),
      wanted,
      toleranceM
    )
    kept.slice(1, -1).forEach((stationIndex) => {
      resolved.push({
        id: uuid(),
        coordinates: stations[stationIndex].coordinates,
        altitude: Math.ceil(wanted[stationIndex]),
        altitudeReferenceType: AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL,
        commands: navCommandsLike(waypoint),
      })
    })
    addedWaypoints += Math.max(0, kept.length - 2)
    resolved.push({
      ...waypoint,
      altitude: Math.ceil(wanted[wanted.length - 1]),
      altitudeReferenceType: AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL,
    })
  }
  return { waypoints: resolved, addedWaypoints, unresolvedWaypoints }
}

/**
 * Whether a command is a region of interest left at zero altitude, the kind {@link aimRoiAtGround} aims.
 * @param {MissionCommand} command Mission command.
 * @returns {boolean} True for such a region of interest.
 */
export const isGroundlessRoiCommand = (command: MissionCommand): command is MavlinkNonNavCommand =>
  command.type === MissionCommandType.MAVLINK_NON_NAV_COMMAND &&
  (command.command === MavCmd.MAV_CMD_DO_SET_ROI_LOCATION || command.command === MavCmd.MAV_CMD_DO_SET_ROI) &&
  command.z === 0 &&
  (command.x !== 0 || command.y !== 0)

/**
 * Aims region-of-interest commands left at zero altitude at the ground they point to, in the frame
 * of the waypoint carrying them, so a camera points at the target instead of at sea level.
 * @param {Waypoint[]} waypoints Mission waypoints, home excluded.
 * @param {number | null} homeAmslM Home altitude above sea level, for home-relative waypoints.
 * @param {GroundSampler} sampleGround Ground sampler.
 * @param {number} waterLevelM Water surface height.
 * @returns {Promise<number>} How many commands were aimed.
 */
export const aimRoiAtGround = async (
  waypoints: Waypoint[],
  homeAmslM: number | null,
  sampleGround: GroundSampler,
  waterLevelM: number
): Promise<number> => {
  const targets = waypoints.flatMap((waypoint) =>
    waypoint.commands.filter(isGroundlessRoiCommand).map((command) => ({ waypoint, command }))
  )
  if (targets.length === 0) return 0
  const ground = await sampleGround(
    targets.map(({ command }): WaypointCoordinates => [command.x / 1e7, command.y / 1e7])
  )
  let aimed = 0
  targets.forEach(({ waypoint, command }, index) => {
    const height = ground[index]
    if (height === null) return
    const surface = surfaceHeight(height, waterLevelM)
    if (waypoint.altitudeReferenceType === AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL) {
      command.z = Math.round(surface)
    } else if (waypoint.altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_HOME && homeAmslM !== null) {
      command.z = Math.round(surface - homeAmslM)
    } else return
    aimed += 1
  })
  return aimed
}

/**
 * Finds stretches where holding the planned path takes more climb or descent than the vehicle has.
 * @param {TerrainProfileSample[]} samples Profile stations.
 * @param {ClimbPerformance} performance What the vehicle can do.
 * @returns {ClimbFinding[]} One finding per stretch.
 */
export const climbFindings = (samples: TerrainProfileSample[], performance: ClimbPerformance): ClimbFinding[] => {
  const findings: ClimbFinding[] = []
  let open: ClimbFinding | null = null
  let ahead = 0
  for (let index = 0; index < samples.length; index++) {
    const from = samples[index]
    ahead = Math.max(ahead, index + 1)
    while (ahead < samples.length - 1 && samples[ahead].distanceM - from.distanceM < GRADE_WINDOW_M) ahead++
    const to = samples[ahead]
    const grade = gradeKind(from, to, performance)
    if (open && (grade?.kind !== open.kind || from.legIndex !== open.legIndex)) open = null
    if (!grade) continue
    if (!open) {
      open = { ...grade, legIndex: from.legIndex, fromM: from.distanceM, toM: to.distanceM }
      findings.push(open)
      continue
    }
    open.toM = to.distanceM
    open.gradePercent = Math.max(open.gradePercent, grade.gradePercent)
    open.slowedSpeedMs = Math.min(open.slowedSpeedMs, grade.slowedSpeedMs)
  }
  return findings
}

const gradeKind = (
  from: TerrainProfileSample,
  to: TerrainProfileSample | undefined,
  { cruiseSpeedMs, climbRateMs, sinkRateMs, slowsToClimb }: ClimbPerformance
): Pick<ClimbFinding, 'kind' | 'gradePercent' | 'slowedSpeedMs'> | null => {
  if (!to || from.pathAmslM === null || to.pathAmslM === null || to.distanceM <= from.distanceM) return null
  const grade = (to.pathAmslM - from.pathAmslM) / (to.distanceM - from.distanceM)
  const limit = grade > 0 ? climbRateMs : sinkRateMs
  if (Math.abs(grade) * cruiseSpeedMs <= limit) return null
  const gradePercent = Math.round(Math.abs(grade) * 100)
  const slowedSpeedMs = limit / Math.abs(grade)
  if (slowsToClimb) return { kind: 'slows-to-climb', gradePercent, slowedSpeedMs }
  return { kind: grade > 0 ? 'climb-limit' : 'descent-limit', gradePercent, slowedSpeedMs }
}

let selfChecked = false

/**
 * Development self-check of the vertical simplification, run once where bootstrap installed `assert`.
 */
export const checkTerrainFollowingOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const distances = [0, 25, 50, 75, 100]
  assert(simplifyAbove(distances, [10, 10, 10, 10, 10], 1).length === 2, 'A flat path keeps only its ends')
  const ridge = [10, 20, 40, 20, 10]
  const kept = simplifyAbove(distances, ridge, 1)
  assert(kept.includes(2), 'The ridge top must be kept so no line passes under it')
  const lines = kept.slice(1).map((end, at) => [kept[at], end])
  const dips = lines.some(([start, end]) =>
    ridge.slice(start, end + 1).some((wanted, offset) => {
      const fraction = offset / (end - start)
      return ridge[start] + (ridge[end] - ridge[start]) * fraction < wanted - 1e-9
    })
  )
  assert(!dips, 'No simplified line may pass below the wanted altitude')
}
