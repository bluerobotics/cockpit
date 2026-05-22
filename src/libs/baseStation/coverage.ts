import * as turf from '@turf/turf'

import {
  type BaseStationConfig,
  BaseStationCommsType,
  BLUEBOAT_ANTENNA_MAST_RANGE_MULTIPLIER,
  DEFAULT_BASE_STATION_ANTENNA_HEIGHT_METERS,
} from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

/**
 * Number of segments used to approximate a coverage arc.
 */
export const SECTOR_ARC_STEPS = 64

const MIN_BASE_STATION_ANTENNA_HEIGHT_METERS = 0.5
const MAX_BASE_STATION_ANTENNA_HEIGHT_METERS = 50

/**
 * Range multiplier from base-station antenna height. Over flat water/terrain, radio horizon distance
 * scales as √h (d_km ≈ 4.12·√h with standard 4/3 Earth-radius refraction), so practical range grows
 * with the square root of height relative to {@link DEFAULT_BASE_STATION_ANTENNA_HEIGHT_METERS}.
 * @param {number} heightMeters Antenna height above ground in meters.
 * @returns {number} Multiplier applied to the entered range for map coverage.
 */
export const baseStationAntennaHeightRangeMultiplier = (heightMeters: number): number => {
  const clamped = Math.min(
    MAX_BASE_STATION_ANTENNA_HEIGHT_METERS,
    Math.max(MIN_BASE_STATION_ANTENNA_HEIGHT_METERS, heightMeters)
  )
  return Math.sqrt(clamped / DEFAULT_BASE_STATION_ANTENNA_HEIGHT_METERS)
}

/**
 * Practical antenna range (m) used for map coverage, including height and vehicle mast adjustments.
 * @param {BaseStationConfig} config Current base-station configuration.
 * @returns {number} Range in meters for overlay geometry.
 */
export const effectiveAntennaRangeMeters = (config: BaseStationConfig): number => {
  if (config.commsType !== BaseStationCommsType.RadioLink) return config.antenna.range

  let range = config.antenna.range * baseStationAntennaHeightRangeMultiplier(config.baseStationAntennaHeightMeters)
  if (config.vehicleHasBlueBoatAntennaMast) range *= BLUEBOAT_ANTENNA_MAST_RANGE_MULTIPLIER

  return Math.max(1, Math.round(range))
}

/**
 * Rescale antenna range after a gain change. Friis: a single-end gain delta scales LOS range by
 * 10^(ΔG_dB/20).
 * @param {number} currentRange Current range in meters.
 * @param {number} oldGain Previous antenna gain in dBi.
 * @param {number} newGain New antenna gain in dBi.
 * @returns {number} Rescaled range in meters (at least 1).
 */
export const rangeAfterGainChange = (currentRange: number, oldGain: number, newGain: number): number => {
  const ratio = Math.pow(10, (newGain - oldGain) / 20)
  return Math.max(1, Math.round(currentRange * ratio))
}

/**
 * Rescale antenna range after a transmit-power change. Friis: range ∝ √P_t, so the range scales by
 * √(P_new/P_old).
 * @param {number} currentRange Current range in meters.
 * @param {number} oldPowerMw Previous transmit power in milliwatts.
 * @param {number} newPowerMw New transmit power in milliwatts.
 * @returns {number} Rescaled range in meters (at least 1).
 */
export const rangeAfterTxPowerChange = (currentRange: number, oldPowerMw: number, newPowerMw: number): number => {
  const ratio = Math.sqrt(newPowerMw / oldPowerMw)
  return Math.max(1, Math.round(currentRange * ratio))
}

/**
 * Normalize a bearing to the [0, 360) range.
 * @param {number} bearing Bearing in degrees.
 * @returns {number} Equivalent bearing within [0, 360).
 */
export const normalizeBearing = (bearing: number): number => ((bearing % 360) + 360) % 360

/**
 * Great-circle bearing from one coordinate to another.
 * @param {WaypointCoordinates} from Origin coordinate as [latitude, longitude].
 * @param {WaypointCoordinates} to Target coordinate as [latitude, longitude].
 * @returns {number} Bearing in degrees, where 0 = north and angles grow clockwise.
 */
export const bearingBetween = (from: WaypointCoordinates, to: WaypointCoordinates): number =>
  turf.bearing(turf.point([from[1], from[0]]), turf.point([to[1], to[0]]))

/**
 * Centroid (mean position) of a set of coordinates.
 * @param {WaypointCoordinates[]} points Coordinates as [latitude, longitude].
 * @returns {WaypointCoordinates | null} Mean coordinate, or null when the list is empty.
 */
export const centroidOf = (points: WaypointCoordinates[]): WaypointCoordinates | null => {
  if (points.length === 0) return null
  const [sumLat, sumLng] = points.reduce<[number, number]>(
    ([lat, lng], [pLat, pLng]) => [lat + pLat, lng + pLng],
    [0, 0]
  )
  return [sumLat / points.length, sumLng / points.length]
}

/**
 * Closed polygon ring outlining a directional (sector) coverage area, anchored at the center.
 * @param {WaypointCoordinates} center Sector apex as [latitude, longitude].
 * @param {number} rangeMeters Sector radius in meters.
 * @param {number} bearingDeg Boresight bearing in degrees.
 * @param {number} beamwidthDeg Horizontal beamwidth in degrees.
 * @returns {WaypointCoordinates[]} Closed polygon ring as [latitude, longitude] points.
 */
export const sectorPolygonLatLngs = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number,
  beamwidthDeg: number
): WaypointCoordinates[] => {
  const halfBeam = beamwidthDeg / 2
  const arc = turf.lineArc(
    turf.point([center[1], center[0]]),
    rangeMeters / 1000,
    bearingDeg - halfBeam,
    bearingDeg + halfBeam,
    {
      steps: SECTOR_ARC_STEPS,
    }
  )
  const arcPoints = arc.geometry.coordinates.map(([lng, lat]) => [lat, lng] as WaypointCoordinates)
  return [center, ...arcPoints, center]
}

/**
 * Position of the draggable bearing handle at the antenna's max range along the boresight.
 * @param {WaypointCoordinates} center Antenna position as [latitude, longitude].
 * @param {number} rangeMeters Range in meters.
 * @param {number} bearingDeg Boresight bearing in degrees.
 * @returns {WaypointCoordinates} Handle position as [latitude, longitude].
 */
export const bearingHandlePosition = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number
): WaypointCoordinates => {
  const dest = turf.destination(turf.point([center[1], center[0]]), rangeMeters / 1000, bearingDeg, {
    units: 'kilometers',
  })
  const [lng, lat] = dest.geometry.coordinates
  return [lat, lng]
}

/**
 * 180° front-facing arc at the antenna's max range, previewing where the signal lands as the
 * operator rotates the antenna.
 * @param {WaypointCoordinates} center Antenna position as [latitude, longitude].
 * @param {number} rangeMeters Range in meters.
 * @param {number} bearingDeg Boresight bearing in degrees.
 * @returns {WaypointCoordinates[]} Arc points as [latitude, longitude].
 */
export const aimingArcLatLngs = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number
): WaypointCoordinates[] => {
  const arc = turf.lineArc(turf.point([center[1], center[0]]), rangeMeters / 1000, bearingDeg - 90, bearingDeg + 90, {
    steps: SECTOR_ARC_STEPS,
  })
  return arc.geometry.coordinates.map(([lng, lat]) => [lat, lng] as WaypointCoordinates)
}
