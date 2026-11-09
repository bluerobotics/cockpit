<template>
  <div class="flex flex-col gap-y-2 text-xs">
    <div class="flex flex-col gap-y-1 rounded-md px-2.5 py-1 bg-[#FFFFFF11]">
      <div class="flex items-center gap-x-1 min-h-[22px]">
        <span class="font-medium">{{ t`Radio link from the base station` }}</span>
        <InfoTooltip :label="t`Radio link check information`">
          {{
            t`Checks the straight line from the base antenna (${baseStation.config.baseStationAntennaHeightMeters} m up)
            to the vehicle at ${terrainStore.settings.radioFrequencyMhz} MHz, with the earth's curve and the space the
            signal needs around that line. Buildings and trees are only seen by the surface model.`
          }}
          <br />
          {{
            t`The result tells how much of the mission keeps a clear link and where the terrain comes closest. Stretches
            where the terrain takes more than ${degradedSharePercent}% of that space are listed in Findings. The antenna
            height and the vehicle mast come from the base station settings.`
          }}
        </InfoTooltip>
        <span class="grow" />
        <v-btn
          v-if="dock.linkStations.value.length > 0"
          variant="text"
          size="x-small"
          class="mr-4 translate-y-px rounded-md !text-[8px]"
          @click="onClearLink"
        >
          {{ t`Clear` }}
        </v-btn>
        <LoadingText v-if="checkingLink">{{ t`Checking the link` }}</LoadingText>
        <v-btn
          v-else
          variant="text"
          size="x-small"
          class="rounded-md"
          :disabled="!basePosition || !hasProfile"
          @click="onCheckLink"
        >
          {{ t`Check link` }}
        </v-btn>
      </div>
      <div class="flex flex-col gap-y-1 px-7 mt-[5px] mb-[3px]">
        <NumberInputField
          v-model="terrainStore.settings.radioFrequencyMhz"
          :label="t`Radio frequency`"
          unit="MHz"
          size="extra-compact"
          :min="100"
          :max="10000"
          @update:model-value="onSetNumber('radioFrequencyMhz', $event)"
        />
        <p v-if="!basePosition" class="opacity-70">
          {{ t`Place the base station on the map to check the radio link.` }}
        </p>
        <p v-else-if="dock.linkStations.value.length > 0">{{ linkSummary }}</p>
      </div>
    </div>

    <div class="flex flex-col gap-y-1 rounded-md px-2.5 py-1 bg-[#FFFFFF11]">
      <div class="flex items-center gap-x-1 min-h-[22px]">
        <span class="font-medium">{{ t`Visual line of sight` }}</span>
        <InfoTooltip :label="t`Visual line of sight information`">
          {{ t`Shows where people on the ground can still see the vehicle, with the terrain in the way.` }}
          <br />
          <strong>{{ t`Observers:` }}</strong>
          {{
            t`"Add observer", then click the map where a person stands. Eyes is their eye height above the ground. The base station, when placed, is always an observer.`
          }}
          <br />
          <strong>{{ t`Visual range:` }}</strong>
          {{ t`farthest distance an observer can still make out the vehicle.` }}
          <br />
          <strong>{{ t`Cloud base:` }}</strong>
          {{ t`height above the observers where the vehicle disappears into clouds. 0 means a clear sky.` }}
          <br />
          <strong>{{ t`Map colors:` }}</strong>
          {{
            t`the mission line is green where an observer sees the vehicle at its planned height, orange where it flies
            too low to be seen and red where no observer can see it at any height. Around it, the map is clear where the
            vehicle is seen even on the surface, warming to orange as it must climb to be seen and red where nobody sees
            it. Pointing at a color marks those stretches on the chart. For aircraft, stretches out of everyone's sight
            are listed in Findings.`
          }}
        </InfoTooltip>
        <span class="grow" />
        <v-btn
          v-if="dock.visibility.value"
          variant="text"
          size="x-small"
          class="mr-4 translate-y-px rounded-md !text-[8px]"
          @click="onClearSight"
        >
          {{ t`Clear` }}
        </v-btn>
        <LoadingText v-if="computingSight">{{ t`Working out the sight lines` }}</LoadingText>
        <v-btn
          v-else
          variant="text"
          size="x-small"
          class="rounded-md"
          :disabled="dock.sightObservers.value.length === 0"
          @click="onComputeSight"
        >
          {{ t`Show where the vehicle stays in sight` }}
        </v-btn>
      </div>
      <div class="flex flex-col gap-y-1 px-7 mt-[5px] mb-[3px]">
        <NumberInputField
          v-model="terrainStore.settings.visualRangeM"
          :label="t`Visual range`"
          unit="m"
          size="extra-compact"
          :min="50"
          :max="20000"
          :step="10"
          @update:model-value="onSetNumber('visualRangeM', $event)"
        />
        <NumberInputField
          v-model="terrainStore.settings.cloudBaseM"
          :label="t`Cloud base above the observers`"
          :info="t`0 means a clear sky.`"
          unit="m"
          size="extra-compact"
          :min="0"
          :max="5000"
          :step="10"
          class="mb-[5px]"
          @update:model-value="onSetNumber('cloudBaseM', $event)"
        />
        <div v-if="basePosition" class="flex items-center gap-x-2 min-h-[26px] rounded-md px-2.5 bg-[#FFFFFF11]">
          <v-icon icon="mdi-radio-tower" size="14" color="#43A047" />
          <span class="grow">{{ t`Base station` }}</span>
          <span class="opacity-70">{{ t`Eyes ${DEFAULT_EYE_HEIGHT_M} m, moves with the base station` }}</span>
        </div>
        <div
          v-for="(observer, index) in terrainStore.settings.visualObservers"
          :key="index"
          class="flex items-center gap-x-2 min-h-[26px] rounded-md px-2.5 bg-[#FFFFFF11]"
        >
          <v-icon icon="mdi-eye-outline" size="14" color="#43A047" />
          <span class="grow">{{ observerName(index) }}</span>
          <NumberInputField
            :model-value="observer.heightAboveGroundM"
            :label="t`Eyes`"
            unit="m"
            size="extra-compact"
            :min="0"
            :max="100"
            :step="0.1"
            @update:model-value="onObserverHeight(index, $event)"
          />
          <v-btn
            icon
            variant="text"
            size="x-small"
            class="!w-[22px] !h-[22px]"
            :aria-label="removeObserverLabel(index)"
            @click="onRemoveObserver(index)"
          >
            <v-icon icon="mdi-close" size="14" />
            <v-tooltip activator="parent" location="top" :text="removeObserverLabel(index)" />
          </v-btn>
        </div>
        <v-btn variant="text" size="x-small" class="self-end rounded-md" :disabled="picking" @click="onAddObserver">
          {{ picking ? t`Click the map` : t`Add observer` }}
        </v-btn>
        <div v-if="dock.visibility.value" class="flex items-center gap-x-3 text-[10px]">
          <span
            v-for="entry in SIGHT_LEGEND"
            :key="entry.kind"
            class="flex items-center gap-x-1 transition-opacity duration-150"
            :class="legendOpacity(entry.kind)"
            @pointerenter="onLegendPointer($event, entry.kind)"
            @pointerleave="onLegendPointer($event, null)"
            @pointerup="onLegendTap($event, entry)"
          >
            <span
              class="w-3 h-3 rounded-sm"
              :class="{ 'ring-1 ring-white': pointedSightKind === entry.kind }"
              :style="{ backgroundColor: PATH_SIGHT_COLORS[entry.kind] }"
            />
            {{ entry.label }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed, onBeforeUnmount, ref } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import LoadingText from '@/components/LoadingText.vue'
import NumberInputField from '@/components/NumberInputField.vue'
import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { openSnackbar } from '@/composables/snackbar'
import { DEFAULT_EYE_HEIGHT_M, useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { paddedBbox } from '@/libs/hazards/hazard-areas'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { checkLineOfSightOnce, visibilitySurface } from '@/libs/terrain/line-of-sight'
import { legLabel, surfaceHeight } from '@/libs/terrain/mission-profile'
import {
  type PathSightKind,
  DEGRADED_FRESNEL_RATIO,
  linkFindings,
  PATH_SIGHT_COLORS,
  pathSight,
  radioLinkAlongPath,
  sampleHeightGrid,
  vehicleSightHeightM,
} from '@/libs/terrain/sight-analysis'
import { useTerrainStore } from '@/stores/terrain'

// Antenna height over the deck, with and without the BlueBoat accessory mast.
const MAST_ANTENNA_M = 1.2
const DECK_ANTENNA_M = 0.4

const terrainStore = useTerrainStore()
const baseStation = useBaseStation()
const dock = useTerrainDock()
const checkingLink = ref(false)
const computingSight = ref(false)
const picking = ref(false)

const SIGHT_LEGEND: {
  /**
   * Kind of stretch the entry stands for.
   */
  kind: PathSightKind
  /**
   * Entry text.
   */
  label: string
}[] = [
  { kind: 'in-sight', label: t`In sight` },
  { kind: 'must-climb', label: t`Must climb to be seen` },
  { kind: 'never-seen', label: t`Never seen` },
]

const basePosition = computed(() => baseStation.activePosition)

// Pointing at a legend entry marks its stretches on the chart, and pointing at the chart marks the entry under it.
const pointedSightKind = computed<PathSightKind | null>(() => {
  if (dock.sightLegendKind.value) return dock.sightLegendKind.value
  const distanceM = dock.hover.value?.distanceM
  if (distanceM === undefined) return null
  return dock.pathSight.value.find(({ fromM, toM }) => distanceM >= fromM && distanceM <= toM)?.kind ?? null
})

const legendOpacity = (kind: PathSightKind): string => {
  if (!pointedSightKind.value) return 'opacity-80'
  return pointedSightKind.value === kind ? 'opacity-100' : 'opacity-50'
}
const hasProfile = computed(() => (dock.terrain.analysis.value?.profile.samples.length ?? 0) > 1)
const degradedSharePercent = Math.round((1 - DEGRADED_FRESNEL_RATIO) * 100)

const observerName = (index: number): string => {
  const observerNumber = index + 1
  return t`Observer ${observerNumber}`
}
const removeObserverLabel = (index: number): string => {
  const observerNumber = index + 1
  return t`Remove observer ${observerNumber}`
}

const linkSummary = computed(() => {
  const stations = dock.linkStations.value.filter((station) => station.fresnelRatio !== null)
  if (stations.length === 0) return t`The terrain between the base and the vehicle is unknown.`
  const clear = stations.filter((station) => station.fresnelRatio! >= DEGRADED_FRESNEL_RATIO).length
  const worst = stations.reduce((low, station) => (station.fresnelRatio! < low.fresnelRatio! ? station : low))
  const points = dock.terrain.analysis.value?.points ?? []
  const where = legLabel(points, worst.legIndex)
  const ratio = Math.round(worst.fresnelRatio! * 100)
  const clearPercent = Math.round((clear / stations.length) * 100)
  return t`${clearPercent}% of the mission has a clear link. Worst from ${where}, at ${ratio}% of the space the signal needs.`
})

const groundAt = async (position: [number, number]): Promise<number> => {
  const [ground] = await sampleTerrain([position], { mode: 'bilinear' })
  if (ground === null) throw new Error(t`the terrain under the base station or an observer could not be read`)
  return surfaceHeight(ground, terrainStore.waterLevelNowM())
}

const onCheckLink = async (): Promise<void> => {
  logUserAction('Checked the radio link along the mission')
  const analysis = dock.terrain.analysis.value
  const base = basePosition.value
  if (!analysis || !base) return
  checkingLink.value = true
  try {
    checkLineOfSightOnce()
    const waterLevelM = terrainStore.waterLevelNowM()
    const baseAmslM = (await groundAt(base)) + baseStation.config.baseStationAntennaHeightMeters
    const antennaM = baseStation.config.vehicleHasBlueBoatAntennaMast ? MAST_ANTENNA_M : DECK_ANTENNA_M
    const vehicleClass = dock.terrain.vehicleClass.value
    const stations = await radioLinkAlongPath(
      { coordinates: base, heightAmslM: baseAmslM },
      analysis.profile.samples,
      (sample) => vehicleSightHeightM(sample, vehicleClass, antennaM, waterLevelM),
      terrainStore.settings.radioFrequencyMhz,
      waterLevelM
    )
    dock.linkStations.value = stations
    dock.linkFindings.value = linkFindings(stations)
    const issues = dock.linkFindings.value.length
    const message =
      issues === 0
        ? t`The radio link stays clear of the terrain along the mission.`
        : t`The terrain gets in the way of the radio link in ${issues} places.`
    openSnackbar({ variant: issues === 0 ? 'success' : 'warning', message, duration: 4000 })
  } catch (error) {
    openSnackbar({ variant: 'error', message: t`Could not check the radio link: ${error}`, duration: 5000 })
  } finally {
    checkingLink.value = false
  }
}

const onAddObserver = async (): Promise<void> => {
  logUserAction('Started placing a visual observer on the map')
  picking.value = true
  openSnackbar({
    variant: 'info',
    message: t`Click the map where the observer stands. Escape cancels.`,
    duration: 4000,
  })
  const position = await dock.pickPoint()
  picking.value = false
  if (!position) {
    logUserAction('Cancelled placing a visual observer')
    return
  }
  terrainStore.settings.visualObservers = [
    ...terrainStore.settings.visualObservers,
    { position, heightAboveGroundM: DEFAULT_EYE_HEIGHT_M },
  ]
  logUserAction('Placed a visual observer on the map')
}

const onRemoveObserver = (index: number): void => {
  terrainStore.settings.visualObservers = terrainStore.settings.visualObservers.filter((_, at) => at !== index)
  logUserAction(`Removed visual observer ${index + 1}`)
}

const onObserverHeight = (index: number, value: number): void => {
  terrainStore.settings.visualObservers = terrainStore.settings.visualObservers.map((observer, at) =>
    at === index ? { ...observer, heightAboveGroundM: value } : observer
  )
  logUserAction(`Set the eye height of visual observer ${index + 1} to ${value} m`)
}

const onSetNumber = (setting: string, value: number): void => logUserAction(`Set ${setting} to ${value}`)

const onComputeSight = async (): Promise<void> => {
  logUserAction('Computed the visual line of sight surface')
  computingSight.value = true
  try {
    const { visualRangeM, cloudBaseM } = terrainStore.settings
    const waterLevelM = terrainStore.waterLevelNowM()
    const observers = dock.sightObservers.value.map(({ position }) => position)
    const grid = await sampleHeightGrid(paddedBbox(observers, visualRangeM))
    const eyes = await Promise.all(
      dock.sightObservers.value.map(async ({ position, heightAboveGroundM }) => ({
        coordinates: position,
        heightAmslM: (await groundAt(position)) + heightAboveGroundM,
      }))
    )
    // Lets the spinner paint before the grid computation holds the thread for a moment.
    await new Promise((resolve) => setTimeout(resolve, 0))
    const surface = visibilitySurface(grid, eyes, visualRangeM, waterLevelM, cloudBaseM)
    dock.visibility.value = surface
    const samples = dock.terrain.analysis.value?.profile.samples ?? []
    const vehicleClass = dock.terrain.vehicleClass.value
    dock.pathSight.value = pathSight(
      surface,
      samples,
      (sample) => vehicleSightHeightM(sample, vehicleClass, 0, waterLevelM),
      waterLevelM
    )
    const hidden = dock.pathSight.value.filter(({ kind }) => kind !== 'in-sight').length
    if (dock.pathSight.value.length === 0) {
      openSnackbar({ variant: 'info', message: t`The map shows where the vehicle can be seen.`, duration: 4000 })
      return
    }
    const message =
      hidden === 0
        ? t`The vehicle stays in sight along the whole mission.`
        : t`The vehicle leaves every observer's sight in ${hidden} places.`
    openSnackbar({ variant: hidden === 0 ? 'success' : 'warning', message, duration: 4000 })
  } catch (error) {
    openSnackbar({ variant: 'error', message: t`Could not compute the line of sight: ${error}`, duration: 5000 })
  } finally {
    computingSight.value = false
  }
}

const onClearLink = (): void => {
  dock.linkStations.value = []
  dock.linkFindings.value = []
  logUserAction('Cleared the radio link check')
}

const onClearSight = (): void => {
  dock.visibility.value = null
  dock.pathSight.value = []
  dock.sightLegendKind.value = null
  logUserAction('Cleared the visual line of sight surface')
}

const onLegendPointer = (event: PointerEvent, kind: PathSightKind | null): void => {
  if (event.pointerType !== 'touch') dock.sightLegendKind.value = kind
}

// Touch has no hover, so a tap marks the entry's stretches until the next tap on it.
const onLegendTap = (event: PointerEvent, entry: (typeof SIGHT_LEGEND)[number]): void => {
  if (event.pointerType !== 'touch') return
  const unmark = dock.sightLegendKind.value === entry.kind
  dock.sightLegendKind.value = unmark ? null : entry.kind
  logUserAction(unmark ? 'Removed the sight legend highlight' : `Marked the "${entry.kind}" stretches of the mission`)
}

onBeforeUnmount(() => (dock.sightLegendKind.value = null))
</script>
