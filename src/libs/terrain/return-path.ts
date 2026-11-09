import type { WaypointCoordinates } from '@/types/mission'

import {
  type PathStation,
  type TerrainProfileContext,
  type TerrainProfileSample,
  densifyPath,
  landBeyondCoastline,
  legLengthM,
  possibleShallowsReason,
  surfaceHeight,
} from './mission-profile'

/**
 * How the vehicle flies home when it returns on its own.
 */
export interface ReturnBehavior {
  /**
   * Altitude above home the vehicle returns at, at least; null to return at its current altitude.
   */
  returnAltitudeAboveHomeM: number | null
  /**
   * Fraction of the horizontal distance the vehicle can climb while heading home; Infinity for those
   * that climb in place before leaving (multirotors).
   */
  climbGradient: number
  /**
   * True when the return follows the terrain, which leaves nothing to check against it.
   */
  followsTerrain: boolean
}

/**
 * A stretch of the mission where returning home from there would meet the terrain.
 */
export interface ReturnPathFinding {
  /**
   * Leg of the mission the stretch lies on.
   */
  legIndex: number
  /**
   * Where along the mission the stretch begins, in meters.
   */
  fromM: number
  /**
   * Where along the mission it ends, in meters.
   */
  toM: number
  /**
   * Smallest clearance of any return from the stretch, in meters.
   */
  worstClearanceM: number
  /**
   * Where on the way home that smallest clearance is.
   */
  worstAt: WaypointCoordinates
}

/**
 * Where returns are tried from, and the ground on the way home from each.
 */
export interface ReturnPathPlan {
  /**
   * Mission stations a return is tried from.
   */
  triggers: TerrainProfileSample[]
  /**
   * Stations of each return, from its trigger to home.
   */
  returns: PathStation[][]
}

// Enough triggers that no ridge between two of them goes untested on a typical mission.
// ponytail: every live check samples up to this many paths home; sampling only the legs that changed is the upgrade.
const MAX_TRIGGERS = 60

/**
 * Picks the mission stations to try a return from, with the path home from each.
 * @param {TerrainProfileSample[]} samples Mission profile stations.
 * @param {WaypointCoordinates} home Home position.
 * @returns {ReturnPathPlan} Triggers and return stations, for sampling.
 */
export const returnPathPlan = (samples: TerrainProfileSample[], home: WaypointCoordinates): ReturnPathPlan => {
  const away = samples.filter(({ distanceM }) => distanceM > 0)
  const stride = Math.max(1, Math.ceil(away.length / MAX_TRIGGERS))
  const triggers = away.filter((_, index) => index % stride === 0 || index === away.length - 1)
  const returns = triggers.map((trigger) =>
    densifyPath([trigger.coordinates, home], Math.max(30, legLengthM(trigger.coordinates, home) / 150))
  )
  return { triggers, returns }
}

/**
 * The closest a return comes to the terrain.
 */
interface ReturnClearance {
  /**
   * Clearance in meters, under the keel for vessels.
   */
  clearanceM: number
  /**
   * Where along the return it happens.
   */
  at: WaypointCoordinates
}

const returnClearance = (
  trigger: TerrainProfileSample,
  stations: PathStation[],
  groundHighM: (number | null)[],
  homeAmslM: number,
  behavior: ReturnBehavior,
  context: TerrainProfileContext
): ReturnClearance | null => {
  const start = trigger.pathAmslM
  if (start === null) return null
  const target =
    behavior.returnAltitudeAboveHomeM === null ? start : Math.max(start, homeAmslM + behavior.returnAltitudeAboveHomeM)
  let worst: ReturnClearance | null = null
  const landBeyond = landBeyondCoastline(stations, context)
  stations.forEach((station, index) => {
    const ground = groundHighM[index]
    if (ground === null) return
    // A possible shoal on the way home is not land in the way, and the profile reports it where the mission crosses it.
    const vessel = context.vehicleClass === 'surface'
    if (
      vessel &&
      ground > context.waterLevelM &&
      possibleShallowsReason(context, station.coordinates, landBeyond[index])
    )
      return
    // At the trigger itself the vehicle is still where it was, also for an infinite (vertical) climb gradient.
    const climbed = station.distanceM === 0 ? start : start + behavior.climbGradient * station.distanceM
    const clearanceM = vessel
      ? context.waterLevelM - ground - context.draftM
      : Math.min(target, climbed) - surfaceHeight(ground, context.waterLevelM)
    if (!worst || clearanceM < worst.clearanceM) worst = { clearanceM, at: station.coordinates }
  })
  return worst
}

/**
 * Finds the stretches of a mission from which an automatic return home would pass closer to the
 * terrain than allowed, as the straight line home is often not the way the mission came.
 * @param {ReturnPathPlan} plan Triggers and returns, from {@link returnPathPlan}.
 * @param {(number | null)[][]} groundHighM Conservative ground along each return.
 * @param {number} homeAmslM Home altitude above sea level.
 * @param {ReturnBehavior} behavior How the vehicle returns.
 * @param {TerrainProfileContext} context Vehicle and thresholds.
 * @returns {ReturnPathFinding[]} One finding per stretch.
 */
export const returnPathFindings = (
  plan: ReturnPathPlan,
  groundHighM: (number | null)[][],
  homeAmslM: number,
  behavior: ReturnBehavior,
  context: TerrainProfileContext
): ReturnPathFinding[] => {
  if (behavior.followsTerrain || context.vehicleClass === 'ground' || context.vehicleClass === 'underwater') return []
  const minimum = context.vehicleClass === 'surface' ? context.minimumUnderKeelM : context.minimumClearanceM
  const findings: ReturnPathFinding[] = []
  let open: ReturnPathFinding | null = null
  plan.triggers.forEach((trigger, index) => {
    const result = returnClearance(trigger, plan.returns[index], groundHighM[index], homeAmslM, behavior, context)
    const unsafe = result !== null && result.clearanceM < minimum
    if (open && (!unsafe || trigger.legIndex !== open.legIndex)) open = null
    if (!unsafe || !result) return
    if (!open) {
      open = { legIndex: trigger.legIndex, fromM: trigger.distanceM, toM: trigger.distanceM, ...worstOf(result) }
      findings.push(open)
      return
    }
    open.toM = trigger.distanceM
    if (result.clearanceM < open.worstClearanceM) Object.assign(open, worstOf(result))
  })
  return findings
}

const worstOf = ({ clearanceM, at }: ReturnClearance): Pick<ReturnPathFinding, 'worstClearanceM' | 'worstAt'> => ({
  worstClearanceM: clearanceM,
  worstAt: at,
})
