<template>
  <div class="flex flex-col gap-y-3 text-xs">
    <section class="flex flex-col gap-y-1">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-x-1 font-medium">
          {{ t`Terrain on the vehicle` }}
          <InfoTooltip :label="t`Terrain on the vehicle information`" :max-width="460">
            <strong>{{ t`What it is for:` }}</strong>
            {{
              t`ArduPilot copters and planes can fly at a height above the ground: waypoints set "Relative to terrain", returning home over hills, and terrain following.
                For that the vehicle needs its own map of ground heights, kept on its SD card. When it has none for an area, it asks the ground station for it.`
            }}
            <br />
            <strong>{{ t`What Cockpit sends:` }}</strong>
            {{
              t`with "Answer the vehicle's terrain requests" on, Cockpit answers from its own terrain model, the source picked in the terrain settings, with measured
                terrain in its place where measurements are preferred. It sends ground heights on the grid the vehicle asks for, every 100 m unless the vehicle is set
                otherwise, taking the highest ground in each spot so it errs on the safe side. Over water it sends the water surface, not the seabed.`
            }}
            <br />
            <strong>{{ t`Only when asked:` }}</strong>
            {{
              t`Cockpit never sends terrain on its own. The vehicle asks for the area around where it is and, once a mission is uploaded, around each waypoint and rally
                point. Terrain has to be enabled on the vehicle (its TERRAIN_ENABLE parameter) for it to ask at all.`
            }}
            <br />
            <strong>{{ t`Flying without Cockpit:` }}</strong>
            {{
              t`the vehicle stores what it receives and keeps using it when the link drops or Cockpit is closed. Before take-off, upload the mission and wait until the
                status below says all the terrain it needs is loaded.`
            }}
            <br />
            <strong>{{ t`Limitations:` }}</strong>
            <ul class="list-disc pl-4">
              <li>
                {{ t`Boats, rovers and submarines do not use this terrain; with them the switch has no effect.` }}
              </li>
              <li>{{ t`Without an SD card, the vehicle keeps the terrain only until it restarts.` }}</li>
              <li>{{ t`The grid is coarse: cliffs, buildings and trees narrower than its spacing are missed.` }}</li>
              <li>
                {{
                  t`Waypoints more than about 3 km apart can leave areas in between the vehicle has not asked for yet. It asks for them in flight, which needs the link.`
                }}
              </li>
              <li>
                {{
                  t`The vehicle's terrain is only as good as the model it came from. "Check waypoints on the vehicle" compares the two.`
                }}
              </li>
            </ul>
          </InfoTooltip>
        </span>
        <span class="flex items-center gap-x-1">
          <InfoTooltip :label="t`Vehicle waypoint check information`">
            {{
              t`Asks the vehicle which ground height it holds under up to ${MAX_CHECKED_WAYPOINTS} of the mission's waypoints, one at a time, and compares it with
                Cockpit's terrain model. It reports how many have terrain on the vehicle and the median difference between the two. A few meters is normal between models;
                a large difference usually means the vehicle's terrain is old or uses another height reference, and its terrain-relative heights are off by that much.`
            }}
          </InfoTooltip>
          <LoadingText v-if="checkingVehicle">{{ t`Checking the vehicle` }}</LoadingText>
          <v-btn
            v-else
            variant="flat"
            size="x-small"
            class="bg-[#FFFFFF22] disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50 rounded-md"
            :disabled="!vehicleStore.isVehicleOnline || missionStore.currentPlanningWaypoints.length === 0"
            @click="onCheckVehicle"
          >
            {{ t`Check waypoints on the vehicle` }}
          </v-btn>
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="opacity-70">{{ t`Answer the vehicle's terrain requests` }}</span>
        <v-switch
          :model-value="terrainStore.settings.serveTerrainToVehicle"
          color="white"
          base-color="#FFFFFF33"
          density="compact"
          hide-details
          inset
          class="origin-right scale-50 -my-3 grow-0"
          :aria-label="t`Answer the vehicle's terrain requests`"
          @update:model-value="
            onToggleSetting('serveTerrainToVehicle', $event === true, 'answering the vehicle terrain requests')
          "
        />
      </div>
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-x-1 opacity-70">
          {{ t`Hold terrain height on upload` }}
          <InfoTooltip :label="t`Hold terrain height on upload information`" :max-width="420">
            {{
              t`At each upload, waypoints set "Relative to terrain" are sent as heights above sea level, with waypoints added wherever the ground rises or falls, so the
                vehicle follows the terrain on the mission with no terrain of its own. The straight lines between them pass at most the tolerance above the height asked
                over the ground, never lower. The planned mission keeps the heights over the ground, while the chart draws the uploaded path dashed and the map marks the
                waypoints the upload adds.`
            }}
            <br />
            {{
              t`It works with "Answer the vehicle's terrain requests": that still covers what the upload cannot, such as returning home over the terrain and waypoints
                whose ground is unknown at upload.`
            }}
          </InfoTooltip>
        </span>
        <v-switch
          :model-value="terrainStore.settings.resolveTerrainOnUpload"
          color="white"
          base-color="#FFFFFF33"
          density="compact"
          hide-details
          inset
          class="origin-right scale-50 -my-3 grow-0"
          :aria-label="t`Hold terrain height on upload`"
          @update:model-value="
            onToggleSetting('resolveTerrainOnUpload', $event === true, 'holding terrain height on upload')
          "
        />
      </div>
      <NumberInputField
        v-if="terrainStore.settings.resolveTerrainOnUpload"
        v-model="terrainStore.settings.terrainFollowToleranceM"
        :label="t`Terrain following tolerance`"
        :info="
          t`How much higher than the height asked above the terrain the path between waypoints may pass, never lower. A smaller tolerance adds more waypoints at upload.`
        "
        unit="m"
        :min="1"
        :max="100"
        :step="1"
        size="extra-compact"
        @update:model-value="onSetNumber('terrainFollowToleranceM', $event)"
      />
      <div v-if="nothingToHold" class="flex items-center gap-x-2">
        <NumberInputField
          v-model="followHeightM"
          class="grow"
          :label="t`Height over the ground`"
          :info="
            t`Height the waypoints set relative to home are moved to, measured from the ground under each one. Waypoints set above sea level keep theirs.`
          "
          unit="m"
          :min="1"
          :max="1000"
          :step="1"
          size="extra-compact"
          @update:model-value="onSetNumber('followHeightM', $event)"
        />
        <v-btn variant="flat" size="x-small" class="bg-[#FFFFFF22] rounded-md" @click="onFollowTerrain">
          {{ t`Set relative to terrain` }}
        </v-btn>
      </div>
      <div class="flex items-start gap-x-2 px-2.5 py-1.5 rounded-md bg-[#FFFFFF11] text-[11px]">
        <v-icon
          :icon="vehicleStore.isVehicleOnline ? 'mdi-information-outline' : 'mdi-lan-disconnect'"
          size="14"
          class="mt-px opacity-70"
        />
        <div class="flex flex-col gap-y-0.5">
          <p class="opacity-80">{{ servingSummary }}</p>
          <p v-if="terrainStore.settings.resolveTerrainOnUpload" class="opacity-80">{{ holdSummary }}</p>
          <p v-if="reportSummary" class="opacity-80">{{ reportSummary }}</p>
          <p v-if="vehicleCheck">{{ vehicleCheck }}</p>
          <p v-if="!vehicleStore.isVehicleOnline" class="opacity-60">
            {{ t`Connect a vehicle to check its terrain.` }}
          </p>
        </div>
      </div>
    </section>

    <v-divider class="opacity-5" />

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
            <strong>{{ t`Prefer measurements:` }}</strong>
            {{
              t`wherever a cell has at least 3 readings, its height replaces the model in the profile, the findings, the safe height and the terrain sent to the vehicle.
                A dashed brown line on the profile then shows where the model would have put the ground.`
            }}
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
import { formatDistanceToNow } from 'date-fns'
import { saveAs } from 'file-saver'
import { msgid, ngettext, t } from 'ttag'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import InfoTooltip from '@/components/InfoTooltip.vue'
import LoadingText from '@/components/LoadingText.vue'
import NumberInputField from '@/components/NumberInputField.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { useTerrainDock } from '@/composables/terrain/useTerrainDock'
import { sampleTerrain } from '@/libs/terrain/elevation-service'
import { measuredCellCenter, medianOffsetM, trustedCells } from '@/libs/terrain/measured-terrain'
import { followTerrainWaypoints, relinkSurveys } from '@/libs/terrain/quick-actions'
import { toPlain } from '@/libs/utils'
import { MAX_CHECKED_WAYPOINTS, terrainCheckSample } from '@/libs/vehicle/mavlink/terrain-protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import { useTerrainStore } from '@/stores/terrain'
import { AltitudeReferenceType } from '@/types/mission'
import type { TerrainSettings } from '@/types/terrain'

const GHOST_TICK_MS = 100
// The ghost run plays thirty times faster than the vehicle would fly it.
const GHOST_SPEEDUP = 30
const FALLBACK_SPEED_MS = 5

const terrainStore = useTerrainStore()
const vehicleStore = useMainVehicleStore()
const missionStore = useMissionStore()
const dock = useTerrainDock()
const { confirmAction } = useInteractionDialog()
const checkingVehicle = ref(false)
const vehicleCheck = ref<string | null>(null)
const comparing = ref(false)
const biasSummary = ref<string | null>(null)
const playing = ref(false)

const servingSummary = computed(() => {
  if (!terrainStore.settings.serveTerrainToVehicle) return t`The vehicle uses only the terrain on its own storage.`
  const last = terrainStore.lastRequestAtMs
  if (last === null) return t`The vehicle has not asked for terrain this session.`
  const lastAsked = formatDistanceToNow(last)
  return t`${terrainStore.servedBlocks} terrain blocks sent, last asked ${lastAsked} ago.`
})

const followHeightM = ref(30)

// Holding terrain height only changes terrain-relative waypoints, so a mission without any is uploaded as planned.
const nothingToHold = computed(() => {
  const waypoints = missionStore.currentPlanningWaypoints
  const uses = (type: AltitudeReferenceType): boolean => waypoints.some((w) => w.altitudeReferenceType === type)
  return (
    terrainStore.settings.resolveTerrainOnUpload &&
    dock.terrain.vehicleClass.value === 'air' &&
    uses(AltitudeReferenceType.RELATIVE_TO_HOME) &&
    !uses(AltitudeReferenceType.RELATIVE_TO_TERRAIN)
  )
})

const onFollowTerrain = (): void => {
  const heightM = followHeightM.value
  logUserAction(`Set the mission waypoints ${heightM} m relative to terrain from the terrain panel`)
  const { waypoints, changed } = followTerrainWaypoints(toPlain(missionStore.currentPlanningWaypoints), heightM)
  const surveys = relinkSurveys(toPlain(missionStore.currentPlanningSurveys), waypoints)
  const message = ngettext(
    msgid`${changed} waypoint set ${heightM} m over the ground, held on upload.`,
    `${changed} waypoints set ${heightM} m over the ground, held on upload.`,
    changed
  )
  dock.replaceMission({ waypoints, surveys }, message)
}

const holdSummary = computed(() => {
  if (nothingToHold.value)
    return t`No waypoint is set "Relative to terrain", so the upload sends the mission as planned.`
  const preview = dock.uploadPreview.value
  if (!preview) {
    return t`Mission heights over the ground are sent as heights above sea level, so the mission needs no terrain on the vehicle; its own terrain covers the rest.`
  }
  const { addedWaypoints, unresolvedWaypoints } = preview
  const added = ngettext(
    msgid`The upload adds ${addedWaypoints} waypoint to hold the height over the ground, dashed on the chart.`,
    `The upload adds ${addedWaypoints} waypoints to hold the height over the ground, dashed on the chart.`,
    addedWaypoints
  )
  const unknown = ngettext(
    msgid`The ground under ${unresolvedWaypoints} waypoint is unknown, so it still needs terrain on the vehicle.`,
    `The ground under ${unresolvedWaypoints} waypoints is unknown, so they still need terrain on the vehicle.`,
    unresolvedWaypoints
  )
  const unresolved = unresolvedWaypoints > 0 ? ` ${unknown}` : ''
  return `${added}${unresolved}`
})

const reportSummary = computed(() => {
  const report = terrainStore.lastReport
  if (!report) return null
  return report.pending > 0
    ? t`The vehicle has ${report.loaded} terrain blocks, with ${report.pending} terrain blocks still to load.`
    : t`The vehicle has ${report.loaded} terrain blocks, with all terrain it needs loaded.`
})

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
  key: keyof Pick<
    TerrainSettings,
    | 'serveTerrainToVehicle'
    | 'resolveTerrainOnUpload'
    | 'measuredTerrainEnabled'
    | 'recordMeasuredTerrain'
    | 'useMeasuredTerrain'
  >,
  enabled: boolean,
  label: string
): void => {
  terrainStore.settings[key] = enabled
  logUserAction(`${enabled ? 'Turned on' : 'Turned off'} ${label}`)
}

const onSetNumber = (setting: string, value: number): void => logUserAction(`Set ${setting} to ${value}`)

const onToggleShowMeasured = (shown: boolean): void => {
  dock.showMeasured.value = shown
  logUserAction(`${shown ? 'Showed' : 'Hid'} the measured terrain cells on the map`)
}

const onCheckVehicle = async (): Promise<void> => {
  logUserAction('Checked the mission waypoints against the vehicle terrain')
  const points = terrainCheckSample(missionStore.currentPlanningWaypoints.map((waypoint) => waypoint.coordinates))
  checkingVehicle.value = true
  try {
    const [answers, ours] = await Promise.all([
      terrainStore.checkVehicleTerrain(points),
      sampleTerrain(points, { mode: 'bilinear', modelOnly: true }),
    ])
    const ready = answers.filter((answer) => answer.available)
    const offset = medianOffsetM(
      answers.flatMap((answer) => (answer.vehicleHeightM === null ? [] : [answer.vehicleHeightM])),
      answers.flatMap((answer, index) => (answer.vehicleHeightM === null ? [] : [ours[index]]))
    )
    const offsetM = offset === null ? '' : `${offset >= 0 ? '+' : ''}${offset.toFixed(1)}`
    const datum = offset === null ? '' : ` ${t`Its terrain reads ${offsetM} m against Cockpit's.`}`
    const checked = t`${ready.length} of ${answers.length} checked waypoints have terrain on the vehicle.`
    vehicleCheck.value = `${checked}${datum}`
    const variant = ready.length === answers.length ? 'success' : 'warning'
    openSnackbar({ variant, message: vehicleCheck.value, duration: 5000 })
  } catch (error) {
    openSnackbar({ variant: 'error', message: t`Could not check the vehicle terrain: ${error}`, duration: 5000 })
  } finally {
    checkingVehicle.value = false
  }
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
