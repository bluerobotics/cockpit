import type { ProfilePoint } from './mission-profile'
import type { MissionTerrainAnalysis } from './mission-terrain'

// The leg out of home only rises with its far end, so terrain right next to home would ask for an
// endless raise of waypoint 1.
// ponytail: terrain in the first quarter of the climb out of home is left as found; a takeoff-aware climb
// model would cover it.
const HOME_LEG_MIN_FRACTION = 0.25

// A return bound by the vehicle's return altitude rises less than the path does, and the leg out of home
// less than its far end, so a few re-checks settle what one pass leaves short.
const MAX_PASSES = 4

// Rounds of settling each waypoint against its neighbors; a mission's shortfalls settle in two or three.
const SETTLE_ROUNDS = 8

/**
 * A point of a leg that has to rise, by the raises of the leg's two ends weighted by their nearness.
 */
interface Shortfall {
  /**
   * The nearer end, which answers it.
   */
  owner: number
  /**
   * The farther end, null for home, which does not move.
   */
  other: number | null
  /**
   * How much the point rises per meter the owner rises.
   */
  ownWeight: number
  /**
   * How much it rises per meter the other end rises.
   */
  otherWeight: number
  /**
   * Meters it has to rise.
   */
  shortM: number
}

/**
 * How much to raise each waypoint so the path, and the returns home from it, keep a clearance over
 * the terrain. Each shortfall is answered by the nearer waypoint, given what its neighbor already rises,
 * so a waypoint keeps about the height of the others and one already high is left where it is.
 * @param {MissionTerrainAnalysis} analysis The mission analysis.
 * @param {number} targetClearanceM Clearance to keep, in meters.
 * @returns {number[]} Whole meters to add to each waypoint's altitude, by waypoint index.
 */
export const safeAltitudeRaisesM = (analysis: MissionTerrainAnalysis, targetClearanceM: number): number[] => {
  const { points, profile, returnFindings } = analysis
  const shortfalls: Shortfall[] = []
  // Out of home the clearance to keep grows from none at home to the full target at the first waypoint.
  const need = (legIndex: number, clearanceM: number, legFraction: number): void => {
    const start = points[legIndex]?.waypointIndex ?? null
    const end = points[legIndex + 1]?.waypointIndex ?? null
    const fromHome = start === null
    if (end === null || (fromHome && legFraction < HOME_LEG_MIN_FRACTION)) return
    const shortM = (fromHome ? legFraction * targetClearanceM : targetClearanceM) - clearanceM
    if (shortM <= 0) return
    if (start !== null && legFraction <= 0.5) {
      shortfalls.push({ owner: start, other: end, ownWeight: 1 - legFraction, otherWeight: legFraction, shortM })
    } else {
      shortfalls.push({ owner: end, other: start, ownWeight: legFraction, otherWeight: 1 - legFraction, shortM })
    }
  }
  profile.samples.forEach(({ legIndex, legFraction, clearanceM }) => {
    if (clearanceM !== null) need(legIndex, clearanceM, legFraction)
  })
  returnFindings.forEach(({ legIndex, fromM, toM, worstClearanceM }) => {
    const fractionAt = (distanceM: number): number =>
      profile.samples.find((sample) => sample.legIndex === legIndex && sample.distanceM === distanceM)?.legFraction ?? 1
    // A stretch reaching past the climb out of home is raised for its part beyond it.
    // The lift is linear along the leg, so clearing both ends of the stretch clears all of it.
    need(legIndex, worstClearanceM, Math.max(fractionAt(fromM), Math.min(fractionAt(toM), HOME_LEG_MIN_FRACTION)))
    need(legIndex, worstClearanceM, fractionAt(toM))
  })

  let raisesM = points.filter(({ waypointIndex }) => waypointIndex !== null).map(() => 0)
  const required = (
    floorM: number,
    neighbors: number[],
    { other, ownWeight, otherWeight, shortM }: Shortfall
  ): number => Math.max(floorM, (shortM - otherWeight * (other === null ? 0 : neighbors[other])) / ownWeight)
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    const next = raisesM.map(() => 0)
    shortfalls.forEach((shortfall) => (next[shortfall.owner] = required(next[shortfall.owner], raisesM, shortfall)))
    raisesM = next
  }
  // Settling can leave a point a little short, and a raise only lifts every point, so one pass in place
  // that tops up whatever is still short clears them all.
  shortfalls.forEach((shortfall) => (raisesM[shortfall.owner] = required(raisesM[shortfall.owner], raisesM, shortfall)))
  return raisesM.map(Math.ceil)
}

let selfChecked = false

const checkSafeAltitudeOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const point = (waypointIndex: number | null): ProfilePoint =>
    ({ coordinates: [0, 0], altitude: 0, waypointIndex } as ProfilePoint)
  const sample = (
    legIndex: number,
    legFraction: number,
    clearanceM: number
  ): MissionTerrainAnalysis['profile']['samples'][number] =>
    ({ legIndex, legFraction, clearanceM } as MissionTerrainAnalysis['profile']['samples'][number])
  const analysis = {
    points: [point(null), point(0), point(1), point(2)],
    profile: { samples: [sample(0, 0.1, -100), sample(0, 0.5, -10), sample(1, 0.5, 5), sample(2, 0.1, 10)] },
    returnFindings: [],
  } as unknown as MissionTerrainAnalysis
  const [first, second, third] = safeAltitudeRaisesM(analysis, 20)
  assert(first === 40, 'Out of home, the clearance to keep grows along the leg to the first waypoint')
  assert(second === 12 && third === 0, 'A shortfall next to one waypoint raises that one, not its neighbor')
  const flat = {
    points: [point(0), point(1)],
    profile: { samples: [0, 0.25, 0.5, 0.75, 1].map((fraction) => sample(0, fraction, 0)) },
    returnFindings: [],
  } as unknown as MissionTerrainAnalysis
  const raises = safeAltitudeRaisesM(flat, 20)
  assert(
    raises.every((raiseM) => raiseM === 20),
    'A leg short all along rises evenly by the shortfall'
  )
}

/**
 * What raising a mission to a safe height came to.
 */
export interface SafeAltitudeResult {
  /**
   * Meters added to each waypoint's altitude, by waypoint index.
   */
  raisesM: number[]
  /**
   * The check of the raised mission, null when it could not be checked.
   */
  analysis: MissionTerrainAnalysis | null
}

const raisedPoints = (points: ProfilePoint[], raisesM: number[]): ProfilePoint[] =>
  points.map((point) =>
    point.waypointIndex === null ? point : { ...point, altitude: point.altitude + raisesM[point.waypointIndex] }
  )

/**
 * Raises a mission's waypoints until the path and its returns home keep a clearance over the terrain,
 * re-checking the raised mission between passes.
 * @param {MissionTerrainAnalysis} analysis Check of the mission as it is.
 * @param {number} targetClearanceM Clearance to keep, in meters.
 * @param {(points: ProfilePoint[]) => Promise<MissionTerrainAnalysis | null>} analyze Checks a path.
 * @returns {Promise<SafeAltitudeResult>} The raises and the check of the raised mission.
 */
export const raiseToSafeAltitude = async (
  analysis: MissionTerrainAnalysis,
  targetClearanceM: number,
  analyze: (points: ProfilePoint[]) => Promise<MissionTerrainAnalysis | null>
): Promise<SafeAltitudeResult> => {
  checkSafeAltitudeOnce()
  let latest: MissionTerrainAnalysis | null = analysis
  let raisesM = analysis.points.filter(({ waypointIndex }) => waypointIndex !== null).map(() => 0)
  for (let pass = 0; pass < MAX_PASSES && latest; pass++) {
    const step = safeAltitudeRaisesM(latest, targetClearanceM)
    if (step.every((raiseM) => raiseM === 0)) break
    raisesM = raisesM.map((raiseM, index) => raiseM + step[index])
    latest = await analyze(raisedPoints(analysis.points, raisesM))
  }
  return { raisesM, analysis: latest }
}
