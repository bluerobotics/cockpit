import { bearingBetween, calculateHaversineDistance } from '@/libs/mission/general-estimates'
import type { Survey, Waypoint, WaypointCoordinates } from '@/types/mission'

/** A direction arrow anchored at the middle of a survey leg. */
export interface SurveyArrowAnchor {
  /** Midpoint of the leg, where the arrow is drawn. */
  position: WaypointCoordinates
  /** Direction of travel along the leg, in degrees clockwise from north (0 = north). */
  bearing: number
  /** Great-circle length of the leg, in meters. */
  lengthMeters: number
  /** Start coordinate of the leg. */
  start: WaypointCoordinates
  /** End coordinate of the leg. */
  end: WaypointCoordinates
}

/**
 * Computes a direction-of-travel arrow anchor at the middle of each straight leg of an ordered path.
 * Zero-length legs (repeated points) produce no anchor, so consecutive duplicates never yield a stray arrow.
 * @param {WaypointCoordinates[]} path - Ordered coordinates describing the survey flight path.
 * @returns {SurveyArrowAnchor[]} One anchor per non-degenerate leg, in path order.
 */
export const computeSurveyArrowAnchors = (path: WaypointCoordinates[]): SurveyArrowAnchor[] => {
  const anchors: SurveyArrowAnchor[] = []

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]
    const end = path[i + 1]
    const lengthMeters = calculateHaversineDistance(start, end)
    if (lengthMeters === 0) continue

    anchors.push({
      // ponytail: arithmetic midpoint, accurate to sub-meter for survey-length legs but drifts from the true
      // geodesic midpoint on very long legs at high latitude; swap in a geodesic midpoint if that ever matters.
      position: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      bearing: bearingBetween(start, end),
      lengthMeters,
      start,
      end,
    })
  }

  return anchors
}

/** Arrows split by leg length relative to the longest leg in the set. */
export interface LengthPartitionedArrows {
  /** Legs at least `minLengthRatio` of the longest leg (the transect sweeps). */
  long: SurveyArrowAnchor[]
  /** Legs shorter than that fraction of the longest leg (the connector/turnaround legs). */
  short: SurveyArrowAnchor[]
}

/**
 * Splits arrows into the long transect sweeps and the short connector legs, comparing each leg's length against a
 * fraction of the longest leg in the set.
 * @param {SurveyArrowAnchor[]} anchors - Arrows in path order.
 * @param {number} minLengthRatio - Fraction of the longest leg a leg must reach to count as long.
 * @returns {LengthPartitionedArrows} The arrows grouped into long and short legs, each keeping path order.
 */
export const partitionArrowsByLength = (
  anchors: SurveyArrowAnchor[],
  minLengthRatio: number
): LengthPartitionedArrows => {
  const long: SurveyArrowAnchor[] = []
  const short: SurveyArrowAnchor[] = []
  if (anchors.length === 0) return { long, short }

  const longestLeg = anchors.reduce((longest, anchor) => Math.max(longest, anchor.lengthMeters), 0)
  const threshold = longestLeg * minLengthRatio
  anchors.forEach((anchor) => (anchor.lengthMeters >= threshold ? long : short).push(anchor))
  return { long, short }
}

/** Arrows of a survey grouped by which of the two perpendicular passes their leg belongs to. */
export interface OrientedArrowGroups {
  /** Arrows on the primary-pass sweeps. */
  primary: SurveyArrowAnchor[]
  /** Arrows on the perpendicular crosshatch re-fly sweeps. */
  crosshatch: SurveyArrowAnchor[]
}

/**
 * Splits a crosshatch survey's arrows into its two perpendicular sweep families, taking the first arrow's
 * orientation as the primary reference (the primary pass comes first in the generated path). Orientation is
 * taken modulo 180°, so the split is unaffected by which direction each leg is flown.
 * @param {SurveyArrowAnchor[]} anchors - Arrows in path order.
 * @returns {OrientedArrowGroups} The arrows grouped into the primary and crosshatch passes.
 */
export const partitionArrowsByOrientation = (anchors: SurveyArrowAnchor[]): OrientedArrowGroups => {
  const primary: SurveyArrowAnchor[] = []
  const crosshatch: SurveyArrowAnchor[] = []
  if (anchors.length === 0) return { primary, crosshatch }

  const reference = anchors[0].bearing % 180
  anchors.forEach((anchor) => {
    const foldedDiff = Math.abs((anchor.bearing % 180) - reference)
    const orientationDiff = foldedDiff > 90 ? 180 - foldedDiff : foldedDiff
    if (orientationDiff < 45) primary.push(anchor)
    else crosshatch.push(anchor)
  })
  return { primary, crosshatch }
}

/**
 * Rebuilds each survey's waypoint coordinates from the live mission waypoints, matched by id, so a dragged waypoint
 * moves the survey path that owns it (a survey stores its own waypoint copies, which a drag would otherwise leave stale).
 * @param {Survey[]} surveys - Surveys whose stored waypoint coordinates may be stale.
 * @param {Waypoint[]} liveWaypoints - Current mission waypoints holding the up-to-date coordinates.
 * @returns {Survey[]} The surveys with each waypoint's coordinates refreshed from its live counterpart.
 */
export const applyLiveWaypointCoordinates = (surveys: Survey[], liveWaypoints: Waypoint[]): Survey[] => {
  const coordinatesById: Record<string, WaypointCoordinates> = {}
  liveWaypoints.forEach((wp) => (coordinatesById[wp.id] = wp.coordinates))
  return surveys.map((survey) => ({
    ...survey,
    waypoints: survey.waypoints.map((wp) => ({ ...wp, coordinates: coordinatesById[wp.id] ?? wp.coordinates })),
  }))
}
