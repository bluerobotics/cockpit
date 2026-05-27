import * as turf from '@turf/turf'
import type L from 'leaflet'

import type { WaypointCoordinates } from '@/types/mission'

const SECTOR_ARC_STEPS = 64

/**
 * Build the LatLng polygon describing a directional antenna's coverage sector.
 * @param {WaypointCoordinates} center Antenna position.
 * @param {number} rangeMeters Effective antenna range.
 * @param {number} bearingDeg Antenna bearing (degrees).
 * @param {number} beamwidthDeg Antenna beamwidth (degrees).
 * @returns {L.LatLngExpression[]} Polygon vertices, including the apex at both ends.
 */
export const sectorPolygonLatLngs = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number,
  beamwidthDeg: number
): L.LatLngExpression[] => {
  const halfBeam = beamwidthDeg / 2
  const startBearing = bearingDeg - halfBeam
  const endBearing = bearingDeg + halfBeam
  const rangeKm = rangeMeters / 1000
  const turfCenter = turf.point([center[1], center[0]])

  const arc = turf.lineArc(turfCenter, rangeKm, startBearing, endBearing, { steps: SECTOR_ARC_STEPS })
  const arcPoints = arc.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression)
  return [center as L.LatLngExpression, ...arcPoints, center as L.LatLngExpression]
}

/**
 * Project a point at the antenna's max range along its current bearing — used as the
 * draggable handle position on the map.
 * @param {WaypointCoordinates} center Antenna position.
 * @param {number} rangeMeters Effective antenna range.
 * @param {number} bearingDeg Antenna bearing (degrees).
 * @returns {WaypointCoordinates} Handle position.
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
 * 180° front-facing arc at the antenna's max range, used to preview where the signal will land
 * as the operator rotates the antenna.
 * @param {WaypointCoordinates} center Antenna position.
 * @param {number} rangeMeters Effective antenna range.
 * @param {number} bearingDeg Antenna bearing (degrees).
 * @returns {L.LatLngExpression[]} Polyline points along the aiming arc.
 */
export const aimingArcLatLngs = (
  center: WaypointCoordinates,
  rangeMeters: number,
  bearingDeg: number
): L.LatLngExpression[] => {
  const turfCenter = turf.point([center[1], center[0]])
  const arc = turf.lineArc(turfCenter, rangeMeters / 1000, bearingDeg - 90, bearingDeg + 90, {
    steps: SECTOR_ARC_STEPS,
  })
  return arc.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression)
}

/**
 * Compass bearing from `center` to `point`, in degrees.
 * @param {WaypointCoordinates} center Reference point.
 * @param {WaypointCoordinates} point Target point.
 * @returns {number} Bearing in degrees (-180..180).
 */
export const bearingFromCenter = (center: WaypointCoordinates, point: WaypointCoordinates): number => {
  return turf.bearing(turf.point([center[1], center[0]]), turf.point([point[1], point[0]]))
}
