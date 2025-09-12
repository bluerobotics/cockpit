import L from 'leaflet'
import { computed } from 'vue'

import { BatteryChemistry } from '@/libs/vehicle/types'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

type LatLng = [number, number]

const toRad = (deg: number): number => (deg * Math.PI) / 180
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360
const earthRadiusMeters = 6_378_137

const calculateHaversineDistance = (start: LatLng, end: LatLng): number => {
  const deltaLatitude = toRad(end[0] - start[0])
  const deltaLongitude = toRad(end[1] - start[1])
  const lat1Rad = toRad(start[0])
  const lat2Rad = toRad(end[0])

  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLongitude / 2) ** 2
  const centralAngle = 2 * Math.asin(Math.sqrt(a))

  return earthRadiusMeters * centralAngle
}

// bearing from a to b in degrees
const bearingBetween = (a: LatLng, b: LatLng): number => {
  const theta1 = toRad(a[0])
  const theta2 = toRad(b[0])
  const deltaLambda = toRad(b[1] - a[1])
  const y = Math.sin(deltaLambda) * Math.cos(theta2)
  const x = Math.cos(theta1) * Math.sin(theta2) - Math.sin(theta1) * Math.cos(theta2) * Math.cos(deltaLambda)
  return norm360((Math.atan2(y, x) * 180) / Math.PI)
}

// smallest difference between two bearings
const deltaBearing = (b1: number, b2: number): number => {
  const d = Math.abs(b2 - b1)
  return d > 180 ? 360 - d : d
}

export const centroidLatLng = (vertices: L.LatLng[]): L.LatLng => {
  if (vertices.length === 0) return L.latLng(0, 0)
  if (vertices.length < 3) {
    const avgLat = vertices.reduce((sum, p) => sum + p.lat, 0) / vertices.length
    const avgLng = vertices.reduce((sum, p) => sum + p.lng, 0) / vertices.length
    return L.latLng(avgLat, avgLng)
  }

  let meanLatDeg = 0
  let meanLngDeg = 0
  for (const pt of vertices) {
    meanLatDeg += pt.lat
    meanLngDeg += pt.lng
  }
  meanLatDeg /= vertices.length
  meanLngDeg /= vertices.length

  const meanLatRad = (meanLatDeg * Math.PI) / 180
  const meanLngRad = (meanLngDeg * Math.PI) / 180
  const cosMeanLat = Math.cos(meanLatRad)

  const projectedPoints = vertices.map((pt) => {
    const latRad = (pt.lat * Math.PI) / 180
    const lngRad = (pt.lng * Math.PI) / 180
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
    const avgLat = vertices.reduce((sum, p) => sum + p.lat, 0) / vertices.length
    const avgLng = vertices.reduce((sum, p) => sum + p.lng, 0) / vertices.length
    return L.latLng(avgLat, avgLng)
  }

  const centroidX = centroidTermX / (6 * polygonArea)
  const centroidY = centroidTermY / (6 * polygonArea)
  const latRad = centroidY / earthRadiusMeters + meanLatRad
  const lngRad = centroidX / (earthRadiusMeters * cosMeanLat) + meanLngRad
  const latDeg = (latRad * 180) / Math.PI
  const lngDeg = (lngRad * 180) / Math.PI

  return L.latLng(latDeg, lngDeg)
}

export const polygonAreaM2 = (position: LatLng[]): number => {
  if (position.length < 3) return 0
  let lat0 = 0,
    lon0 = 0
  for (const [lat, lon] of position) {
    lat0 += lat
    lon0 += lon
  }
  lat0 /= position.length
  lon0 /= position.length
  const phi0 = toRad(lat0),
    lambda0 = toRad(lon0)
  const pts = position.map(([lat, lon]) => {
    const phi = toRad(lat),
      lambda = toRad(lon)
    return { x: earthRadiusMeters * (lambda - lambda0) * Math.cos(phi0), y: earthRadiusMeters * (phi - phi0) }
  })
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return Math.abs(sum) / 2
}

export const formatMetersShort = (m: number): string => {
  if (!isFinite(m) || m <= 0) return '—'
  if (m < 1000) return `${m.toFixed(0)} m`
  return `${(m / 1000).toFixed(2)} km`
}
export const formatSeconds = (s: number): string => {
  if (!isFinite(s) || s <= 0) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}
export const formatWh = (wh: number): string => (wh <= 0 || !isFinite(wh) ? '—' : `${wh.toFixed(2)} Wh`)
export const formatArea = (m2: number): string => {
  if (m2 <= 0 || !isFinite(m2)) return '—'
  if (m2 < 1e6) return `${m2.toFixed(0)} m²`
  return `${(m2 / 1e6).toFixed(3)} km²`
}

// Constants derived from blue boat product sheet
const basePowerAtOneMs = 29.6 // ~29.6 W @ 1 m/s with 2 standard batteries, no payload
const massSlopeWPerKg1Mps = 0.68 // ~0.68 Watts per extra kg @ 1 m/s
const speedExponent = 3.2 // P ~ v^α (adjustable later via settings)

const kgPerWhByChem: Record<BatteryChemistry, number> = {
  'li-ion': 0.005, // ≈5 g/Wh
  'li-po': 0.006, // ≈6 g/Wh
  'lifepo4': 0.009, // ≈9 g/Wh
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useMissionStats = (): any => {
  const missionStore = useMissionStore()
  const vehicleStore = useMainVehicleStore()

  const missionLengthMeters = computed(() => {
    const wps = missionStore.currentPlanningWaypoints || []
    if (wps.length < 2) return 0
    let total = 0
    for (let i = 0; i < wps.length - 1; i++) {
      total += calculateHaversineDistance(wps[i].coordinates as LatLng, wps[i + 1].coordinates as LatLng)
    }
    return total
  })

  // Vehicle turning time penalty in seconds (hardcoded for now) #TODO integrate with MAVLink turning and acceleration parameters
  const turnPenaltySeconds = computed(() => {
    const wps = missionStore.currentPlanningWaypoints || []
    let secs = 0
    if (wps.length >= 2) secs += 1 // adds deceleration time
    for (let i = 1; i < wps.length - 1; i++) {
      const prev = wps[i - 1].coordinates as LatLng
      const cur = wps[i].coordinates as LatLng
      const next = wps[i + 1].coordinates as LatLng
      const diff = deltaBearing(bearingBetween(prev, cur), bearingBetween(cur, next))
      if (diff > 45) secs += 1 + 1 + Math.ceil(diff / 15)
    }
    return secs
  })

  // Vehicle parameter input
  const speedMps = computed<number>(() => {
    const speed = Number((missionStore as any).defaultCruiseSpeed)
    return speed > 0 ? speed : 1
  })

  // Extra payload in kg
  const payloadKg = computed<number>(() => {
    const payload = Number(vehicleStore.vehiclePayloadParameters?.extraPayloadKg)
    return Number.isFinite(payload) && payload >= 0 ? payload : 0
  })

  // Battery mass & capacity from count
  const batteryMassKg = computed<number>(() => {
    const battCapacity = Number(vehicleStore.vehiclePayloadParameters?.batteryCapacity) || 2 * 266.4 // default battery pack capacity
    const chem = (vehicleStore.vehiclePayloadParameters?.batteryChemistry ?? 'li-ion') as BatteryChemistry
    const kgPerWh = kgPerWhByChem[chem] ?? kgPerWhByChem['li-ion']
    return battCapacity * kgPerWh
  })

  // Power estimate
  const powerW = computed(() => {
    const originalBatteryMassKg = 1.152 * 2 // default battery pack mass
    const totalExtraMass = payloadKg.value + (batteryMassKg.value - originalBatteryMassKg)
    const pAt1 = Math.max(5, basePowerAtOneMs + massSlopeWPerKg1Mps * totalExtraMass)
    const speed = Math.max(0.1, speedMps.value)
    return pAt1 * Math.pow(speed / 1.0, speedExponent)
  })

  // Estimate mission time with added penalties
  const missionETASeconds = computed(() => {
    if (speedMps.value <= 0) return NaN
    return missionLengthMeters.value / speedMps.value + turnPenaltySeconds.value
  })

  // Energy consumption estimate (Wh)
  const missionEnergyWh = computed(() => {
    if (!isFinite(missionETASeconds.value)) return NaN
    return (powerW.value * missionETASeconds.value) / 3600
  })

  // Coverage area (surveys only for now)
  const missionCoverageAreaM2 = computed(() => {
    const areasMap = missionStore.surveyAreaM2ById as Record<string, number>
    if (areasMap && Object.keys(areasMap).length > 0) {
      return Object.values(areasMap).reduce((acc, v) => acc + (Number(v) || 0), 0)
    }

    const anyStore = missionStore as any
    const surveys = Array.isArray(anyStore.surveys) ? anyStore.surveys : []
    if (surveys.length > 0) {
      return surveys.reduce((acc: number, s: any) => {
        const poly = (s.polygonCoordinates || []) as LatLng[]
        return acc + polygonAreaM2(poly)
      }, 0)
    }

    const wps = missionStore.currentPlanningWaypoints || []
    if (wps.length >= 3) {
      const first = wps[0].coordinates as LatLng
      const last = wps[wps.length - 1].coordinates as LatLng
      if (calculateHaversineDistance(first, last) < 3) {
        return polygonAreaM2(wps.map((w) => w.coordinates as LatLng))
      }
    }
    return 0
  })

  // String formatting
  const totalMissionLength = computed(() => formatMetersShort(missionLengthMeters.value))
  const timeToCompleteMission = computed(() => formatSeconds(missionETASeconds.value))
  const totalEnergy = computed(() => formatWh(missionEnergyWh.value))
  const totalSurveyCoverage = computed(() => formatArea(missionCoverageAreaM2.value))

  return {
    missionLengthMeters,
    missionETASeconds,
    missionEnergyWh,
    missionCoverageAreaM2,
    powerW,
    speedMps,
    totalMissionLength,
    timeToCompleteMission,
    totalEnergy,
    totalSurveyCoverage,
    turnPenaltySeconds,
  }
}
