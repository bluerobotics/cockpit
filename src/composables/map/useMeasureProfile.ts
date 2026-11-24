import { watchDebounced } from '@vueuse/core'
import { type Ref, type ShallowRef, ref, shallowRef } from 'vue'

import { type ProfileSlope, measureCornerHeights, measureProfileSamples, profileSlope } from '@/libs/map/measure'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import {
  type ProfilePoint,
  type TerrainProfileSample,
  densifyPath,
  legLengthM,
  profileSpacingM,
} from '@/libs/terrain/mission-profile'
import { useTerrainStore } from '@/stores/terrain'
import { AltitudeReferenceType } from '@/types/mission'

import type { MapMeasureVertex } from './useMapMeasure'

/** The terrain along a measured line. */
export interface MeasureProfile {
  /** Profile stations, in order. */
  samples: TerrainProfileSample[]
  /** The line's corners, as the profile chart reads them. */
  points: ProfilePoint[]
  /** Height difference and steepest slope of the ground, null where too little of it is known. */
  slope: ProfileSlope | null
  /** Height of the last corner minus the first, null when either is unknown. */
  endHeightDifferenceM: number | null
}

/** Return type of {@link useMeasureProfile}. */
export interface UseMeasureProfileReturn {
  /** The profile of the latest finished line, null for none. */
  profile: ShallowRef<MeasureProfile | null>
  /** Whether the profile is being read. */
  loading: Ref<boolean>
}

/**
 * Reads the terrain along a measured line: its elevation or depth profile and the slope of the ground.
 * @param {Readonly<Ref<MapMeasureVertex[]>>} vertices The line's corners.
 * @param {() => boolean} active Whether its profile is wanted.
 * @returns {UseMeasureProfileReturn} The profile.
 */
export const useMeasureProfile = (
  vertices: Readonly<Ref<MapMeasureVertex[]>>,
  active: () => boolean
): UseMeasureProfileReturn => {
  const terrainStore = useTerrainStore()
  const profile = shallowRef<MeasureProfile | null>(null)
  const loading = ref(false)
  let latestRun = 0

  const read = async (corners: MapMeasureVertex[]): Promise<MeasureProfile> => {
    const coordinates = corners.map((corner) => corner.coordinates)
    const waterLevelM = terrainStore.waterLevelNowM()
    const lengthM = coordinates.slice(1).reduce((sum, to, index) => sum + legLengthM(coordinates[index], to), 0)
    const spaced = densifyPath(coordinates, profileSpacingM(lengthM))
    const groundM = await sampleTerrain(
      spaced.map((station) => station.coordinates),
      { mode: 'bilinear' }
    )
    const heightsM = measureCornerHeights(
      spaced,
      groundM,
      corners.map((corner) => corner.heightAmslM),
      waterLevelM
    )
    const samples = measureProfileSamples(spaced, groundM, heightsM, waterLevelM)
    const points = corners.map(
      (corner, index): ProfilePoint => ({
        coordinates: corner.coordinates,
        altitude: heightsM[index] ?? 0,
        altitudeReferenceType: AltitudeReferenceType.ABSOLUTE_RELATIVE_TO_MSL,
        waypointIndex: null,
      })
    )
    const first = heightsM[0]
    const last = heightsM.at(-1) ?? null
    return {
      samples,
      points,
      slope: profileSlope(
        samples.map((sample) => sample.distanceM),
        groundM
      ),
      endHeightDifferenceM: first === null || last === null ? null : last - first,
    }
  }

  watchDebounced(
    [vertices, active],
    async ([corners, isActive]) => {
      const run = ++latestRun
      if (!isActive || corners.length < 2) {
        profile.value = null
        loading.value = false
        return
      }
      loading.value = true
      try {
        const result = await read(corners)
        if (run === latestRun) profile.value = result
      } catch (error) {
        if (run === latestRun) profile.value = null
        console.warn('Could not read the terrain along the measured line:', error)
      } finally {
        if (run === latestRun) loading.value = false
      }
    },
    { debounce: 250 }
  )

  return { profile, loading }
}
