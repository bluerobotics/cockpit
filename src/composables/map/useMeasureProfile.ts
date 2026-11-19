import { watchDebounced } from '@vueuse/core'
import { type Ref, type ShallowRef, ref, shallowRef } from 'vue'

import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { type RadioLinkSignal, MissionCoverageRisk, radioLinkSignal } from '@/libs/baseStation/missionPathSignal'
import { type ProfileSlope, measureCornerHeights, measureProfileSamples, profileSlope } from '@/libs/map/measure'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { linkClearance, sightStations } from '@/libs/terrain/line-of-sight'
import {
  type ProfilePoint,
  type TerrainProfileSample,
  densifyPath,
  legLengthM,
  profileSpacingM,
} from '@/libs/terrain/mission-profile'
import { vehicleAntennaHeightM } from '@/libs/terrain/sight-analysis'
import { useTerrainStore } from '@/stores/terrain'
import { BaseStationCommsType } from '@/types/baseStation'
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
  /** Signal of the base station's radio between the line's ends, null without a radio base station. */
  signal: RadioLinkSignal | null
}

/** Return type of {@link useMeasureProfile}. */
export interface UseMeasureProfileReturn {
  /** The profile of the latest finished line, null for none. */
  profile: ShallowRef<MeasureProfile | null>
  /** Whether the profile is being read. */
  loading: Ref<boolean>
}

/**
 * Reads the terrain along a measured line: its elevation or depth profile, the slope of the ground, and, with a radio
 * base station set up, the signal its radio would have between the line's ends.
 * @param {Readonly<Ref<MapMeasureVertex[]>>} vertices The line's corners.
 * @param {() => boolean} active Whether its profile is wanted.
 * @returns {UseMeasureProfileReturn} The profile.
 */
export const useMeasureProfile = (
  vertices: Readonly<Ref<MapMeasureVertex[]>>,
  active: () => boolean
): UseMeasureProfileReturn => {
  const terrainStore = useTerrainStore()
  const baseStation = useBaseStation()
  const profile = shallowRef<MeasureProfile | null>(null)
  const loading = ref(false)
  let latestRun = 0

  const hasRadioLink = (): boolean =>
    baseStation.activePosition !== undefined && baseStation.config.commsType === BaseStationCommsType.RadioLink

  // An end snapped to the base station holds its radio, otherwise the line is read from its start.
  const readSignal = async (
    corners: MapMeasureVertex[],
    heightsM: (number | null)[],
    waterLevelM: number
  ): Promise<RadioLinkSignal> => {
    const config = baseStation.config
    const lastIndex = corners.length - 1
    const [baseIndex, remoteIndex] = corners[lastIndex].kind === 'base-station' ? [lastIndex, 0] : [0, lastIndex]
    const [base, remote] = [corners[baseIndex], corners[remoteIndex]]
    const baseHeightM = heightsM[baseIndex]
    const remoteHeightM = heightsM[remoteIndex]
    if (baseHeightM == null || remoteHeightM == null) {
      return { powerDbm: null, risk: MissionCoverageRisk.Unknown }
    }
    const baseAntennaM = base.kind === 'base-station' ? 0 : config.baseStationAntennaHeightMeters
    const remoteAntennaM = remote.kind === 'vehicle' ? 0 : vehicleAntennaHeightM(config.vehicleHasBlueBoatAntennaMast)
    const sight = sightStations(base.coordinates, remote.coordinates)
    const sightGroundM = await sampleTerrain(
      sight.map((station) => station.coordinates),
      { mode: 'highest' }
    )
    const frequencyMhz = terrainStore.settings.radioFrequencyMhz
    const fresnelRatio = linkClearance(
      { coordinates: base.coordinates, heightAmslM: baseHeightM + baseAntennaM },
      { coordinates: remote.coordinates, heightAmslM: remoteHeightM + remoteAntennaM },
      { stations: sight, groundM: sightGroundM },
      frequencyMhz,
      waterLevelM
    )
    return radioLinkSignal(config, base.coordinates, remote.coordinates, fresnelRatio, frequencyMhz)
  }

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
      signal: hasRadioLink() ? await readSignal(corners, heightsM, waterLevelM) : null,
    }
  }

  const radioInputs = (): unknown[] => {
    const { commsType, txPowerMilliwatts, antenna, baseStationAntennaHeightMeters, vehicleHasBlueBoatAntennaMast } =
      baseStation.config
    return [
      baseStation.activePosition,
      commsType,
      txPowerMilliwatts,
      antenna.gain,
      antenna.range,
      antenna.bearing,
      antenna.beamwidth,
      baseStationAntennaHeightMeters,
      vehicleHasBlueBoatAntennaMast,
      terrainStore.settings.radioFrequencyMhz,
    ]
  }

  watchDebounced(
    [vertices, active, radioInputs],
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
