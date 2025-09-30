import { computed, ComputedRef, ref } from 'vue'

import {
  calculateHaversineDistance,
  computeMissionDurationSecondsFromLegs,
  polygonAreaSquareMeters,
} from '@/libs/mission/general-estimates'
import { useMissionStore } from '@/stores/mission'
import { MissionLeg } from '@/types/mission'

type LatLng = [number, number]

const surveyAreaSquareMetersById = ref<Record<string, number>>({})

export const setSurveyAreaSquareMeters = (id: string, areaSquareMeters: number): void => {
  surveyAreaSquareMetersById.value = { ...surveyAreaSquareMetersById.value, [id]: areaSquareMeters }
}

export const removeSurveyAreaSquareMeters = (id: string): void => {
  const next = { ...surveyAreaSquareMetersById.value }
  delete next[id]
  surveyAreaSquareMetersById.value = next
}

export const clearAllSurveyAreas = (): void => {
  surveyAreaSquareMetersById.value = {}
}

/* eslint-disable jsdoc/require-jsdoc */
export const useMissionEstimates = (): {
  missionLengthMeters: ComputedRef<number>
  missionCoverageAreaSquareMeters: ComputedRef<string>
  totalMissionLength: ComputedRef<string>
  totalSurveyCoverage: ComputedRef<string>
  totalMissionDuration: ComputedRef<string>
  missionLegsWithSpeed: ComputedRef<MissionLeg[]>
  formatMetersShort: (distance: number) => string
  formatArea: (area: number) => string
  formatSeconds: (s: number) => string
  formatWh: (energy: number) => string
} => {
  const missionStore = useMissionStore()

  // Mission legs with speed derived from currentPlanningWaypoints and MAVLink command speed changes
  const missionLegsWithSpeed = computed<MissionLeg[]>(() => {
    const wps = missionStore.currentPlanningWaypoints
    if (!Array.isArray(wps) || wps.length < 2) return []

    const draftDefault = Number((missionStore.draftMission as any)?.settings?.defaultCruiseSpeed) || 1

    const legs: MissionLeg[] = []
    for (let i = 0; i < wps.length - 1; i++) {
      const a = wps[i].coordinates
      const b = wps[i + 1].coordinates
      const distanceMeters = calculateHaversineDistance(a, b)

      const candidateA = Number((wps[i] as any)?.speedMps)
      const candidateB = Number((wps[i + 1] as any)?.speedMps)
      const chosen =
        Number.isFinite(candidateA) && candidateA > 0
          ? candidateA
          : Number.isFinite(candidateB) && candidateB > 0
          ? candidateB
          : draftDefault

      const speedMps = Math.max(0.1, chosen)
      legs.push({ distanceMeters, speedMps })
    }
    return legs
  })

  const missionLengthMeters = computed(() => {
    const wps = missionStore.currentPlanningWaypoints || []
    if (wps.length < 2) return 0
    let total = 0
    for (let i = 0; i < wps.length - 1; i++) {
      total += calculateHaversineDistance(wps[i].coordinates as LatLng, wps[i + 1].coordinates as LatLng)
    }
    return total
  })

  // Mission total coverage area (consider polygons if first and last points are < than 100 meters apart)
  const missionCoverageAreaSquareMeters = computed(() => {
    const wps = missionStore.currentPlanningWaypoints || []
    if (wps.length >= 3) {
      const first = wps[0].coordinates as [number, number]
      const last = wps[wps.length - 1].coordinates as [number, number]
      const closedToleranceInMeters = 100
      const distanceToClose = calculateHaversineDistance(first, last)

      if (distanceToClose <= closedToleranceInMeters) {
        const isDuplicate = distanceToClose === 0
        const ring = (isDuplicate ? wps.slice(0, -1) : wps).map((w) => w.coordinates as [number, number])
        const area = polygonAreaSquareMeters(ring)
        return formatArea(area)
      }
    }
    return '—'
  })

  // Total survey coverage from survey areas set in the UI
  const totalSurveyCoverageSquareMeters = computed(() => {
    return Object.values(surveyAreaSquareMetersById.value).reduce((a, b) => a + b, 0)
  })

  const formatMetersShort = (distance: number): string => {
    if (!isFinite(distance) || distance <= 0) return '—'
    if (distance < 1000) return `${distance.toFixed(0)} m`
    return `${(distance / 1000).toFixed(2)} km`
  }

  const formatSeconds = (s: number): string => {
    if (!isFinite(s) || s <= 0) return '—'
    const time = Math.floor(s / 3600)
    const distance = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (time > 0) return `${time}h ${distance}m`
    if (distance > 0) return `${distance}m ${sec}s`
    return `${sec}s`
  }

  const formatWh = (energy: number): string => (energy <= 0 || !isFinite(energy) ? '—' : `${energy.toFixed(2)} Wh`)

  const formatArea = (area: number): string => {
    if (area <= 0 || !isFinite(area)) return '—'
    if (area < 1e6) return `${area.toFixed(0)} m²`
    return `${(area / 1e6).toFixed(3)} km²`
  }

  // String formatting
  const totalMissionLength = computed(() => formatMetersShort(missionLengthMeters.value))
  const totalSurveyCoverage = computed(() => formatArea(totalSurveyCoverageSquareMeters.value))

  // Mission duration (s), without vehicle-specific estimates
  const totalMissionDuration = computed(() => {
    const missionDuration = computeMissionDurationSecondsFromLegs(missionLegsWithSpeed.value)
    return formatSeconds(missionDuration)
  })

  return {
    missionLengthMeters,
    missionCoverageAreaSquareMeters,
    totalMissionLength,
    totalSurveyCoverage,
    totalMissionDuration,
    missionLegsWithSpeed,
    formatMetersShort,
    formatArea,
    formatSeconds,
    formatWh,
  }
}
