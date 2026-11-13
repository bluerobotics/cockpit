<template>
  <div class="flex flex-col gap-y-1.5 text-xs">
    <div class="grid grid-cols-2 gap-x-4 gap-y-1">
      <span class="opacity-70">{{ t`Water level now` }}</span>
      <span class="text-right">{{ terrainStore.waterLevelNowM().toFixed(2) }} m</span>
      <span class="opacity-70">{{ t`Draft and minimum under the keel` }}</span>
      <span class="flex items-center justify-end gap-x-1">
        <v-btn
          icon
          variant="text"
          size="x-small"
          class="-my-2"
          :aria-label="t`Change the draft and minimum under the keel in the mission settings`"
          @click="onOpenMissionSettings"
        >
          <v-icon icon="mdi-cog" size="14" />
          <v-tooltip activator="parent" location="top" :text="t`Change in the mission settings`" />
        </v-btn>
        {{ terrainStore.settings.vesselDraftM }} m, {{ terrainStore.settings.minimumUnderKeelM }} m
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div class="flex grow items-center gap-x-1 min-w-[220px]">
        <span class="text-slate-200">{{ t`Tide station` }}</span>
        <v-select
          :model-value="tide.automatic.value ? '' : terrainStore.settings.tideStationId"
          :items="stationOptions"
          :loading="tide.findingStations.value"
          :aria-label="t`Tide station`"
          density="compact"
          variant="plain"
          hide-details
          theme="dark"
          class="station-select grow rounded-sm bg-[#FFFFFF22] px-1"
          @update:model-value="onSelectStation"
        />
      </div>
      <InputField
        :model-value="dayText"
        type="date"
        :label="t`Mission date`"
        size="extra-compact"
        :min="format(Date.now(), 'yyyy-MM-dd')"
        :max="format(addDays(Date.now(), MAX_TIDE_DAYS_AHEAD), 'yyyy-MM-dd')"
        @update:model-value="onSelectDay"
      />
    </div>

    <p v-if="problem" class="flex items-center gap-x-2 text-[#FF8A80]">
      <span class="grow">{{ problem }}</span>
      <v-btn variant="flat" size="x-small" class="bg-[#FFFFFF22]" @click="onRetry">{{ t`Retry` }}</v-btn>
    </p>
    <p v-else class="flex items-center gap-x-1 text-[10px] opacity-60 leading-snug">
      <span>{{ stationNote }}</span>
      <InfoTooltip v-if="tide.station.value?.attribution" :label="t`Tide data credit`">
        {{ tide.station.value.attribution }}
      </InfoTooltip>
    </p>

    <TerrainTideChart
      v-if="dayPredictions.length > 1"
      :predictions="dayPredictions"
      :day-start-ms="tide.dayStartMs.value"
      :starts="chartStarts"
      :best-ms="bestStart?.departureMs ?? null"
      :heading="t`Mission start on ${missionDayLabel}`"
    />
    <p v-else-if="terrainStore.loadingTide" class="opacity-70">{{ t`Reading the tide...` }}</p>
  </div>
</template>

<script setup lang="ts">
import { addDays, format, parse, startOfDay } from 'date-fns'
import { t } from 'ttag'
import { computed } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import InputField from '@/components/InputField.vue'
import TerrainTideChart from '@/components/terrain/TerrainTideChart.vue'
import { goToMenuPage } from '@/composables/menuRouting'
import { MAX_TIDE_DAYS_AHEAD, TIDE_STATION_RADIUS_KM } from '@/composables/terrain/useMissionTide'
import { useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { legLengthM } from '@/libs/terrain/mission-profile'
import { type DepartureClearance, type TideChartStart, departureClearances } from '@/libs/terrain/water-level'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import { SubMenuComponentName } from '@/types/general'

// A boat's typical mission speed, used when the mission does not set one.
const FALLBACK_SPEED_MS = 1.5
const DAY_MS = 24 * 60 * 60 * 1000

const terrainStore = useTerrainStore()
const missionStore = useMissionStore()
const dock = useTerrainDock()
const tide = dock.tide

const kmFromMission = (coordinates: [number, number]): number | null => {
  const from = dock.terrain.points()[0]?.coordinates
  return from ? Math.round(legLengthM(from, coordinates) / 1000) : null
}

const stationOptions = computed(() => {
  const nearest = tide.stations.value[0]
  const automatic = { title: nearest ? t`Nearest: ${nearest.name}` : t`Nearest to the mission`, value: '' }
  const picked = terrainStore.settings.tideStationId
  const listed = tide.stations.value.map(({ id, name, coordinates }) => {
    const km = kmFromMission(coordinates)
    return { title: km === null ? name : `${name}, ${km} km`, value: id }
  })
  const missing = !tide.automatic.value && !listed.some(({ value }) => value === picked)
  return [automatic, ...listed, ...(missing ? [{ title: tide.station.value?.name ?? picked, value: picked }] : [])]
})

const dayText = computed(() => format(tide.dayStartMs.value, 'yyyy-MM-dd'))
const missionDayLabel = computed(() => format(tide.dayStartMs.value, 'EEE d MMM'))

const problem = computed(() => {
  if (tide.stationsError.value) return t`Could not look up the tide stations: ${tide.stationsError.value}`
  if (terrainStore.tideError) return t`Could not read the tide: ${terrainStore.tideError}`
  return ''
})

const stationNote = computed(() => {
  const station = tide.station.value
  if (!station) {
    if (tide.findingStations.value) return t`Looking for the tide stations near the mission...`
    return t`No tide station within ${TIDE_STATION_RADIUS_KM} km of the mission. The water level is the offset set in the terrain settings.`
  }
  const km = kmFromMission(station.coordinates)
  return km === null
    ? t`Predicted tide at ${station.name}. Wind and pressure can move the real water by tens of centimeters.`
    : t`Predicted tide at ${station.name}, ${km} km from the mission. Wind and pressure can move the real water by tens of centimeters.`
})

const dayPredictions = computed(() => {
  const fromMs = tide.dayStartMs.value
  const { waterLevelOffsetM } = terrainStore.settings
  // A start late in the day still needs the tide until the mission ends, the next day.
  return terrainStore.tidePredictions
    .filter(({ timeMs }) => timeMs >= fromMs && timeMs <= fromMs + 2 * DAY_MS)
    .map((point) => ({ ...point, levelM: point.levelM + waterLevelOffsetM }))
})

const starts = computed<DepartureClearance[]>(() => {
  const samples = dock.terrain.analysis.value?.profile.samples ?? []
  const speed = missionStore.plannedCruiseSpeed ?? missionStore.defaultCruiseSpeed ?? FALLBACK_SPEED_MS
  const fromMs = tide.dayStartMs.value
  return departureClearances(samples, dayPredictions.value, speed, terrainStore.settings.vesselDraftM).filter(
    ({ departureMs }) => departureMs >= fromMs && departureMs < fromMs + DAY_MS
  )
})

const bestStart = computed(() => {
  const now = Date.now()
  return starts.value.reduce<DepartureClearance | undefined>((best, start) => {
    if (start.departureMs < now || start.minUnderKeelM === null) return best
    return !best || start.minUnderKeelM > (best.minUnderKeelM ?? -Infinity) ? start : best
  }, undefined)
})

const startColor = (underKeelM: number | null): string => {
  if (underKeelM === null) return '#FFFFFF22'
  if (underKeelM < 0) return '#FF5252'
  return underKeelM < terrainStore.settings.minimumUnderKeelM ? '#FF8800' : '#66BB6A'
}

const startText = (underKeelM: number | null): string => {
  if (underKeelM === null) return t`depth unknown`
  const depthM = Math.abs(underKeelM).toFixed(1)
  return underKeelM < 0 ? t`aground by ${depthM} m` : t`${depthM} m under the keel`
}

const chartStarts = computed<TideChartStart[]>(() =>
  starts.value.map(({ departureMs, minUnderKeelM }) => ({
    timeMs: departureMs,
    color: startColor(minUnderKeelM),
    text: startText(minUnderKeelM),
  }))
)

const onOpenMissionSettings = (): void => {
  logUserAction('Opened mission settings from the terrain tide tab')
  goToMenuPage(SubMenuComponentName.SettingsMission)
}

const onSelectStation = (id: string | null): void => {
  terrainStore.settings.tideStationId = id ?? ''
  const name = tide.stations.value.find((station) => station.id === id)?.name
  logUserAction(id ? `Picked the tide station "${name ?? id}"` : 'Set the tide station to the nearest one')
}

const onSelectDay = (text: string | null): void => {
  if (!text) return
  const day = startOfDay(parse(text, 'yyyy-MM-dd', new Date()))
  const lastMs = startOfDay(addDays(Date.now(), MAX_TIDE_DAYS_AHEAD)).getTime()
  if (!Number.isFinite(day.getTime())) return
  logUserAction(`Set the tide mission date to ${text}`)
  tide.dayStartMs.value = Math.min(Math.max(day.getTime(), startOfDay(Date.now()).getTime()), lastMs)
}

const onRetry = (): void => {
  logUserAction('Retried reading the tide')
  tide.retry()
}
</script>

<style scoped>
/* Brings the select down to the height of the extra-compact inputs beside it. The waypoint panel's unscoped
   `.v-field` font size is `!important`, so this one has to be too. */
.station-select :deep(.v-field) {
  font-size: 12px !important;
}
.station-select :deep(.v-field__input) {
  min-height: 0;
  padding-top: 1px;
  padding-bottom: 1px;
}
.station-select :deep(.v-field__append-inner) {
  padding-top: 0;
  align-items: center;
}
</style>
