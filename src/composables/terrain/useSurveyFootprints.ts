import { type Ref, onBeforeUnmount, shallowRef, watch } from 'vue'

import type { TerrainMapFootprint } from '@/composables/map/useTerrainMapOverlay'
import type { TerrainVehicleClass } from '@/libs/terrain/mission-profile'
import { surveyFootprints, surveyLineLegs } from '@/libs/terrain/survey-analysis'
import type { ResolvedSurveySensor } from '@/libs/terrain/survey-sensors'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'

import { surveyBottomReading } from './useSurveyCompensation'

/** Purples for the echo sounder and the camera footprints, in the order the sensors are given. */
export const SURVEY_FOOTPRINT_COLORS = ['#AA00FF', '#E040FB']

// Lets a drag or a run of edits settle before the bottom under every survey line is sampled again.
const REFRESH_DELAY_MS = 600

/**
 * Bottom the survey sensors probably cover along the surveys with sensor compensation on, kept up to date.
 * @param {Ref<ResolvedSurveySensor[]>} sensors Sensors fitted to the vehicle.
 * @param {Ref<TerrainVehicleClass>} vehicleClass Vehicle the mission is planned for.
 * @returns {Ref<TerrainMapFootprint[]>} Footprints to draw.
 */
export const useSurveyFootprints = (
  sensors: Ref<ResolvedSurveySensor[]>,
  vehicleClass: Ref<TerrainVehicleClass>
): Ref<TerrainMapFootprint[]> => {
  const missionStore = useMissionStore()
  const terrainStore = useTerrainStore()
  const footprints = shallowRef<TerrainMapFootprint[]>([])
  let run = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const refresh = async (): Promise<void> => {
    const current = ++run
    const pending = sensors.value.flatMap((sensor, index) =>
      missionStore.currentPlanningSurveys.map(async (survey) => {
        const template = survey.waypoints[0]
        if (!survey.sensorCompensation || survey.crosshatch || !sensor.geometry || !template) return []
        const lines = surveyLineLegs(survey.waypoints.map(({ coordinates }) => coordinates))
        const { sampleBottom, heightAboveBottom } = await surveyBottomReading(template, vehicleClass.value)
        const found = await surveyFootprints(lines, sampleBottom, {
          sensor: sensor.geometry,
          rangeM: sensor.rangeM,
          heightAboveBottom,
        })
        return found.map((footprint) => ({ ...footprint, color: SURVEY_FOOTPRINT_COLORS[index % 2] }))
      })
    )
    try {
      const drawn = (await Promise.all(pending)).flat()
      if (current === run) footprints.value = drawn
    } catch {
      if (current === run) footprints.value = []
    }
  }

  watch(
    [
      () => missionStore.currentPlanningSurveys,
      sensors,
      vehicleClass,
      () => terrainStore.settings.vesselDraftM,
      () => missionStore.plannedHomePosition,
    ],
    () => {
      clearTimeout(timer)
      timer = setTimeout(() => void refresh(), REFRESH_DELAY_MS)
    },
    { deep: true, immediate: true }
  )

  onBeforeUnmount(() => {
    clearTimeout(timer)
    run++
  })

  return footprints
}
