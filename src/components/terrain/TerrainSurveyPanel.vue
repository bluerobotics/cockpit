<template>
  <div class="flex flex-col gap-y-2 text-xs">
    <span class="flex items-center gap-x-1 font-medium">
      Surveys
      <InfoTooltip label="Survey checks information">
        Checks each survey of the mission against the terrain under it.
        <template v-if="isAircraft">
          <br />
          <strong>Photo quality:</strong> image detail in centimeters per pixel, from the imaging sensor picked in
          Settings &gt; Mission &gt; Survey sensors and the height over the ground along the lines. Ground that rises
          under the survey sharpens the images but narrows each photo, so the side overlap between neighboring lines
          drops; the target overlap comes from the sensor settings.
          <br />
          <strong>Constant image scale:</strong> setting the survey to "Relative to terrain" and turning on "Hold
          terrain height on upload" keeps the same height over the ground, and so the same detail, all along it.
          <br />
          <strong>Re-space for terrain:</strong> replaces the survey's lines with lines spaced so the photos cover the
          whole area with the target overlap over the real ground, closer where it rises toward the aircraft. Undo
          brings the previous lines back.
        </template>
        <template v-else-if="isMarine">
          <br />
          <strong>Re-space for depth:</strong> replaces the survey's lines with lines spaced so the strip the sensor
          sees on the bottom covers the whole area at the depth along each line, with the sensor's overlap. Deeper water
          gives a wider strip and fewer lines. Undo brings the previous lines back.
        </template>
        <template v-if="isAircraft || isMarine">
          <br />
          <strong>Slopes:</strong> re-spacing turns the lines along the slope's contours when the ground or bottom
          changes height enough across the area, so each line keeps one height over it. A strip narrows on the side
          where the slope rises and widens where it falls away.
          <br />
          <strong>Sensor compensation:</strong> re-spacing here, or the radar button in the survey's radial menu, turns
          it on: the survey is re-spaced automatically after every edit, and the covered strips are drawn in purple on
          the map. Only those two commands turn the lines along the slope; later edits keep the angle you set.
          <br />
          <strong>Sensors:</strong> picked in Settings &gt; Mission &gt; Survey sensors, with how each one is mounted on
          the vehicle.
        </template>
        <template v-else>
          <br />
          There are no survey checks for this vehicle type; they cover aircraft photo surveys and boat or submarine
          bottom surveys.
        </template>
      </InfoTooltip>
    </span>
    <p v-if="surveys.length === 0" class="opacity-70">
      Draw a survey to judge its photo quality over the terrain, or to re-space its lines for the depth.
    </p>
    <p v-else-if="spacingSensors.length > 0" class="text-[10px] opacity-60 leading-snug">
      On surveys with sensor compensation on, the purple area on the map is what each sensor probably covers. Its dashed
      line is where the sensor is aimed, off the survey path by its mount and view.
    </p>
    <div
      v-for="row in surveys"
      :key="row.survey.id"
      class="flex flex-col gap-y-1 rounded-md px-2.5 py-1 bg-[#FFFFFF11]"
    >
      <div class="flex items-center justify-between">
        <span class="font-medium">Survey {{ row.number }}</span>
        <span class="opacity-70">
          {{ row.survey.waypoints.length }} waypoints,
          {{
            row.survey.sensorCompensation ? 'spaced for the sensor' : `lines ${row.survey.distanceBetweenLines} m apart`
          }}
        </span>
      </div>
      <div class="flex flex-col gap-y-1 px-7 mt-[5px] mb-[3px] empty:hidden">
        <p v-if="isAircraft && !camera" class="opacity-70">
          Pick an imaging sensor in the survey sensor settings to judge this survey's photo quality.
        </p>
        <p v-if="isMarine && spacingSensors.length === 0" class="opacity-70">
          Pick an echo sounder or an imaging sensor in the survey sensor settings to re-space this survey for the depth.
        </p>
        <template v-if="isAircraft && camera">
          <p v-if="camera.unsuitedReason" class="text-[#FF8800]">{{ camera.label }}: {{ camera.unsuitedReason }}</p>
          <p v-else-if="(row.quality?.minAglM ?? 1) < 1" class="text-[#FF8800]">
            Part of this survey reaches the ground, so its photo quality cannot be judged. Raise it or set it to
            "Relative to terrain".
          </p>
          <p v-else-if="row.quality">
            {{ row.quality.finestGsdCm.toFixed(1) }} to {{ row.quality.coarsestGsdCm.toFixed(1) }} cm per pixel, flying
            {{ Math.round(row.quality.minAglM) }} to {{ Math.round(row.quality.maxAglM) }} m over the ground. Side
            overlap drops to
            <span :class="row.quality.lowestSideOverlapPercent < camera.overlapPercent ? 'text-[#FF8800]' : ''">
              {{ Math.round(row.quality.lowestSideOverlapPercent) }}%
            </span>
            (target {{ camera.overlapPercent }}%).
          </p>
          <p v-else class="opacity-70">The height over the ground along this survey is not known yet.</p>
          <p v-if="!row.followsTerrain" class="text-[10px] opacity-60 leading-snug">
            For constant image scale, set this survey's altitude to "Relative to terrain" and turn on "Hold terrain
            height on upload" in the terrain settings.
          </p>
        </template>
        <template v-for="(sensor, sensorIndex) in spacingSensors" :key="sensor.label">
          <p v-if="sensor.unsuitedReason && !isAircraft" class="text-[#FF8800]">
            {{ sensor.label }}: {{ sensor.unsuitedReason }}
          </p>
          <div class="flex items-center gap-x-2">
            <span
              v-if="sensor.geometry"
              class="w-2 h-2 rounded-full shrink-0"
              :style="{ backgroundColor: SURVEY_FOOTPRINT_COLORS[sensorIndex % 2] }"
            />
            <span class="grow opacity-70">
              {{ sensor.label }}, {{ sensor.rangeM }} m range, {{ sensor.overlapPercent }}% overlap
            </span>
            <LoadingText v-if="respacingId === `${row.survey.id}:${sensor.label}`">Re-spacing</LoadingText>
            <v-btn
              v-else
              variant="flat"
              size="x-small"
              class="bg-[#FFFFFF22] disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50 rounded-md"
              :disabled="
                respacingId !== null ||
                row.survey.polygonCoordinates.length < 3 ||
                !sensor.geometry ||
                !!row.survey.crosshatch
              "
              @click="onRespace(row.survey, row.number, sensor)"
            >
              {{ isAircraft ? 'Re-space for terrain' : 'Re-space for depth' }}
            </v-btn>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import LoadingText from '@/components/LoadingText.vue'
import { openSnackbar } from '@/composables/snackbar'
import { SURVEY_FOOTPRINT_COLORS } from '@/composables/terrain/useSurveyFootprints'
import { useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { photoSurveyQuality } from '@/libs/terrain/survey-analysis'
import { type ResolvedSurveySensor, resolveImagingSensor } from '@/libs/terrain/survey-sensors'
import { toPlain } from '@/libs/utils'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import { type Survey, AltitudeReferenceType } from '@/types/mission'

const terrainStore = useTerrainStore()
const missionStore = useMissionStore()
const dock = useTerrainDock()
const respacingId = ref<string | null>(null)

const isAircraft = computed(() => dock.terrain.vehicleClass.value === 'air')
const isMarine = computed(() => ['surface', 'underwater'].includes(dock.terrain.vehicleClass.value))
const camera = computed(() => resolveImagingSensor(terrainStore.settings.camera, dock.terrain.vehicleClass.value))
const spacingSensors = dock.surveySensors

const surveyRange = (survey: Survey): [number, number] | null => {
  const first = missionStore.currentPlanningWaypoints.findIndex((waypoint) => waypoint.id === survey.waypoints[0]?.id)
  return first < 0 ? null : [first, first + survey.waypoints.length - 1]
}

const surveys = computed(() =>
  missionStore.currentPlanningSurveys.map((survey, index) => {
    const analysis = dock.terrain.analysis.value
    const range = surveyRange(survey)
    const samples =
      analysis && range
        ? analysis.profile.samples.filter((sample) => {
            const from = analysis.points[sample.legIndex]?.waypointIndex
            const to = analysis.points[sample.legIndex + 1]?.waypointIndex
            return from != null && to != null && from >= range[0] && to <= range[1]
          })
        : []
    return {
      survey,
      number: index + 1,
      quality:
        camera.value?.geometry && camera.value.imageWidthPx
          ? photoSurveyQuality(
              samples,
              survey.distanceBetweenLines,
              camera.value.geometry.acrossDeg,
              camera.value.imageWidthPx
            )
          : null,
      followsTerrain: survey.waypoints[0]?.altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_TERRAIN,
    }
  })
)

const onRespace = async (survey: Survey, number: number, sensor: ResolvedSurveySensor): Promise<void> => {
  logUserAction(`Re-spaced survey ${number} for the ${isAircraft.value ? 'terrain' : 'depth'} with the ${sensor.label}`)
  respacingId.value = `${survey.id}:${sensor.label}`
  try {
    const { mission, lines, turned } = await dock.respaceSurvey(toPlain(survey), sensor, true)
    const along = turned ? ', turned along the slope' : ''
    dock.replaceMission(mission, `Survey ${number} re-spaced to ${lines} lines with the ${sensor.label}${along}.`)
  } catch (error) {
    openSnackbar({ variant: 'error', message: `Could not re-space survey ${number}: ${error}`, duration: 5000 })
  } finally {
    respacingId.value = null
  }
}
</script>
