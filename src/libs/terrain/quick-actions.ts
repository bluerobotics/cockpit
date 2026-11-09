import { v4 as uuid } from 'uuid'

import { MavCmd } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import {
  type Survey,
  type Waypoint,
  type WaypointCoordinates,
  AltitudeReferenceType,
  isNavWaypointCommand,
  MissionCommandType,
} from '@/types/mission'

import {
  type ProfilePoint,
  type TerrainProfileContext,
  type TerrainProfileSample,
  legLengthM,
  pointAltitudesAmsl,
  surfaceHeight,
} from './mission-profile'
import { type GroundSampler, type ResolvedTerrainMission, resolveTerrainFollowing } from './terrain-following'

/**
 * Waypoints a quick action rewrote, and how many it touched.
 */
export interface QuickActionResult {
  /**
   * The mission waypoints after the action.
   */
  waypoints: Waypoint[]
  /**
   * Waypoints moved, added or changed.
   */
  changed: number
}

/**
 * A stretch of the path where a profile value crosses a limit.
 */
export interface ProfileStretch {
  /**
   * Leg it lies on.
   */
  legIndex: number
  /**
   * Start, meters along the path.
   */
  fromM: number
  /**
   * End, meters along the path.
   */
  toM: number
  /**
   * Worst value over the stretch.
   */
  worst: number
}

// Within this distance of home, a first waypoint is taken as the climb over home already added.
const OVER_HOME_M = 1
// Grades are read over this run, so a single noisy cell does not pass for a cliff.
const SLOPE_WINDOW_M = 30

const roundTenth = (value: number): number => Math.round(value * 10) / 10

const navWaypoint = (coordinates: WaypointCoordinates, altitude: number, holdS = 0): Waypoint => ({
  id: uuid(),
  coordinates,
  altitude,
  altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME,
  commands: [
    {
      type: MissionCommandType.MAVLINK_NAV_COMMAND,
      command: MavCmd.MAV_CMD_NAV_WAYPOINT,
      param1: holdS,
      param2: 5,
      param3: 0,
      param4: 999,
    },
  ],
})

const homePoint = (home: WaypointCoordinates): ProfilePoint => ({
  coordinates: home,
  altitude: 0,
  altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME,
  waypointIndex: null,
})

// What a terrain-relative height is measured from: the surface an aircraft keeps clear of, or the seabed.
const reliefOf = (groundM: number, context: TerrainProfileContext): number =>
  context.vehicleClass === 'air' ? surfaceHeight(groundM, context.waterLevelM) : groundM

/**
 * The heights of a mission's waypoints, read against the terrain model.
 */
interface WaypointHeights {
  /**
   * Height of each waypoint above sea level, undefined where its frame cannot be resolved.
   */
  amslM: (number | undefined)[]
  /**
   * Ground height under each waypoint, null where the model has no data.
   */
  groundM: (number | null)[]
  /**
   * Height of home above sea level, undefined when it cannot be resolved.
   */
  homeAmslM: number | undefined
}

/**
 * Heights the waypoints sit at above sea level, with the ground and home they were read against.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {WaypointCoordinates} home Home position.
 * @param {GroundSampler} sampleGround Ground sampler.
 * @param {TerrainProfileContext} context Vehicle and water level.
 * @returns {Promise<WaypointHeights>} One altitude and one ground height per waypoint, home excluded.
 */
const waypointHeights = async (
  waypoints: Waypoint[],
  home: WaypointCoordinates,
  sampleGround: GroundSampler,
  context: TerrainProfileContext
): Promise<WaypointHeights> => {
  const points = [homePoint(home), ...waypoints.map((waypoint, waypointIndex) => ({ ...waypoint, waypointIndex }))]
  const ground = await sampleGround(points.map(({ coordinates }) => coordinates))
  const amsl = pointAltitudesAmsl(points, ground, context)
  return { amslM: amsl.slice(1), groundM: ground.slice(1), homeAmslM: amsl[0] }
}

const inOwnFrame = (
  waypoint: Waypoint,
  amslM: number,
  homeAmslM: number | undefined,
  reliefM: number | null
): number | null => {
  switch (waypoint.altitudeReferenceType) {
    case AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL:
      return amslM
    case AltitudeReferenceType.RELATIVE_TO_HOME:
      return homeAmslM === undefined ? null : amslM - homeAmslM
    case AltitudeReferenceType.RELATIVE_TO_TERRAIN:
      return reliefM === null ? null : amslM - reliefM
  }
}

/**
 * Puts every waypoint at one height relative to home: level flight for an aircraft, a constant depth (negative) for
 * a submarine.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {number} altitudeM Height above home, negative below it.
 * @returns {Waypoint[]} The leveled waypoints.
 */
export const levelWaypoints = (waypoints: Waypoint[], altitudeM: number): Waypoint[] =>
  waypoints.map((waypoint) => ({
    ...waypoint,
    altitude: altitudeM,
    altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME,
  }))

/**
 * Moves every waypoint up or down, each in its own altitude reference.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {number} changeM Meters up, negative for down.
 * @returns {Waypoint[]} The shifted waypoints.
 */
export const shiftWaypoints = (waypoints: Waypoint[], changeM: number): Waypoint[] =>
  waypoints.map((waypoint) => ({ ...waypoint, altitude: roundTenth(waypoint.altitude + changeM) }))

/**
 * Holds one height over the ground, or over the seabed for a submarine, adding waypoints wherever the relief changes
 * enough that a straight line would drift from it by more than the precision.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {WaypointCoordinates} home Home position.
 * @param {number} heightM Height to hold over the ground or seabed.
 * @param {number} precisionM How far above that height a line between waypoints may pass.
 * @param {GroundSampler} sampleGround Conservative ground sampler.
 * @param {TerrainProfileContext} context Vehicle and water level.
 * @returns {Promise<ResolvedTerrainMission>} The waypoints, fixed above sea level, and how many were added.
 */
export const contourWaypoints = (
  waypoints: Waypoint[],
  home: WaypointCoordinates,
  heightM: number,
  precisionM: number,
  sampleGround: GroundSampler,
  context: TerrainProfileContext
): Promise<ResolvedTerrainMission> =>
  resolveTerrainFollowing(
    waypoints.map((waypoint) => ({
      ...waypoint,
      altitude: heightM,
      altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_TERRAIN,
    })),
    home,
    sampleGround,
    context,
    precisionM,
    ['air', 'underwater']
  )

/**
 * Starts the mission with a climb straight above home, or sets the height of that climb when it is already there.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {WaypointCoordinates} home Home position.
 * @param {number} altitudeM Height above home to climb to.
 * @returns {Waypoint[]} The waypoints, the climb first.
 */
export const climbOverHome = (waypoints: Waypoint[], home: WaypointCoordinates, altitudeM: number): Waypoint[] => {
  const [first, ...rest] = waypoints
  if (first && legLengthM(first.coordinates, home) < OVER_HOME_M) {
    return [{ ...first, altitude: altitudeM, altitudeReferenceType: AltitudeReferenceType.RELATIVE_TO_HOME }, ...rest]
  }
  return [navWaypoint(home, altitudeM), ...waypoints]
}

/**
 * Lowers the waypoints that sit higher than a ceiling over the ground under them.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {WaypointCoordinates} home Home position.
 * @param {number} ceilingM Highest height over the ground.
 * @param {GroundSampler} sampleGround Ground sampler.
 * @param {TerrainProfileContext} context Vehicle and water level.
 * @returns {Promise<QuickActionResult>} The waypoints and how many were lowered.
 */
export const capHeightOverGround = async (
  waypoints: Waypoint[],
  home: WaypointCoordinates,
  ceilingM: number,
  sampleGround: GroundSampler,
  context: TerrainProfileContext
): Promise<QuickActionResult> => {
  const { amslM, groundM, homeAmslM } = await waypointHeights(waypoints, home, sampleGround, context)
  let changed = 0
  const capped = waypoints.map((waypoint, index) => {
    const amsl = amslM[index]
    const ground = groundM[index]
    if (amsl === undefined || ground === null) return waypoint
    const relief = reliefOf(ground, context)
    if (amsl - relief <= ceilingM) return waypoint
    const altitude = inOwnFrame(waypoint, relief + ceilingM, homeAmslM, relief)
    if (altitude === null) return waypoint
    changed += 1
    return { ...waypoint, altitude: Math.floor(altitude) }
  })
  return { waypoints: capped, changed }
}

/**
 * Brings each waypoint within a depth limit and a clearance over the seabed, never above the water surface.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {WaypointCoordinates} home Home position.
 * @param {number} deepestM Greatest depth below the water surface.
 * @param {number} seabedClearanceM Least height over the seabed.
 * @param {GroundSampler} sampleGround Conservative seabed sampler.
 * @param {TerrainProfileContext} context Vehicle and water level.
 * @returns {Promise<QuickActionResult>} The waypoints and how many were moved.
 */
export const keepWithinDepths = async (
  waypoints: Waypoint[],
  home: WaypointCoordinates,
  deepestM: number,
  seabedClearanceM: number,
  sampleGround: GroundSampler,
  context: TerrainProfileContext
): Promise<QuickActionResult> => {
  const { amslM, groundM, homeAmslM } = await waypointHeights(waypoints, home, sampleGround, context)
  const surfaceM = context.waterLevelM
  let changed = 0
  const kept = waypoints.map((waypoint, index) => {
    const amsl = amslM[index]
    const seabed = groundM[index]
    if (amsl === undefined) return waypoint
    const floorM = Math.max(surfaceM - deepestM, seabed === null ? -Infinity : seabed + seabedClearanceM)
    const target = Math.min(surfaceM, Math.max(amsl, floorM))
    if (target === amsl) return waypoint
    const altitude = inOwnFrame(waypoint, target, homeAmslM, seabed)
    if (altitude === null) return waypoint
    changed += 1
    return { ...waypoint, altitude: roundTenth(altitude) }
  })
  return { waypoints: kept, changed }
}

/**
 * Adds waypoints along each leg that alternate between a deep and a shallow depth, for sampling the water column,
 * stopping short of the seabed. Legs inside a survey are left alone.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {WaypointCoordinates} home Home position.
 * @param {number} shallowestM Depth of the shallow turns.
 * @param {number} deepestM Depth of the deep turns.
 * @param {number} spacingM Distance between turns.
 * @param {number} seabedClearanceM Least height over the seabed for the deep turns.
 * @param {Set<string>} surveyWaypointIds Ids of the waypoints that belong to a survey.
 * @param {GroundSampler} sampleGround Conservative seabed sampler.
 * @param {TerrainProfileContext} context Vehicle and water level.
 * @returns {Promise<QuickActionResult>} The waypoints and how many turns were added.
 */
export const profileWaterColumn = async (
  waypoints: Waypoint[],
  home: WaypointCoordinates,
  shallowestM: number,
  deepestM: number,
  spacingM: number,
  seabedClearanceM: number,
  surveyWaypointIds: Set<string>,
  sampleGround: GroundSampler,
  context: TerrainProfileContext
): Promise<QuickActionResult> => {
  const corners = [home, ...waypoints.map(({ coordinates }) => coordinates)]
  const turns = waypoints.map((waypoint, index) => {
    const previous = waypoints[index - 1]
    if (previous && surveyWaypointIds.has(previous.id) && surveyWaypointIds.has(waypoint.id)) return []
    const count = Math.floor(legLengthM(corners[index], corners[index + 1]) / spacingM)
    const [fromLat, fromLng] = corners[index]
    const [toLat, toLng] = corners[index + 1]
    return Array.from({ length: count }, (_, turn): WaypointCoordinates => {
      const fraction = (turn + 1) / (count + 1)
      return [fromLat + (toLat - fromLat) * fraction, fromLng + (toLng - fromLng) * fraction]
    })
  })
  const flat = turns.flat()
  const [homeGround, ...seabeds] = await sampleGround([home, ...flat])
  const homeAmslM = homeGround === null ? context.waterLevelM : surfaceHeight(homeGround, context.waterLevelM)
  let at = 0
  const profiled = waypoints.flatMap((waypoint, index) => [
    ...turns[index].map((coordinates, turn) => {
      const seabed = seabeds[at++]
      const wantedM = context.waterLevelM - (turn % 2 === 0 ? deepestM : shallowestM)
      const floorM = seabed === null ? wantedM : seabed + seabedClearanceM
      const amsl = Math.min(context.waterLevelM, Math.max(wantedM, floorM))
      return navWaypoint(coordinates, roundTenth(amsl - homeAmslM))
    }),
    waypoint,
  ])
  return { waypoints: profiled, changed: flat.length }
}

/**
 * Adds a stop at the surface every so far along the path, where an underwater vehicle can take a position fix.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {WaypointCoordinates} home Home position.
 * @param {number} everyM Distance between surfacings, along the path.
 * @param {number} holdS Seconds to stay at the surface.
 * @returns {QuickActionResult} The waypoints and how many surfacings were added.
 */
export const surfaceAlongPath = (
  waypoints: Waypoint[],
  home: WaypointCoordinates,
  everyM: number,
  holdS: number
): QuickActionResult => {
  const corners = [home, ...waypoints.map(({ coordinates }) => coordinates)]
  let changed = 0
  let travelledM = 0
  let nextM = everyM
  const surfaced = waypoints.flatMap((waypoint, index) => {
    const [fromLat, fromLng] = corners[index]
    const [toLat, toLng] = corners[index + 1]
    const lengthM = legLengthM(corners[index], corners[index + 1])
    const stops: Waypoint[] = []
    for (; nextM < travelledM + lengthM; nextM += everyM) {
      const fraction = (nextM - travelledM) / lengthM
      stops.push(
        navWaypoint([fromLat + (toLat - fromLat) * fraction, fromLng + (toLng - fromLng) * fraction], 0, holdS)
      )
    }
    travelledM += lengthM
    changed += stops.length
    return [...stops, waypoint]
  })
  return { waypoints: surfaced, changed }
}

/**
 * Makes the vehicle wait at every waypoint outside a survey.
 * @param {Waypoint[]} waypoints Mission waypoints.
 * @param {number} holdS Seconds to wait, 0 to not wait.
 * @param {Set<string>} surveyWaypointIds Ids of the waypoints that belong to a survey.
 * @returns {QuickActionResult} The waypoints and how many now wait.
 */
export const holdAtWaypoints = (
  waypoints: Waypoint[],
  holdS: number,
  surveyWaypointIds: Set<string>
): QuickActionResult => {
  let changed = 0
  const held = waypoints.map((waypoint) => {
    if (surveyWaypointIds.has(waypoint.id)) return waypoint
    changed += 1
    return {
      ...waypoint,
      commands: waypoint.commands.map((command) =>
        isNavWaypointCommand(command) ? { ...command, param1: holdS } : command
      ),
    }
  })
  return { waypoints: held, changed }
}

/**
 * Keeps every survey on the run of waypoints it spans, so one regenerated later replaces exactly that run; waypoints
 * added inside it join it, and a reversed survey is listed in its new order.
 * @param {Survey[]} surveys The mission surveys.
 * @param {Waypoint[]} waypoints The mission waypoints after an action.
 * @returns {Survey[]} The surveys, linked to the new waypoints.
 */
export const relinkSurveys = (surveys: Survey[], waypoints: Waypoint[]): Survey[] => {
  checkQuickActionsOnce()
  return surveys.map((survey) => {
    const ids = new Set(survey.waypoints.map(({ id }) => id))
    const indices = waypoints.flatMap((waypoint, index) => (ids.has(waypoint.id) ? [index] : []))
    if (indices.length === 0) return survey
    return { ...survey, waypoints: waypoints.slice(indices[0], indices[indices.length - 1] + 1) }
  })
}

const stretchesWhere = (
  samples: TerrainProfileSample[],
  values: (number | null)[],
  breaches: (value: number) => boolean,
  worse: (a: number, b: number) => number
): ProfileStretch[] => {
  const stretches: ProfileStretch[] = []
  let open = null as ProfileStretch | null
  for (const [index, sample] of samples.entries()) {
    const value = values[index]
    if (value === null || !breaches(value)) {
      open = null
    } else if (open?.legIndex === sample.legIndex) {
      open.toM = sample.distanceM
      open.worst = worse(open.worst, value)
    } else {
      open = { legIndex: sample.legIndex, fromM: sample.distanceM, toM: sample.distanceM, worst: value }
      stretches.push(open)
    }
  }
  return stretches
}

/**
 * Stretches where a vessel keeps less water under its keel than a minimum.
 * @param {TerrainProfileSample[]} samples Profile stations of a vessel's mission.
 * @param {number} minimumM Water wanted under the keel.
 * @returns {ProfileStretch[]} The stretches, each with its least water under the keel.
 */
export const shallowStretches = (samples: TerrainProfileSample[], minimumM: number): ProfileStretch[] =>
  stretchesWhere(
    samples,
    samples.map(({ clearanceM }) => clearanceM),
    (value) => value < minimumM,
    Math.min
  )

/**
 * Stretches where an aircraft flies higher over the ground than a ceiling.
 * @param {TerrainProfileSample[]} samples Profile stations of an aircraft's mission.
 * @param {number} ceilingM Highest height over the ground.
 * @returns {ProfileStretch[]} The stretches, each with its greatest height over the ground.
 */
export const highStretches = (samples: TerrainProfileSample[], ceilingM: number): ProfileStretch[] =>
  stretchesWhere(
    samples,
    samples.map(({ clearanceM }) => clearanceM),
    (value) => value > ceilingM,
    Math.max
  )

/**
 * Stretches where a ground vehicle's path is steeper than a grade.
 * @param {TerrainProfileSample[]} samples Profile stations of a ground vehicle's mission.
 * @param {number} maxGradePercent Steepest grade wanted, in percent.
 * @returns {ProfileStretch[]} The stretches, each with its steepest grade in percent.
 */
export const steepStretches = (samples: TerrainProfileSample[], maxGradePercent: number): ProfileStretch[] => {
  let ahead = 0
  const grades = samples.map((from, index) => {
    ahead = Math.max(ahead, index + 1)
    while (ahead < samples.length && samples[ahead].distanceM - from.distanceM < SLOPE_WINDOW_M) ahead++
    const to = samples[ahead]
    if (!to || from.groundM === null || to.groundM === null) return null
    return (Math.abs(to.groundM - from.groundM) / (to.distanceM - from.distanceM)) * 100
  })
  return stretchesWhere(samples, grades, (value) => value > maxGradePercent, Math.max)
}

let selfChecked = false

/**
 * Development self-check of the quick actions that reorder or regroup waypoints, run once where bootstrap installed
 * `assert`.
 */
export const checkQuickActionsOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const home: WaypointCoordinates = [0, 0]
  const route = [navWaypoint([0, 0.001], 10), navWaypoint([0, 0.002], 10), navWaypoint([0, 0.003], 10)]
  const survey = { waypoints: route.slice(1) } as Survey
  const climbed = climbOverHome(climbOverHome(route, home, 30), home, 40)
  assert(climbed.length === 4 && climbed[0].altitude === 40, 'A second climb over home updates the first one')
  const inserted = [route[0], route[1], navWaypoint([0, 0.0025], 10), route[2]]
  assert(relinkSurveys([survey], inserted)[0].waypoints.length === 3, 'A waypoint added inside a survey joins it')
  const reversed = relinkSurveys([survey], [...route].reverse())[0].waypoints
  assert(reversed[0].id === route[2].id, 'A reversed survey lists its waypoints in the new order')
  const surfaced = surfaceAlongPath(route, home, 150, 30)
  assert(surfaced.changed === 2, 'A 334 m path surfaces at 150 m and 300 m')
}
