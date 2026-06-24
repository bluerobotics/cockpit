import * as turf from '@turf/turf'

import { calculateHaversineDistance } from '@/libs/mission/general-estimates'
import { type BaseStationConfig, BaseStationCommsType, effectiveAntennaRangeMeters } from '@/types/baseStation'
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
  if (path.length < 2) return []

  const line = turf.lineString(path.map((coordinates) => [coordinates[1], coordinates[0]]))
  const totalLengthMeters = turf.length(line, { units: 'kilometers' }) * 1000
  if (totalLengthMeters <= 0) return []

  const alongDistances: number[] = []
  if (totalLengthMeters <= sampleIntervalMeters) {
    alongDistances.push(0, totalLengthMeters)
  } else {
    for (let d = 0; d < totalLengthMeters; d += sampleIntervalMeters) {
      alongDistances.push(d)
    }
    if (alongDistances[alongDistances.length - 1] !== totalLengthMeters) {
      alongDistances.push(totalLengthMeters)
    }
  }

  return alongDistances.map((distanceAlongMissionMeters) => {
    const pt = turf.along(line, distanceAlongMissionMeters / 1000, { units: 'kilometers' })
    const [lng, lat] = pt.geometry.coordinates
    return [lat, lng] as WaypointCoordinates
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

  // Merge contiguous same-risk sub-segments into a single polyline run so long paths emit a
  // handful of layers instead of one per sample; the shared boundary point keeps runs gapless.
  const segments: MissionCoverageSegment[] = []
  for (let i = 0; i < samples.length - 1; i++) {
    const start = samples[i]
    const end = samples[i + 1]
    const mid: WaypointCoordinates = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
    const risk = classifyCoverageAtPoint(config, mid, mobileCoverageCircles)
    const previous = segments[segments.length - 1]
    if (previous && previous.risk === risk) {
      previous.points.push(end)
    } else {
      segments.push({ points: [start, end], risk })
    }
  }

  return segments
}
