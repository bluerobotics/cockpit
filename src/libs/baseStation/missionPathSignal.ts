import { bearingBetween, effectiveAntennaRangeMeters, normalizeBearing } from '@/libs/baseStation/coverage'
import { bboxContains, kmToLatDegrees, kmToLngDegrees } from '@/libs/baseStation/coverageBbox'
import { calculateHaversineDistance } from '@/libs/mission/general-estimates'
import { type BaseStationConfig, BaseStationCommsType } from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

import type { MobileCoverageCircle } from './mobileCoverage'

/**
 * Risk levels used to color the mission path according to expected comms quality.
 */
export enum MissionCoverageRisk {
  Good = 'good',
  Marginal = 'marginal',
  LikelyLost = 'likely_lost',
  Unknown = 'unknown',
}

export type MissionCoverageSegment = {
  /**
   * Ordered points tracing this contiguous same-risk run of the path.
   */
  points: WaypointCoordinates[]
  /**
   * Risk classification for the segment.
   */
  risk: MissionCoverageRisk
}

/** Sampling step (meters) used to subdivide the mission path for color shading. */
export const DEFAULT_MISSION_COVERAGE_DISPLAY_SAMPLE_INTERVAL_METERS = 8

/** In-range distances above this fraction of effective range are treated as marginal. */
const GOOD_RANGE_FRACTION = 0.75

/** Distance past the nearest mobile coverage ring border that still counts as marginal. */
const MOBILE_MARGINAL_OUTSIDE_METERS = 300

export const MISSION_COVERAGE_RISK_COLORS: Record<MissionCoverageRisk, string> = {
  [MissionCoverageRisk.Good]: '#22c55e',
  [MissionCoverageRisk.Marginal]: '#f59e0b',
  [MissionCoverageRisk.LikelyLost]: '#ef4444',
  [MissionCoverageRisk.Unknown]: '#94a3b8',
}

const buildSamplesAlongCoordinates = (
  path: WaypointCoordinates[],
  sampleIntervalMeters: number
): WaypointCoordinates[] => {
  if (path.length < 2 || sampleIntervalMeters <= 0) return []

  const segmentLengths = path.slice(1).map((vertex, index) => calculateHaversineDistance(path[index], vertex))
  const totalLengthMeters = segmentLengths.reduce((total, length) => total + length, 0)
  if (totalLengthMeters <= 0) return []

  const sampleDistances: number[] = []
  if (totalLengthMeters <= sampleIntervalMeters) {
    sampleDistances.push(0, totalLengthMeters)
  } else {
    for (let distance = 0; distance < totalLengthMeters; distance += sampleIntervalMeters) {
      sampleDistances.push(distance)
    }
    if (sampleDistances[sampleDistances.length - 1] !== totalLengthMeters) {
      sampleDistances.push(totalLengthMeters)
    }
  }

  // Sample distances ascend, so one forward-only cursor over the vertices places all of them.
  // Interpolating each sample from the head of the line instead costs samples times vertices, and
  // a survey mission has thousands of both.
  const samples: WaypointCoordinates[] = []
  let segmentIndex = 0
  let distanceAtSegmentStart = 0
  for (const sampleDistance of sampleDistances) {
    while (
      segmentIndex < segmentLengths.length - 1 &&
      distanceAtSegmentStart + segmentLengths[segmentIndex] < sampleDistance
    ) {
      distanceAtSegmentStart += segmentLengths[segmentIndex]
      segmentIndex += 1
    }
    const segmentLength = segmentLengths[segmentIndex]
    const fraction = segmentLength > 0 ? Math.min((sampleDistance - distanceAtSegmentStart) / segmentLength, 1) : 0
    const start = path[segmentIndex]
    const end = path[segmentIndex + 1]
    samples.push([start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction])
  }

  return samples
}

const circlesRelevantToPath = (
  path: WaypointCoordinates[],
  circles: MobileCoverageCircle[]
): MobileCoverageCircle[] => {
  let south = Number.POSITIVE_INFINITY
  let west = Number.POSITIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  for (const [lat, lng] of path) {
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    west = Math.min(west, lng)
    east = Math.max(east, lng)
  }
  const referenceLat = Math.max(Math.abs(south), Math.abs(north))

  return circles.filter((circle) => {
    const reachKm = (circle.rangeMeters + MOBILE_MARGINAL_OUTSIDE_METERS) / 1000
    const latMargin = kmToLatDegrees(reachKm)
    const lngMargin = kmToLngDegrees(reachKm, referenceLat)
    return bboxContains(
      { south: south - latMargin, west: west - lngMargin, north: north + latMargin, east: east + lngMargin },
      circle.center
    )
  })
}

const distanceToNearestRingBorderMeters = (point: WaypointCoordinates, circles: MobileCoverageCircle[]): number => {
  let best = Number.POSITIVE_INFINITY
  for (const circle of circles) {
    const distanceToCenter = calculateHaversineDistance(circle.center, point)
    const borderDistance = distanceToCenter - circle.rangeMeters
    if (borderDistance < best) best = borderDistance
  }
  return best
}

/**
 * Classify comms risk at a geographic point. Radio-link missions use the antenna range arc;
 * mobile-data missions use the nearest cellular coverage ring border.
 * @param {BaseStationConfig} config Base-station configuration.
 * @param {WaypointCoordinates} point Point to evaluate.
 * @param {MobileCoverageCircle[]} mobileCoverageCircles Active mobile coverage circles (only used for MobileData).
 * @returns {MissionCoverageRisk} Risk classification at the point.
 */
export const classifyCoverageAtPoint = (
  config: BaseStationConfig,
  point: WaypointCoordinates,
  mobileCoverageCircles: MobileCoverageCircle[] = []
): MissionCoverageRisk => {
  if (!config.enabled) return MissionCoverageRisk.Unknown

  if (config.commsType === BaseStationCommsType.RadioLink) {
    if (!config.position) return MissionCoverageRisk.Unknown

    const distanceFromBaseMeters = calculateHaversineDistance(config.position, point)
    const rangeMeters = effectiveAntennaRangeMeters(config)

    if (distanceFromBaseMeters > rangeMeters) return MissionCoverageRisk.LikelyLost

    // A directional antenna only reaches where it is aimed, so the coloring has to honor the same
    // sector the overlay draws instead of promising coverage behind the station.
    const { bearing, beamwidth } = config.antenna
    if (beamwidth < 360) {
      const offBoresightDeg = Math.abs(
        ((normalizeBearing(bearingBetween(config.position, point)) - normalizeBearing(bearing) + 540) % 360) - 180
      )
      if (offBoresightDeg > beamwidth / 2) return MissionCoverageRisk.LikelyLost
    }

    if (distanceFromBaseMeters > rangeMeters * GOOD_RANGE_FRACTION) return MissionCoverageRisk.Marginal
    return MissionCoverageRisk.Good
  }

  if (config.commsType === BaseStationCommsType.MobileData) {
    if (mobileCoverageCircles.length === 0) return MissionCoverageRisk.Unknown
    const borderDistance = distanceToNearestRingBorderMeters(point, mobileCoverageCircles)
    if (borderDistance <= 0) return MissionCoverageRisk.Good
    if (borderDistance <= MOBILE_MARGINAL_OUTSIDE_METERS) return MissionCoverageRisk.Marginal
    return MissionCoverageRisk.LikelyLost
  }

  return MissionCoverageRisk.Unknown
}

/**
 * Build map display segments by sampling along the path so color follows range changes.
 * @param {BaseStationConfig} config Base-station configuration.
 * @param {WaypointCoordinates[]} path Path vertices in mission order.
 * @param {MobileCoverageCircle[]} mobileCoverageCircles Active mobile coverage circles (only used for MobileData).
 * @param {number} sampleIntervalMeters Distance between samples along the path.
 * @returns {MissionCoverageSegment[]} Colored segments matching the path geometry.
 */
export const buildMissionPathDisplaySegments = (
  config: BaseStationConfig,
  path: WaypointCoordinates[],
  mobileCoverageCircles: MobileCoverageCircle[] = [],
  sampleIntervalMeters = DEFAULT_MISSION_COVERAGE_DISPLAY_SAMPLE_INTERVAL_METERS
): MissionCoverageSegment[] => {
  const samples = buildSamplesAlongCoordinates(path, sampleIntervalMeters)
  if (samples.length < 2) return []

  // The cache holds up to eight ~22 km boxes, so scanning every tower in it for each 8 m sample is
  // what makes a long survey stutter. A circle whose border cannot reach the marginal band around
  // the path can never win the nearest-border test, and keeping one when none qualify preserves the
  // "coverage data exists" signal, so the path still reads as lost rather than unknown.
  const relevantCircles = circlesRelevantToPath(path, mobileCoverageCircles)
  const circles = relevantCircles.length > 0 ? relevantCircles : mobileCoverageCircles.slice(0, 1)

  // Merge contiguous same-risk sub-segments into a single polyline run so long paths emit a
  // handful of layers instead of one per sample; the shared boundary point keeps runs gapless.
  const segments: MissionCoverageSegment[] = []
  for (let i = 0; i < samples.length - 1; i++) {
    const start = samples[i]
    const end = samples[i + 1]
    const mid: WaypointCoordinates = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
    const risk = classifyCoverageAtPoint(config, mid, circles)
    const previous = segments[segments.length - 1]
    if (previous && previous.risk === risk) {
      previous.points.push(end)
    } else {
      segments.push({ points: [start, end], risk })
    }
  }

  return segments
}
