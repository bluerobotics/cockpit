import { msgid, ngettext, t } from 'ttag'

import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Waypoint, type WaypointCoordinates, AltitudeReferenceType } from '@/types/mission'

import { sampleTerrain } from './elevation-service'
import {
  type PathStation,
  type ProfilePoint,
  type TerrainFinding,
  type TerrainFindingKind,
  type TerrainProfile,
  type TerrainProfileContext,
  buildTerrainProfile,
  densifyPath,
  legLabel,
  legLengthM,
  profileSpacingM,
  surfaceHeight,
} from './mission-profile'
import { type ReturnBehavior, type ReturnPathFinding, returnPathFindings, returnPathPlan } from './return-path'
import {
  type ClimbFinding,
  type ClimbPerformance,
  type GroundSampler,
  aimRoiAtGround,
  climbFindings,
  isGroundlessRoiCommand,
  resolveTerrainFollowing,
} from './terrain-following'

/**
 * Everything checked about a mission's terrain.
 */
export interface MissionTerrainAnalysis {
  /**
   * Path points the profile was built from, home first when known.
   */
  points: ProfilePoint[]
  /**
   * The terrain profile and its findings.
   */
  profile: TerrainProfile
  /**
   * Stretches from which an automatic return would come too close to the terrain.
   */
  returnFindings: ReturnPathFinding[]
  /**
   * Stretches that need more climb or descent than the vehicle has.
   */
  climbFindings: ClimbFinding[]
}

/**
 * How serious a finding is, for its color and whether the upload prompt lists it.
 */
export type TerrainFindingSeverity = 'danger' | 'warning' | 'info'

/**
 * Vehicle parameters, by name, that the terrain checks read.
 */
export type VehicleTerrainParameters = Partial<Record<(typeof TERRAIN_PERFORMANCE_PARAMETERS)[number], number>>

/**
 * ArduPilot parameters that describe how a vehicle climbs and returns home.
 */
export const TERRAIN_PERFORMANCE_PARAMETERS = [
  'WPNAV_SPEED',
  'WPNAV_SPEED_UP',
  'WPNAV_SPEED_DN',
  'RTL_ALT',
  'RTL_ALT_TYPE',
  'AIRSPEED_CRUISE',
  'TECS_CLMB_MAX',
  'TECS_SINK_MAX',
  'ALT_HOLD_RTL',
] as const

const MULTIROTOR_TYPES = new Set<MavType>([
  MavType.MAV_TYPE_QUADROTOR,
  MavType.MAV_TYPE_COAXIAL,
  MavType.MAV_TYPE_HELICOPTER,
  MavType.MAV_TYPE_HEXAROTOR,
  MavType.MAV_TYPE_OCTOROTOR,
  MavType.MAV_TYPE_TRICOPTER,
  MavType.MAV_TYPE_DODECAROTOR,
])

const SEVERITY: Record<TerrainFindingKind, TerrainFindingSeverity> = {
  'collision': 'danger',
  'aground': 'danger',
  'crosses-land': 'danger',
  'above-surface': 'danger',
  'low-clearance': 'warning',
  'low-under-keel': 'warning',
  'possible-shallows': 'warning',
  'unmapped-shallows': 'warning',
  'reaches-coastline': 'warning',
  'uncertain-clearance': 'info',
  'unknown-ground': 'info',
}

/**
 * Path points of a mission, starting from home when it is known.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {WaypointCoordinates | undefined} home Home position.
 * @returns {ProfilePoint[]} The points, in flight order.
 */
export const missionProfilePoints = (waypoints: Waypoint[], home: WaypointCoordinates | undefined): ProfilePoint[] => [
  ...(home
    ? [
        {
          coordinates: home,
          altitude: 0,
          altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME,
          waypointIndex: null,
        },
      ]
    : []),
  ...waypoints.map((waypoint, waypointIndex) => ({
    coordinates: waypoint.coordinates,
    altitude: waypoint.altitude,
    altitudeReferenceType: waypoint.altitudeReferenceType,
    waypointIndex,
  })),
]

/**
 * Samples the terrain along a mission and checks it, its automatic returns and its climbs.
 * @param {ProfilePoint[]} points Path points, from {@link missionProfilePoints}.
 * @param {TerrainProfileContext} context Vehicle, water level and thresholds.
 * @param {ReturnBehavior | null} behavior How the vehicle returns home, null to skip that check.
 * @param {ClimbPerformance | null} performance How fast it climbs, null to skip that check.
 * @returns {Promise<MissionTerrainAnalysis | null>} The analysis, or null for a path under two points.
 */
export const analyzeMissionTerrain = async (
  points: ProfilePoint[],
  context: TerrainProfileContext,
  behavior: ReturnBehavior | null,
  performance: ClimbPerformance | null
): Promise<MissionTerrainAnalysis | null> => {
  if (points.length < 2) return null
  const corners = points.map((point) => point.coordinates)
  const lengthM = corners.slice(1).reduce((sum, corner, index) => sum + legLengthM(corners[index], corner), 0)
  const stations = densifyPath(corners, profileSpacingM(lengthM))
  const coordinates = stations.map((station) => station.coordinates)
  const seabedOnly = context.vehicleClass === 'surface' || context.vehicleClass === 'underwater'
  const [groundM, groundHighM, groundAtPointsM] = await Promise.all([
    sampleTerrain(coordinates, { mode: 'bilinear', seabedOnly }),
    sampleTerrain(coordinates, { mode: 'highest', seabedOnly }),
    sampleTerrain(corners, { mode: 'bilinear', seabedOnly }),
  ])
  const profile = buildTerrainProfile(points, stations, groundM, groundHighM, groundAtPointsM, context)

  let returns: ReturnPathFinding[] = []
  const home = points[0].waypointIndex === null ? points[0] : undefined
  const homeAmslM = profile.pointAmslM[0]
  if (behavior && home && homeAmslM !== undefined) {
    const plan = returnPathPlan(profile.samples, home.coordinates)
    const returnGround = await Promise.all(
      plan.returns.map((path) =>
        sampleTerrain(
          path.map((station) => station.coordinates),
          { mode: 'highest', seabedOnly }
        )
      )
    )
    returns = returnPathFindings(plan, returnGround, homeAmslM, behavior, context)
  }
  const climbs = performance && context.vehicleClass === 'air' ? climbFindings(profile.samples, performance) : []
  return { points, profile, returnFindings: returns, climbFindings: climbs }
}

/**
 * How serious a terrain finding is.
 * @param {TerrainFindingKind} kind Finding kind.
 * @returns {TerrainFindingSeverity} Its severity.
 */
export const terrainFindingSeverity = (kind: TerrainFindingKind): TerrainFindingSeverity => SEVERITY[kind]

/**
 * Rank of an unsafe automatic return, between the path's own findings and everything else.
 */
export const RETURN_FINDING_RANK = 2

/**
 * Rank of the findings that do not put the vehicle into the terrain: uncertain clearance, unknown
 * ground, climbs, link and sight.
 */
export const OTHER_FINDING_RANK = 3

const SEVERITY_RANK: Record<TerrainFindingSeverity, number> = { danger: 0, warning: 1, info: OTHER_FINDING_RANK }

/**
 * Where a terrain finding is read, most urgent first: into the terrain, then under the safety margin,
 * then {@link RETURN_FINDING_RANK} and {@link OTHER_FINDING_RANK}.
 * @param {TerrainFindingKind} kind Finding kind.
 * @returns {number} Its rank, 0 the most urgent.
 */
export const terrainFindingRank = (kind: TerrainFindingKind): number => SEVERITY_RANK[SEVERITY[kind]]

const meters = (value: number | null, marine: boolean): string => {
  if (value === null) return '?'
  const text = Math.abs(value).toFixed(marine ? 1 : 0)
  const smallestM = marine ? '0.1' : '1'
  return Number(text) === 0 ? t`under ${smallestM} m` : `${text} m`
}

/**
 * Operator-facing sentence for a terrain finding.
 * @param {TerrainFinding} finding The finding.
 * @param {ProfilePoint[]} points Path points, to name the leg.
 * @param {TerrainProfileContext} context Thresholds quoted in the sentence.
 * @returns {string} The sentence.
 */
export const terrainFindingMessage = (
  finding: TerrainFinding,
  points: ProfilePoint[],
  context: TerrainProfileContext
): string => {
  const leg = legLabel(points, finding.legIndex)
  const marine = context.vehicleClass === 'surface' || context.vehicleClass === 'underwater'
  const worst = meters(finding.worstClearanceM, marine)
  const messages: Record<TerrainFindingKind, string> = {
    'collision': t`Goes ${worst} into the terrain from ${leg}.`,
    'low-clearance': t`Passes ${worst} over the terrain from ${leg}, under the ${context.minimumClearanceM} m minimum.`,
    'uncertain-clearance': t`Clears the terrain by ${worst} from ${leg}, within the terrain model's ${context.uncertaintyM} m error.`,
    'aground': t`Runs aground from ${leg}, with the bottom ${worst} above the keel.`,
    'low-under-keel': t`Keeps ${worst} under the keel from ${leg}, under the ${context.minimumUnderKeelM} m minimum.`,
    'crosses-land': t`Crosses land from ${leg}.`,
    'possible-shallows': t`Possible shallow water from ${leg}: the map shows water where the terrain model reads land. Check a nautical chart.`,
    'unmapped-shallows': context.coastlineCoverage
      ? t`Possible shallow water from ${leg}. Check a nautical chart.`
      : t`Without a coastline map, the terrain data cannot tell whether the path from ${leg} is navigable. Load the coastline or check a nautical chart.`,
    'reaches-coastline': t`Reaches the coastline from ${leg}, onto land.`,
    'above-surface': t`Rises above the water surface from ${leg}.`,
    'unknown-ground': marine
      ? t`The depth is unknown along part of the path from ${leg}.`
      : t`The terrain is unknown along part of the path from ${leg}.`,
  }
  return messages[finding.kind]
}

/**
 * Operator-facing sentence for an unsafe automatic return.
 * @param {ReturnPathFinding} finding The finding.
 * @param {ProfilePoint[]} points Path points, to name the leg.
 * @param {TerrainProfileContext} context Vehicle class, for the units.
 * @returns {string} The sentence.
 */
export const returnFindingMessage = (
  finding: ReturnPathFinding,
  points: ProfilePoint[],
  context: TerrainProfileContext
): string => {
  const marine = context.vehicleClass === 'surface'
  const clearance = meters(finding.worstClearanceM, marine)
  const leg = legLabel(points, finding.legIndex)
  return finding.worstClearanceM < 0
    ? t`A return home started from ${leg} would pass ${clearance} into the terrain on the straight line home.`
    : t`A return home started from ${leg} would pass only ${clearance} over the terrain on the straight line home.`
}

/**
 * Operator-facing sentence for a climb the vehicle cannot make at cruise speed.
 * @param {ClimbFinding} finding The finding.
 * @param {ProfilePoint[]} points Path points, to name the leg.
 * @returns {string} The sentence.
 */
export const climbFindingMessage = (finding: ClimbFinding, points: ProfilePoint[]): string => {
  const leg = legLabel(points, finding.legIndex)
  if (finding.kind === 'slows-to-climb') {
    const speed = finding.slowedSpeedMs.toFixed(1)
    return t`The ${finding.gradePercent}% grade from ${leg} slows the vehicle to ${speed} m/s.`
  }
  return finding.kind === 'climb-limit'
    ? t`The ${finding.gradePercent}% climb from ${leg} is steeper than the vehicle can follow at cruise speed.`
    : t`The ${finding.gradePercent}% descent from ${leg} is steeper than the vehicle can follow at cruise speed.`
}

/**
 * How a vehicle climbs and returns home, for the terrain checks.
 */
export interface VehicleTerrainBehavior {
  /**
   * Climb performance, null when the vehicle does not climb.
   */
  performance: ClimbPerformance | null
  /**
   * Automatic return behavior, null when it is not known for the vehicle type.
   */
  behavior: ReturnBehavior | null
}

const multirotorBehavior = (
  parameters: VehicleTerrainParameters,
  cruiseSpeedMs: number | null
): VehicleTerrainBehavior => {
  const rtlAltitudeCm = parameters.RTL_ALT ?? 1500
  return {
    performance: {
      cruiseSpeedMs: cruiseSpeedMs ?? (parameters.WPNAV_SPEED ?? 1000) / 100,
      climbRateMs: (parameters.WPNAV_SPEED_UP ?? 250) / 100,
      sinkRateMs: (parameters.WPNAV_SPEED_DN ?? 150) / 100,
      slowsToClimb: true,
    },
    behavior: {
      returnAltitudeAboveHomeM: rtlAltitudeCm > 0 ? rtlAltitudeCm / 100 : null,
      climbGradient: Number.POSITIVE_INFINITY,
      followsTerrain: parameters.RTL_ALT_TYPE === 1,
    },
  }
}

const planeBehavior = (parameters: VehicleTerrainParameters, cruiseSpeedMs: number | null): VehicleTerrainBehavior => {
  const speed = cruiseSpeedMs ?? parameters.AIRSPEED_CRUISE ?? 15
  const climb = parameters.TECS_CLMB_MAX ?? 5
  const rtlAltitudeCm = parameters.ALT_HOLD_RTL ?? 10000
  return {
    performance: {
      cruiseSpeedMs: speed,
      climbRateMs: climb,
      sinkRateMs: parameters.TECS_SINK_MAX ?? 5,
      slowsToClimb: false,
    },
    behavior: {
      returnAltitudeAboveHomeM: rtlAltitudeCm >= 0 ? rtlAltitudeCm / 100 : null,
      climbGradient: climb / speed,
      followsTerrain: false,
    },
  }
}

/**
 * Climb performance and return behavior of a vehicle, from its parameters where it gave them and
 * ArduPilot's defaults otherwise.
 * @param {MavType | undefined} vehicleType Vehicle type.
 * @param {VehicleTerrainParameters} parameters Parameters read from the vehicle.
 * @param {number | null} cruiseSpeedMs Mission cruise speed, when the mission sets one.
 * @returns {VehicleTerrainBehavior} Both, null where they do not apply.
 */
export const vehicleTerrainBehavior = (
  vehicleType: MavType | undefined,
  parameters: VehicleTerrainParameters,
  cruiseSpeedMs: number | null
): VehicleTerrainBehavior => {
  if (vehicleType === MavType.MAV_TYPE_SURFACE_BOAT) {
    return { performance: null, behavior: { returnAltitudeAboveHomeM: null, climbGradient: 0, followsTerrain: false } }
  }
  if (vehicleType === undefined || MULTIROTOR_TYPES.has(vehicleType))
    return multirotorBehavior(parameters, cruiseSpeedMs)
  if (vehicleType === MavType.MAV_TYPE_FIXED_WING || vehicleType.startsWith('MAV_TYPE_VTOL')) {
    return planeBehavior(parameters, cruiseSpeedMs)
  }
  return { performance: null, behavior: null }
}

// A shoreline mission can raise a finding per run, which is a list nobody reads in a confirmation.
const MAX_UPLOAD_MESSAGES = 5

/**
 * The findings worth stopping an upload for, as sentences.
 * @param {MissionTerrainAnalysis} analysis The mission analysis.
 * @param {TerrainProfileContext} context Thresholds quoted in the sentences.
 * @returns {string[]} The sentences, empty when nothing needs the operator's attention.
 */
export const terrainUploadMessages = (analysis: MissionTerrainAnalysis, context: TerrainProfileContext): string[] => {
  const { points, profile, returnFindings: returns, climbFindings: climbs } = analysis
  const messages = [
    ...profile.findings
      .filter((finding) => terrainFindingSeverity(finding.kind) !== 'info')
      .sort((a, b) => terrainFindingRank(a.kind) - terrainFindingRank(b.kind))
      .map((finding) => terrainFindingMessage(finding, points, context)),
    ...returns.map((finding) => returnFindingMessage(finding, points, context)),
    ...climbs
      .filter((finding) => finding.kind !== 'slows-to-climb')
      .map((finding) => climbFindingMessage(finding, points)),
  ]
  const hidden = messages.length - MAX_UPLOAD_MESSAGES
  if (hidden <= 0) return messages
  const more = ngettext(
    msgid`And ${hidden} more, listed in the terrain panel.`,
    `And ${hidden} more, listed in the terrain panel.`,
    hidden
  )
  return [...messages.slice(0, MAX_UPLOAD_MESSAGES), more]
}

/**
 * What preparing a mission's terrain for upload changed.
 */
export interface PreparedTerrainUpload {
  /**
   * Waypoints to upload.
   */
  waypoints: Waypoint[]
  /**
   * Terrain-relative waypoints turned into sea-level ones.
   */
  resolvedWaypoints: number
  /**
   * Waypoints added to hold the height over the ground between them.
   */
  addedWaypoints: number
  /**
   * Terrain-relative waypoints left as they were, because the ground is unknown.
   */
  unresolvedWaypoints: number
  /**
   * Region-of-interest commands aimed at the ground.
   */
  aimedRois: number
}

/**
 * Options for {@link prepareTerrainUpload}.
 */
export interface PrepareTerrainUploadOptions {
  /**
   * Turn terrain-relative waypoints into sea-level ones.
   */
  resolveTerrain: boolean
  /**
   * Aim region-of-interest commands left at zero altitude at the ground.
   */
  aimRois: boolean
  /**
   * How far above the wanted height a resolved path may pass, in meters.
   */
  toleranceM: number
}

/**
 * Prepares a mission's terrain for upload. Changes the given waypoints' commands in place.
 * @param {Waypoint[]} waypoints Plain copies of the mission waypoints, home excluded.
 * @param {WaypointCoordinates | undefined} home Home position.
 * @param {TerrainProfileContext} context Vehicle and water level.
 * @param {PrepareTerrainUploadOptions} options What to prepare.
 * @returns {Promise<PreparedTerrainUpload>} The waypoints to upload and what changed.
 */
export const prepareTerrainUpload = async (
  waypoints: Waypoint[],
  home: WaypointCoordinates | undefined,
  context: TerrainProfileContext,
  options: PrepareTerrainUploadOptions
): Promise<PreparedTerrainUpload> => {
  const prepared: PreparedTerrainUpload = {
    waypoints,
    resolvedWaypoints: 0,
    addedWaypoints: 0,
    unresolvedWaypoints: 0,
    aimedRois: 0,
  }
  const sampleHighest: GroundSampler = (coordinates) => sampleTerrain(coordinates, { mode: 'highest' })
  const sampleGround: GroundSampler = (coordinates) => sampleTerrain(coordinates, { mode: 'bilinear' })
  if (options.resolveTerrain && home) {
    const relative = waypoints.filter((w) => w.altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_TERRAIN)
    const resolved = await resolveTerrainFollowing(waypoints, home, sampleHighest, context, options.toleranceM)
    prepared.waypoints = resolved.waypoints
    prepared.addedWaypoints = resolved.addedWaypoints
    prepared.unresolvedWaypoints = resolved.unresolvedWaypoints
    prepared.resolvedWaypoints = resolved.waypoints === waypoints ? 0 : relative.length - resolved.unresolvedWaypoints
  }
  if (options.aimRois && prepared.waypoints.some((waypoint) => waypoint.commands.some(isGroundlessRoiCommand))) {
    const [homeGround] = home ? await sampleGround([home]) : [null]
    const homeAmslM = homeGround === null ? null : surfaceHeight(homeGround, context.waterLevelM)
    prepared.aimedRois = await aimRoiAtGround(prepared.waypoints, homeAmslM, sampleGround, context.waterLevelM)
  }
  return prepared
}

/**
 * Positions of the profile between two distances, for drawing a stretch on the map.
 * @param {PathStation[]} samples Profile stations, in order.
 * @param {number} fromM Start of the stretch, meters from the start.
 * @param {number} toM End of the stretch.
 * @returns {WaypointCoordinates[]} The positions, at least one.
 */
export const profileStretch = (samples: PathStation[], fromM: number, toM: number): WaypointCoordinates[] => {
  const inside = samples.filter((sample) => sample.distanceM >= fromM && sample.distanceM <= toM)
  if (inside.length > 0) return inside.map((sample) => sample.coordinates)
  const nearest = samples.reduce((best, sample) =>
    Math.abs(sample.distanceM - fromM) < Math.abs(best.distanceM - fromM) ? sample : best
  )
  return [nearest.coordinates]
}
