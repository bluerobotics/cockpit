import { bearingBetween, effectiveAntennaRangeMeters, normalizeBearing } from '@/libs/baseStation/coverage'
import { bboxContains, kmToLatDegrees, kmToLngDegrees } from '@/libs/baseStation/coverageBbox'
import { calculateHaversineDistance } from '@/libs/mission/general-estimates'
import { type AntennaSpec, type BaseStationConfig, BaseStationCommsType } from '@/types/baseStation'
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

const outsideBeam = (antenna: AntennaSpec, from: WaypointCoordinates, to: WaypointCoordinates): boolean => {
  if (antenna.beamwidth >= 360) return false
  const offBoresightDeg = Math.abs(
    ((normalizeBearing(bearingBetween(from, to)) - normalizeBearing(antenna.bearing) + 540) % 360) - 180
  )
  return offBoresightDeg > antenna.beamwidth / 2
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
    if (outsideBeam(config.antenna, config.position, point)) return MissionCoverageRisk.LikelyLost

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

/** Expected strength of a radio link from the base station's radio. */
export type RadioLinkSignal = {
  /**
   * Received power in dBm, null when the terrain between the antennas is unknown.
   */
  powerDbm: number | null
  /**
   * How the link fares, on the scale the mission path is colored with.
   */
  risk: MissionCoverageRisk
}

// The vehicle's radio is not configured, so a plain dipole stands in for its antenna.
const VEHICLE_ANTENNA_GAIN_DBI = 2.15
const GOOD_MARGIN_DB = -20 * Math.log10(GOOD_RANGE_FRACTION)

const freeSpaceLossDb = (distanceM: number, frequencyMhz: number): number =>
  20 * Math.log10(distanceM / 1000) + 20 * Math.log10(frequencyMhz) + 32.44

// ITU-R P.526 single knife-edge loss, from the clearance as a share of the first Fresnel zone.
const knifeEdgeLossDb = (fresnelRatio: number): number => {
  const v = -Math.SQRT2 * fresnelRatio
  return v <= -0.78 ? 0 : 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1)
}

/**
 * Expected signal of the base station's radio at another radio, over the terrain between them. The practical range
 * the base station is configured with is where the link gives out in the open, so the margin over the signal there
 * decides the risk, the way the coverage overlay draws it.
 * @param {BaseStationConfig} config Base-station configuration.
 * @param {WaypointCoordinates} from Where the base station's antenna stands.
 * @param {WaypointCoordinates} to Where the other radio is.
 * @param {number | null} fresnelRatio Clearance of the line between the antennas, as a share of the first Fresnel
 * zone; null when the terrain is unknown.
 * @param {number} frequencyMhz Link frequency.
 * @returns {RadioLinkSignal} The expected signal.
 */
export const radioLinkSignal = (
  config: BaseStationConfig,
  from: WaypointCoordinates,
  to: WaypointCoordinates,
  fresnelRatio: number | null,
  frequencyMhz: number
): RadioLinkSignal => {
  if (fresnelRatio === null) return { powerDbm: null, risk: MissionCoverageRisk.Unknown }
  // ponytail: free-space loss plus one knife edge, so several ridges in a row read better than they are; a
  // terrain-aware propagation model such as Longley-Rice is the upgrade.
  const distanceM = Math.max(1, calculateHaversineDistance(from, to))
  const terrainLossDb = knifeEdgeLossDb(fresnelRatio)
  const transmittedDbm = 10 * Math.log10(Math.max(config.txPowerMilliwatts, 0.001))
  const gainsDb = config.antenna.gain + VEHICLE_ANTENNA_GAIN_DBI
  const powerDbm = transmittedDbm + gainsDb - freeSpaceLossDb(distanceM, frequencyMhz) - terrainLossDb
  const marginDb = 20 * Math.log10(effectiveAntennaRangeMeters(config) / distanceM) - terrainLossDb
  if (marginDb < 0 || outsideBeam(config.antenna, from, to)) return { powerDbm, risk: MissionCoverageRisk.LikelyLost }
  return { powerDbm, risk: marginDb < GOOD_MARGIN_DB ? MissionCoverageRisk.Marginal : MissionCoverageRisk.Good }
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
