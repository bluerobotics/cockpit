import { MissionLeg, WaypointCoordinates } from '@/types/mission'

import { norm360, radians } from '../utils'
import { BatteryChemistry } from '../vehicle/types'

const earthRadiusMeters = 6_378_137

// Haversine distance between two lat/lng coordinates (in meters) to calculate around-a-sphere distance between two points
// Equation from https://www.movable-type.co.uk/scripts/latlong.html
export const calculateHaversineDistance = (start: WaypointCoordinates, end: WaypointCoordinates): number => {
  const deltaLatitude = radians(end[0] - start[0])
  const deltaLongitude = radians(end[1] - start[1])
  const lat1Rad = radians(start[0])
  const lat2Rad = radians(end[0])
  const alpha =
    Math.sin(deltaLatitude / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLongitude / 2) ** 2
  const centralAngle = 2 * Math.asin(Math.sqrt(alpha))

  return earthRadiusMeters * centralAngle
}

export const centroidLatLng = (vertices: WaypointCoordinates[]): WaypointCoordinates => {
  if (vertices.length === 0) return [0, 0]
  if (vertices.length < 3) {
    const avgLat = vertices.reduce((sum, p) => sum + p[0], 0) / vertices.length
    const avgLng = vertices.reduce((sum, p) => sum + p[1], 0) / vertices.length
    return [avgLat, avgLng]
  }

  let meanLatDeg = 0
  let meanLngDeg = 0
  for (const pt of vertices) {
    meanLatDeg += pt[0]
    meanLngDeg += pt[1]
  }
  meanLatDeg /= vertices.length
  meanLngDeg /= vertices.length

  const meanLatRad = (meanLatDeg * Math.PI) / 180
  const meanLngRad = (meanLngDeg * Math.PI) / 180
  const cosMeanLat = Math.cos(meanLatRad)

  const projectedPoints = vertices.map((pt) => {
    const latRad = (pt[0] * Math.PI) / 180
    const lngRad = (pt[1] * Math.PI) / 180
    return {
      x: earthRadiusMeters * (lngRad - meanLngRad) * cosMeanLat,
      y: earthRadiusMeters * (latRad - meanLatRad),
    }
  })

  let twiceSignedArea = 0
  let centroidTermX = 0
  let centroidTermY = 0
  for (let i = 0; i < projectedPoints.length; i++) {
    const j = (i + 1) % projectedPoints.length
    const cross = projectedPoints[i].x * projectedPoints[j].y - projectedPoints[j].x * projectedPoints[i].y
    twiceSignedArea += cross
    centroidTermX += (projectedPoints[i].x + projectedPoints[j].x) * cross
    centroidTermY += (projectedPoints[i].y + projectedPoints[j].y) * cross
  }

  const polygonArea = twiceSignedArea / 2

  if (Math.abs(polygonArea) < 1e-9) {
    const avgLat = vertices.reduce((sum, p) => sum + p[0], 0) / vertices.length
    const avgLng = vertices.reduce((sum, p) => sum + p[1], 0) / vertices.length
    return [avgLat, avgLng]
  }

  const centroidX = centroidTermX / (6 * polygonArea)
  const centroidY = centroidTermY / (6 * polygonArea)
  const latRad = centroidY / earthRadiusMeters + meanLatRad
  const lngRad = centroidX / (earthRadiusMeters * cosMeanLat) + meanLngRad
  const latDeg = (latRad * 180) / Math.PI
  const lngDeg = (lngRad * 180) / Math.PI

  return [latDeg, lngDeg]
}

export const polygonAreaSquareMeters = (position: WaypointCoordinates[]): number => {
  if (position.length < 3) return 0
  let lat0 = 0,
    lon0 = 0
  for (const [lat, lon] of position) {
    lat0 += lat
    lon0 += lon
  }
  lat0 /= position.length
  lon0 /= position.length
  const phi0 = radians(lat0),
    lambda0 = radians(lon0)
  const pts = position.map(([lat, lon]) => {
    const phi = radians(lat),
      lambda = radians(lon)
    return { x: earthRadiusMeters * (lambda - lambda0) * Math.cos(phi0), y: earthRadiusMeters * (phi - phi0) }
  })
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return Math.abs(sum) / 2
}

// Energy density estimates (kg/Wh) by battery chemistry
export const batteryDensityPreChemistry: Record<BatteryChemistry, number> = {
  'li-ion': 0.005, // ≈5 g/Wh
  'li-po': 0.006, // ≈6 g/Wh
  'lifepo4': 0.009, // ≈9 g/Wh
}

// Bearing (forward azimuth) between two coordinates (in degrees)
// Equation from https://www.movable-type.co.uk/scripts/latlong.html
export const bearingBetween = (pointA: WaypointCoordinates, pointB: WaypointCoordinates): number => {
  const [lat1, lon1] = pointA
  const [lat2, lon2] = pointB
  const φ1 = radians(lat1)
  const φ2 = radians(lat2)
  const Δλ = radians(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return norm360((Math.atan2(y, x) * 180) / Math.PI)
}

// Smallest angle difference (0-180) between two bearings (in degrees)
export const deltaBearing = (bearing1: number, bearing2: number): number => {
  const angle = Math.abs(((bearing2 - bearing1 + 540) % 360) - 180)
  return angle
}

// Compute path time from provided legs (speed & distance) -> Still needs turning penalty that depends on vehicle
export const computeMissionDurationSecondsFromLegs = (legs: MissionLeg[]): number => {
  if (!Array.isArray(legs) || legs.length === 0) return NaN
  let legsTime = 0
  for (const leg of legs) {
    const v = Math.max(0.1, leg.speedMps)
    legsTime += leg.distanceMeters / v
  }
  return legsTime
}
