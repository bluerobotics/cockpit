<template>
  <div class="flex flex-col gap-y-2 text-xs">
    <span class="flex items-center gap-x-1 font-medium">
      {{ t`Surveys` }}
      <InfoTooltip :label="t`Survey checks information`">
        {{ t`Checks each survey of the mission against the terrain under it.` }}
        <template v-if="isAircraft">
          <br />
          <strong>{{ t`Photo quality:` }}</strong>
          {{
            t`image detail in centimeters per pixel, from the imaging sensor picked in Settings > Mission > Survey sensors and the height over the ground along the lines.
              Ground that rises under the survey sharpens the images but narrows each photo, so the side overlap between neighboring lines drops; the target overlap comes
              from the sensor settings.`
          }}
          <br />
          <strong>{{ t`Constant image scale:` }}</strong>
          {{
            t`setting the survey to "Relative to terrain" and turning on "Hold terrain height on upload" keeps the same height over the ground, and so the same detail,
              all along it.`
          }}
          <br />
          <strong>{{ t`Re-space for terrain:` }}</strong>
          {{
            t`replaces the survey's lines with lines spaced so the photos cover the whole area with the target overlap over the real ground, closer where it rises toward
              the aircraft. Undo brings the previous lines back.`
          }}
        </template>
        <template v-else-if="isMarine">
          <br />
          <strong>{{ t`Re-space for depth:` }}</strong>
          {{
            t`replaces the survey's lines with lines spaced so the strip the sensor sees on the bottom covers the whole area at the depth along each line, with the
              sensor's overlap. Deeper water gives a wider strip and fewer lines. Undo brings the previous lines back.`
          }}
        </template>
        <template v-if="isAircraft || isMarine">
          <br />
          <strong>{{ t`Slopes:` }}</strong>
          {{
            t`re-spacing turns the lines along the slope's contours when the ground or bottom changes height enough across the area, so each line keeps one height over
              it. A strip narrows on the side where the slope rises and widens where it falls away.`
          }}
          <br />
          <strong>{{ t`Sensor compensation:` }}</strong>
          {{
            t`re-spacing here, or the radar button in the survey's radial menu, turns it on for that sensor: the survey is re-spaced automatically after every edit and
              every change to the sensor's settings, and the covered strips are drawn in purple on the map. Only those two commands turn the lines along the slope; later
              edits keep the angle you set.`
          }}
          <br />
          <strong>{{ t`Sensors:` }}</strong>
          {{ t`picked in Settings > Mission > Survey sensors, with how each one is mounted on the vehicle.` }}
        </template>
        <template v-else>
          <br />
          {{
            t`There are no survey checks for this vehicle type; they cover aircraft photo surveys and boat or submarine bottom surveys.`
          }}
        </template>
      </InfoTooltip>
    </span>
    <p v-if="surveys.length === 0" class="opacity-70">
      {{ t`Draw a survey to judge its photo quality over the terrain, or to re-space its lines for the depth.` }}
    </p>
    <p v-else-if="spacingSensors.length > 0" class="text-[10px] opacity-60 leading-snug">
      {{
        t`On surveys with sensor compensation on, the purple area on the map is what each sensor probably covers. Its dashed line is where the sensor is aimed, off the
          survey path by its mount and view.`
      }}
    </p>
    <div
      v-for="row in surveys"
      :key="row.survey.id"
      class="flex flex-col gap-y-1 rounded-md px-2.5 py-1 bg-[#FFFFFF11]"
    >
      <div class="flex items-center justify-between">
        <span class="font-medium">{{ row.title }}</span>
        <span class="opacity-70">{{ row.summary }}</span>
      </div>
      <p v-if="isAircraft && !camera" class="opacity-70">
        {{ t`Pick an imaging sensor in the survey sensor settings to judge this survey's photo quality.` }}
      </p>
      <p v-if="isMarine && spacingSensors.length === 0" class="opacity-70">
        {{
          t`Pick an echo sounder or an imaging sensor in the survey sensor settings to re-space this survey for the depth.`
        }}
      </p>
      <template v-if="isAircraft && camera">
        <p v-if="camera.unsuitedReason" class="text-[#FF8800]">{{ camera.label }}: {{ camera.unsuitedReason }}</p>
        <p v-else-if="(row.quality?.minAglM ?? 1) < 1" class="text-[#FF8800]">
          {{
            t`Part of this survey reaches the ground, so its photo quality cannot be judged. Raise it or set it to "Relative to terrain".`
          }}
        </p>
        <p v-else-if="row.quality">
          {{ row.qualityText }}
          <span :class="row.overlapLow ? 'text-[#FF8800]' : ''">{{ row.overlapText }}</span>
        </p>
        <p v-else class="opacity-70">{{ t`The height over the ground along this survey is not known yet.` }}</p>
        <p v-if="!row.followsTerrain" class="text-[10px] opacity-60 leading-snug">
          {{
            t`For constant image scale, set this survey's altitude to "Relative to terrain" and turn on "Hold terrain height on upload" in the terrain settings.`
          }}
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
          <span class="grow opacity-70">{{ sensorText(sensor) }}</span>
          <LoadingText v-if="respacingId === `${row.survey.id}:${sensor.label}`">{{ t`Re-spacing` }}</LoadingText>
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
            {{ isAircraft ? t`Re-space for terrain` : t`Re-space for depth` }}
          </v-btn>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { msgid, ngettext, t } from 'ttag'
import { computed, ref } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import LoadingText from '@/components/LoadingText.vue'
import { openSnackbar } from '@/composables/snackbar'
import { SURVEY_FOOTPRINT_COLORS } from '@/composables/terrain/useSurveyFootprints'
import { useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { type PhotoSurveyQuality, photoSurveyQuality } from '@/libs/terrain/survey-analysis'
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

const surveySummary = (survey: Survey): string => {
  const count = survey.waypoints.length
  const spacing = survey.distanceBetweenLines
  const waypoints = ngettext(msgid`${count} waypoint`, `${count} waypoints`, count)
  return survey.sensorCompensation ? t`${waypoints}, spaced for the sensor` : t`${waypoints}, lines ${spacing} m apart`
}

const qualityText = ({ finestGsdCm, coarsestGsdCm, minAglM, maxAglM }: PhotoSurveyQuality): string => {
  const finest = finestGsdCm.toFixed(1)
  const coarsest = coarsestGsdCm.toFixed(1)
  const lowest = Math.round(minAglM)
  const highest = Math.round(maxAglM)
  return t`${finest} to ${coarsest} cm per pixel, flying ${lowest} to ${highest} m over the ground.`
}

// The overlap is judged against `distanceBetweenLines`, which a survey spaced for the camera no longer keeps.
const overlapText = (survey: Survey, quality: PhotoSurveyQuality, target: number): string => {
  if (survey.sensorCompensation === 'camera') return t`Lines spaced for ${target}% side overlap.`
  const overlap = Math.round(quality.lowestSideOverlapPercent)
  return t`Side overlap drops to ${overlap}% (target ${target}%).`
}

const sensorText = ({ label, rangeM, overlapPercent }: ResolvedSurveySensor): string =>
  t`${label}, ${rangeM} m range, ${overlapPercent}% overlap`

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
    const quality =
      camera.value?.geometry && camera.value.imageWidthPx
        ? photoSurveyQuality(
            samples,
            survey.distanceBetweenLines,
            camera.value.geometry.acrossDeg,
            camera.value.imageWidthPx
          )
        : null
    const target = camera.value?.overlapPercent ?? 0
    const number = index + 1
    return {
      survey,
      number,
      title: t`Survey ${number}`,
      summary: surveySummary(survey),
      quality,
      qualityText: quality ? qualityText(quality) : '',
      overlapText: quality ? overlapText(survey, quality, target) : '',
      overlapLow: !!quality && survey.sensorCompensation !== 'camera' && quality.lowestSideOverlapPercent < target,
      followsTerrain: survey.waypoints[0]?.altitudeReferenceType === AltitudeReferenceType.RELATIVE_TO_TERRAIN,
    }
  })
)

const onRespace = async (survey: Survey, number: number, sensor: ResolvedSurveySensor): Promise<void> => {
  const { label, geometry } = sensor
  logUserAction(
    `Re-spaced survey ${number} for the ${isAircraft.value ? 'terrain' : 'depth'} with the ${geometry?.kind}`
  )
  respacingId.value = `${survey.id}:${label}`
  try {
    const { mission, lines, turned } = await dock.respaceSurvey(toPlain(survey), sensor, true)
    const message = turned
      ? t`Survey ${number} re-spaced to ${lines} lines with the ${label}, turned along the slope.`
      : t`Survey ${number} re-spaced to ${lines} lines with the ${label}.`
    dock.replaceMission(mission, message)
  } catch (error) {
    const reason = (error as Error).message
    openSnackbar({ variant: 'error', message: t`Could not re-space survey ${number}. ${reason}`, duration: 5000 })
  } finally {
    respacingId.value = null
  }
}
</script>
