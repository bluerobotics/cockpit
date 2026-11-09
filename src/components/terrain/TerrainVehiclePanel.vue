<template>
  <div class="flex flex-col gap-y-3 text-xs">
    <section class="flex flex-col gap-y-1">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-x-1 font-medium">
          {{ t`Measured terrain` }}
          <InfoTooltip :label="t`Measured terrain information`" :max-width="420">
            {{
              t`Builds a map of the real ground or seabed from the vehicle's own downward sonar or rangefinder, kept on this computer across sessions. The switch beside
                this heading turns it off completely: nothing is recorded, the model is used everywhere and these controls are hidden, and what was recorded is kept.`
            }}
            <br />
            <strong>{{ t`Record:` }}</strong>
            {{
              t`each reading becomes a ground height under the vehicle, corrected for its tilt and averaged into cells of about 11 m. It needs a sensor pointing down.
                Readings taken while tilted more than about 20°, flagged as invalid by the sensor, or outside its range are skipped. On boats, the vessel draft from the
                terrain settings is taken as the sonar depth. Rovers are not recorded.`
            }}
            <br />
            <strong>Prefer measurements:</strong> wherever a cell has at least 3 readings, its height replaces the model
            in the profile, the findings and the safe height. A dashed brown line on the profile then shows where the
            model would have put the ground.
            <br />
            <strong>{{ t`Show on the map:` }}</strong>
            {{ t`colored dots on those cells, from the lowest to the highest, while the terrain panel is open.` }}
            <br />
            <strong>{{ t`Compare with the model:` }}</strong>
            {{
              t`median difference between the measured cells and the model, to see how far off the model is in this area, with the model's ground outlined in black along
                the whole profile.`
            }}
            <br />
            <strong>Export</strong> saves every cell as a spreadsheet; <strong>Clear</strong> removes every measurement
            from this computer.
          </InfoTooltip>
        </span>
        <v-switch
          :model-value="terrainStore.settings.measuredTerrainEnabled"
          color="white"
          base-color="#FFFFFF33"
          density="compact"
          hide-details
          inset
          class="origin-right scale-50 -my-3 grow-0"
          :aria-label="t`Use measured terrain`"
          @update:model-value="onToggleSetting('measuredTerrainEnabled', $event === true, 'measured terrain')"
        />
      </div>
      <template v-if="terrainStore.settings.measuredTerrainEnabled">
        <div class="flex items-center justify-between">
          <span class="opacity-70">
            {{ t`Record the ground or seabed under the vehicle` }}
            <span
              v-if="terrainStore.settings.recordMeasuredTerrain"
              :class="terrainStore.receivingRange ? 'text-[#66BB6A]' : 'text-[#FF8800]'"
            >
              ({{ terrainStore.receivingRange ? t`receiving readings` : t`no downward rangefinder or sonar readings` }})
            </span>
          </span>
          <v-switch
            :model-value="terrainStore.settings.recordMeasuredTerrain"
            color="white"
            base-color="#FFFFFF33"
            density="compact"
            hide-details
            inset
            class="origin-right scale-50 -my-3 grow-0"
            :aria-label="t`Record measured terrain`"
            @update:model-value="
              onToggleSetting('recordMeasuredTerrain', $event === true, 'recording measured terrain')
            "
          />
        </div>
        <div class="flex items-center justify-between">
          <span class="opacity-70">{{ t`Prefer measurements over the model where they exist` }}</span>
          <v-switch
            :model-value="terrainStore.settings.useMeasuredTerrain"
            color="white"
            base-color="#FFFFFF33"
            density="compact"
            hide-details
            inset
            class="origin-right scale-50 -my-3 grow-0"
            :aria-label="t`Prefer measured terrain`"
            @update:model-value="onToggleSetting('useMeasuredTerrain', $event === true, 'preferring measured terrain')"
          />
        </div>
        <div class="flex items-center justify-between">
          <span class="opacity-70">{{ t`Show measured cells on the map` }}</span>
          <v-switch
            :model-value="dock.showMeasured.value"
            color="white"
            base-color="#FFFFFF33"
            density="compact"
            hide-details
            inset
            class="origin-right scale-50 -my-3 grow-0"
            :aria-label="t`Show measured cells on the map`"
            @update:model-value="onToggleShowMeasured($event === true)"
          />
        </div>
        <div class="flex items-start gap-x-2 px-2.5 py-1.5 rounded-md bg-[#FFFFFF11] text-[11px]">
          <v-icon icon="mdi-information-outline" size="14" class="mt-px opacity-70" />
          <div class="flex flex-col gap-y-0.5">
            <p class="opacity-80">
              {{ t`${measuredCounts.cells} cells measured, ${measuredCounts.trusted} with enough readings to trust.` }}
            </p>
            <p v-if="biasSummary">{{ biasSummary }}</p>
          </div>
        </div>
        <div class="flex gap-x-2">
          <LoadingText v-if="comparing" class="grow justify-center">{{ t`Comparing` }}</LoadingText>
          <v-btn
            v-else
            variant="flat"
            size="x-small"
            class="grow bg-[#FFFFFF22] disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50 rounded-md"
            :disabled="measuredCounts.trusted === 0"
            @click="onCompare"
          >
            {{ dock.compareModel.value ? t`Hide the comparison` : t`Compare with the model` }}
          </v-btn>
          <v-btn
            variant="flat"
            size="x-small"
            class="grow bg-[#FFFFFF22] disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50 rounded-md"
            :disabled="measuredCounts.trusted === 0"
            prepend-icon="mdi-download"
            @click="onExport"
          >
            Export CSV
          </v-btn>
          <v-btn
            variant="flat"
            size="x-small"
            class="grow bg-[#FFFFFF22] disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50 rounded-md"
            :disabled="measuredCounts.cells === 0"
            prepend-icon="mdi-delete-sweep-outline"
            @click="onClear"
          >
            {{ t`Clear` }}
          </v-btn>
        </div>
      </template>
    </section>

    <v-divider v-if="lengthM > 0" class="opacity-5" />

    <section v-if="lengthM > 0" class="flex flex-col gap-y-1 -mt-2.5">
      <div class="flex items-center gap-x-2">
        <span class="flex items-center gap-x-1 font-medium grow">
          {{ t`Ghost run` }}
          <InfoTooltip :label="t`Ghost run information`">
            {{
              t`Previews the mission: play it at ${GHOST_SPEEDUP} times the planned cruise speed, or drag the slider. A marker follows on the profile and on the map, with
                the time into the mission, the distance along it and the clearance under the vehicle at that point. Nothing is sent to the vehicle.`
            }}
          </InfoTooltip>
        </span>
        <v-btn
          icon
          variant="text"
          size="x-small"
          :aria-label="playing ? t`Pause the ghost run` : t`Play the ghost run`"
          @click="onTogglePlay"
        >
          <v-icon :icon="playing ? 'mdi-pause' : 'mdi-play'" size="16" />
          <v-tooltip
            activator="parent"
            location="top"
            :text="playing ? t`Pause the ghost run` : t`Play the ghost run`"
          />
        </v-btn>
      </div>
      <input
        type="range"
        min="0"
        :max="lengthM"
        step="1"
        :value="dock.ghostDistanceM.value ?? 0"
        :aria-label="t`Ghost run position along the mission`"
        class="w-full accent-[#3B78A8]"
        @input="onScrub"
        @change="onScrubEnd"
      />
      <p v-if="dock.ghostSample.value" class="opacity-80">{{ ghostSummary }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn, useThrottleFn } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { t } from 'ttag'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import LoadingText from '@/components/LoadingText.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { measuredCellCenter, medianOffsetM, trustedCells } from '@/libs/terrain/measured-terrain'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import type { TerrainSettings } from '@/types/terrain'

const GHOST_TICK_MS = 100
// The ghost run plays thirty times faster than the vehicle would fly it.
const GHOST_SPEEDUP = 30
const FALLBACK_SPEED_MS = 5

const terrainStore = useTerrainStore()
const missionStore = useMissionStore()
const dock = useTerrainDock()
const { confirmAction } = useInteractionDialog()
const comparing = ref(false)
const biasSummary = ref<string | null>(null)
const playing = ref(false)

const measuredCounts = ref({ cells: 0, trusted: 0 })
// Counting walks every cell, so it runs at most once a second rather than on each reading.
const refreshMeasuredCounts = useThrottleFn(
  () => {
    measuredCounts.value = { cells: terrainStore.measured.size, trusted: trustedCells(terrainStore.measured).length }
  },
  1000,
  true
)
watch(() => terrainStore.measuredVersion, refreshMeasuredCounts, { immediate: true })

const lengthM = computed(() => Math.round(dock.terrain.analysis.value?.profile.lengthM ?? 0))

const ghostSummary = computed(() => {
  const sample = dock.ghostSample.value
  if (!sample) return ''
  const speed = missionStore.plannedCruiseSpeed ?? FALLBACK_SPEED_MS
  const minutes = Math.floor(sample.distanceM / speed / 60)
  const seconds = Math.round((sample.distanceM / speed) % 60)
  const alongM = Math.round(sample.distanceM)
  if (sample.clearanceM === null)
    return t`${minutes} min ${seconds} s into the mission, ${alongM} m along, unknown clearance.`
  const clearanceM = sample.clearanceM.toFixed(1)
  return t`${minutes} min ${seconds} s into the mission, ${alongM} m along, ${clearanceM} m clearance.`
})

const onToggleSetting = (
  key: keyof Pick<TerrainSettings, 'measuredTerrainEnabled' | 'recordMeasuredTerrain' | 'useMeasuredTerrain'>,
  enabled: boolean,
  label: string
): void => {
  terrainStore.settings[key] = enabled
  logUserAction(`${enabled ? 'Turned on' : 'Turned off'} ${label}`)
}

const onToggleShowMeasured = (shown: boolean): void => {
  dock.showMeasured.value = shown
  logUserAction(`${shown ? 'Showed' : 'Hid'} the measured terrain cells on the map`)
}

const onCompare = async (): Promise<void> => {
  if (dock.compareModel.value) {
    dock.compareModel.value = false
    logUserAction('Hid the terrain model outline on the profile')
    return
  }
  logUserAction('Compared the measured terrain with the terrain model')
  comparing.value = true
  try {
    const cells = trustedCells(terrainStore.measured)
    const model = await sampleTerrain(
      cells.map(([key]) => measuredCellCenter(key)),
      { mode: 'bilinear', modelOnly: true }
    )
    const offset = medianOffsetM(
      cells.map(([, cell]) => cell.sum / cell.count),
      model
    )
    const offsetM = offset === null ? '' : Math.abs(offset).toFixed(1)
    biasSummary.value =
      offset === null
        ? t`The model has no heights where the vehicle measured.`
        : offset >= 0
        ? t`Measured ground sits ${offsetM} m above the model, by the median of ${cells.length} cells.`
        : t`Measured ground sits ${offsetM} m below the model, by the median of ${cells.length} cells.`
    dock.compareModel.value = true
    openSnackbar({ variant: 'info', message: biasSummary.value, duration: 5000 })
  } catch (error) {
    openSnackbar({ variant: 'error', message: t`Could not compare with the model: ${error}`, duration: 5000 })
  } finally {
    comparing.value = false
  }
}

const onExport = (): void => {
  const fileName = `cockpit-measured-terrain-${new Date().toISOString().slice(0, 10)}.csv`
  saveAs(new Blob([terrainStore.measuredCsv()], { type: 'text/csv' }), fileName)
  logUserAction('Exported the measured terrain as CSV')
  openSnackbar({ variant: 'success', message: t`Measured terrain saved as ${fileName}.`, duration: 4000 })
}

const onClear = async (): Promise<void> => {
  logUserAction('Opened the confirmation to clear the measured terrain')
  const confirmed = await confirmAction(
    t`Clear the measured terrain?`,
    t`Every ground and bottom measurement recorded on this computer is removed. Export it first to keep a copy.`,
    t`Clear`,
    '640px'
  )
  if (!confirmed) {
    logUserAction('Canceled clearing the measured terrain')
    return
  }
  logUserAction('Cleared the measured terrain')
  biasSummary.value = null
  dock.compareModel.value = false
  try {
    await terrainStore.clearMeasured()
    openSnackbar({ variant: 'success', message: t`Measured terrain cleared.`, duration: 3000 })
  } catch (error) {
    openSnackbar({
      variant: 'error',
      message: t`Could not clear the stored measured terrain: ${error}`,
      duration: 5000,
    })
  }
}

const { pause, resume } = useIntervalFn(
  () => {
    const speed = missionStore.plannedCruiseSpeed ?? FALLBACK_SPEED_MS
    const next = (dock.ghostDistanceM.value ?? 0) + (speed * GHOST_SPEEDUP * GHOST_TICK_MS) / 1000
    if (next >= lengthM.value) {
      dock.ghostDistanceM.value = lengthM.value
      playing.value = false
      pause()
      return
    }
    dock.ghostDistanceM.value = next
  },
  GHOST_TICK_MS,
  { immediate: false }
)

const onTogglePlay = (): void => {
  playing.value = !playing.value
  logUserAction(`${playing.value ? 'Played' : 'Paused'} the terrain ghost run`)
  if (!playing.value) {
    pause()
    return
  }
  if ((dock.ghostDistanceM.value ?? 0) >= lengthM.value) dock.ghostDistanceM.value = 0
  resume()
}

const onScrub = (event: Event): void => {
  dock.ghostDistanceM.value = Number((event.target as HTMLInputElement).value)
}

const onScrubEnd = (): void => logUserAction(`Moved the terrain ghost run to ${dock.ghostDistanceM.value} m`)

onBeforeUnmount(() => {
  pause()
  dock.ghostDistanceM.value = null
})
</script>
