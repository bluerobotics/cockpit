import type { TerrainProfileSample } from './mission-profile'

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

// Grades are read over this run so one noisy sample is not mistaken for a cliff.
const GRADE_WINDOW_M = 100

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
