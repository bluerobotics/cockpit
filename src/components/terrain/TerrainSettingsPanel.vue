<template>
  <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
    <template #title>{{ t`Terrain` }}</template>
    <template #info>
      <strong>{{ t`Land source:` }}</strong>
      {{ t`Elevation model used for every terrain check, the profile and the upload.` }}
      {{
        t`The Copernicus surface model includes trees and buildings and needs Cockpit Standalone; Cockpit Lite uses Tilezen instead.`
      }}
      <br />
      <strong>{{ t`Bathymetry source:` }}</strong>
      {{
        t`Depth model read wherever the land source reads sea level or below. Automatic picks the most detailed one published for each point.`
      }}
      <br />
      <strong>{{ t`Minimums:` }}</strong>
      {{ t`Clearances the mission is checked against, before upload when that check is on.` }}
      <br />
      <strong>{{ t`Hold terrain height on upload:` }}</strong>
      {{
        t`Sends waypoints set above the terrain as heights above sea level, so vehicles without terrain data still follow the ground.`
      }}
    </template>
    <template #content>
      <div class="flex flex-col gap-y-3 px-4 pb-4 pt-2 text-sm">
        <div
          class="grid gap-x-6 gap-y-4 items-center"
          :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'"
        >
          <div class="flex items-center gap-x-1">
            <v-select
              :model-value="terrainStore.sourceId"
              :items="sourceOptions"
              :label="t`Land source`"
              density="compact"
              variant="outlined"
              hide-details
              theme="dark"
              @update:model-value="onSelectSource"
            />
            <InfoTooltip :label="t`Land source information`">
              {{ TERRAIN_SOURCES[terrainStore.sourceId].description }}
            </InfoTooltip>
          </div>
          <div class="flex items-center gap-x-1">
            <v-select
              :model-value="terrainStore.bathymetrySourceId"
              :items="bathymetryOptions"
              :label="t`Bathymetry source`"
              density="compact"
              variant="outlined"
              hide-details
              theme="dark"
              @update:model-value="onSelectBathymetry"
            />
            <InfoTooltip :label="t`Bathymetry source information`">
              {{ BATHYMETRY_SOURCES[terrainStore.bathymetrySourceId].description }}
            </InfoTooltip>
          </div>
          <div class="flex items-center gap-x-1">
            <span>{{ t`Stored terrain` }}</span>
            <InfoTooltip :label="t`Stored terrain information`">
              {{
                t`Terrain tiles kept on this computer. Keep an area for offline use from the terrain panel in mission planning.`
              }}
            </InfoTooltip>
            <span class="grow text-xs opacity-70">{{ cacheText }}</span>
            <v-btn
              variant="flat"
              size="small"
              class="bg-[#FFFFFF22] disabled:!bg-[#FFFFFF22] disabled:!text-white/55 disabled:!opacity-50"
              :disabled="!terrainStore.cacheSummary?.tiles"
              @click="onClearCache"
            >
              {{ t`Clear` }}
            </v-btn>
          </div>
        </div>
        <p v-if="terrainStore.sourceFallbackReason" class="text-xs text-[#FF8800]">
          {{ terrainStore.sourceFallbackReason }}
        </p>

        <div v-if="terrainStore.sourceId === 'custom'" class="flex items-start gap-x-4">
          <v-text-field
            :model-value="terrainStore.settings.customUrlTemplate"
            :label="t`Tile address`"
            placeholder="https://example.com/terrain/{z}/{x}/{y}.png"
            density="compact"
            variant="outlined"
            theme="dark"
            :error-messages="customUrlError"
            :hide-details="customUrlError.length === 0"
            class="grow"
            @change="onCustomUrlChange"
          >
            <template #append>
              <InfoTooltip :label="t`Tile address information`">
                {{ t`Terrarium-encoded PNG tiles, with {z}, {x} and {y} in the address.` }}
              </InfoTooltip>
            </template>
          </v-text-field>
          <NumberInputField
            v-model="terrainStore.settings.customMaxZoom"
            :label="t`Max. zoom`"
            :min="1"
            :max="18"
            :step="1"
            class="pt-1 whitespace-nowrap"
            @update:model-value="onSetNumber('customMaxZoom', $event)"
          />
        </div>

        <v-divider class="opacity-5" />

        <p class="font-semibold">{{ t`Minimums and water` }}</p>
        <div class="grid gap-x-6 gap-y-2" :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'">
          <NumberInputField
            v-for="field in MINIMUM_FIELDS"
            :key="field.key"
            v-model="terrainStore.settings[field.key]"
            :label="field.label"
            :info="field.info"
            :unit="field.unit"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            @update:model-value="onSetNumber(field.key, $event)"
          />
        </div>

        <v-divider class="opacity-5" />

        <div class="grid gap-x-6 items-center" :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'">
          <v-switch
            v-for="toggle in UPLOAD_TOGGLES"
            :key="toggle.key"
            :model-value="terrainStore.settings[toggle.key]"
            color="white"
            base-color="#FFFFFF33"
            hide-details
            class="-my-1"
            @update:model-value="onToggle(toggle.key, $event === true, toggle.logLabel)"
          >
            <template #label>
              <span class="mr-0.5">{{ toggle.label }}</span>
              <InfoTooltip :label="t`${toggle.label} information`">{{ toggle.info }}</InfoTooltip>
            </template>
          </v-switch>
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
            @update:model-value="onSetNumber('terrainFollowToleranceM', $event)"
          />
        </div>
      </div>
    </template>
  </ExpansiblePanel>
</template>

<script setup lang="ts">
import { t } from 'ttag'
import { computed, onMounted, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import InfoTooltip from '@/components/InfoTooltip.vue'
import NumberInputField from '@/components/NumberInputField.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { BATHYMETRY_SOURCES } from '@/libs/terrain/bathymetry'
import { isValidTileUrlTemplate, TERRAIN_SOURCES } from '@/libs/terrain/sources'
import { isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useTerrainStore } from '@/stores/terrain'
import type { BathymetrySourceId, TerrainSettings, TerrainSourceId } from '@/types/terrain'

type MinimumField = {
  /**
   * Setting the field edits.
   */
  key: {
    [K in keyof TerrainSettings]: TerrainSettings[K] extends number ? K : never
  }[keyof TerrainSettings]
  /**
   * Field label.
   */
  label: string
  /**
   * Explanation shown from the information icon.
   */
  info: string
  /**
   * Unit shown after the input.
   */
  unit: string
  /**
   * Lowest accepted value.
   */
  min: number
  /**
   * Highest accepted value.
   */
  max: number
  /**
   * Input step.
   */
  step: number
}

type UploadToggleKey = 'checkTerrainOnUpload' | 'resolveTerrainOnUpload' | 'aimRoiAtGround'

type UploadToggle = {
  /**
   * Setting the switch edits.
   */
  key: UploadToggleKey
  /**
   * Switch label.
   */
  label: string
  /**
   * Explanation shown from the information icon.
   */
  info: string
  /**
   * What the switch does, as written in the interaction log.
   */
  logLabel: string
}

const MINIMUM_FIELDS: MinimumField[] = [
  {
    key: 'minimumClearanceM',
    label: t`Clearance above the terrain`,
    info: t`Lowest height aircraft keep over the ground or the water, and submarines over the seabed. Passing lower is listed in Findings.`,
    unit: 'm',
    min: 0,
    max: 500,
    step: 1,
  },
  {
    key: 'minimumUnderKeelM',
    label: t`Water under the keel`,
    info: t`Least water a boat keeps between its hull and the seabed. Less is listed in Findings.`,
    unit: 'm',
    min: 0,
    max: 50,
    step: 0.1,
  },
  {
    key: 'vesselDraftM',
    label: t`Vessel draft`,
    info: t`How deep the hull reaches below the waterline. Water under the keel is counted from there, and sonar depths are taken from that depth.`,
    unit: 'm',
    min: 0,
    max: 20,
    step: 0.05,
  },
  {
    key: 'waterLevelOffsetM',
    label: 'Water level offset',
    info: 'Height of the water above the terrain model sea level, for lakes, rivers or the tide at mission time.',
    unit: 'm',
    min: -500,
    max: 5000,
    step: 0.1,
  },
  {
    key: 'tideRangeM',
    label: 'Expected tide range',
    info: 'Difference between high and low tide. The profile outlines this band around the water level.',
    unit: 'm',
    min: 0,
    max: 20,
    step: 0.1,
  },
]

const UPLOAD_TOGGLES: UploadToggle[] = [
  {
    key: 'checkTerrainOnUpload',
    label: t`Check the terrain before upload`,
    info: t`Checks the mission against the terrain before each upload, and asks to confirm when anything is found.`,
    logLabel: 'checking the terrain before upload',
  },
  {
    key: 'aimRoiAtGround',
    label: t`Aim regions of interest at the ground`,
    info: t`Regions of interest left at zero altitude are sent at the ground height under them, so the camera points at the ground there.`,
    logLabel: 'aiming regions of interest at the ground',
  },
  {
    key: 'resolveTerrainOnUpload',
    label: t`Hold terrain height on upload`,
    info: t`Sends waypoints set above the terrain as heights above sea level, adding waypoints where the ground changes, so vehicles without terrain data still follow it.`,
    logLabel: 'holding terrain height on upload',
  },
]

const interfaceStore = useAppInterfaceStore()
const terrainStore = useTerrainStore()
const { confirmAction } = useInteractionDialog()
const customUrlError = ref<string[]>([])

const sourceOptions = computed(() =>
  (Object.keys(TERRAIN_SOURCES) as TerrainSourceId[]).map((id) => {
    const unavailable = TERRAIN_SOURCES[id].standaloneOnly && !isElectron()
    const label = TERRAIN_SOURCES[id].label
    return {
      value: id,
      title: unavailable ? t`${label} (Cockpit Standalone)` : label,
      props: { disabled: unavailable },
    }
  })
)

const bathymetryOptions = (Object.keys(BATHYMETRY_SOURCES) as BathymetrySourceId[]).map((id) => ({
  value: id,
  title: BATHYMETRY_SOURCES[id].label,
}))

const cacheText = computed(() => {
  const summary = terrainStore.cacheSummary
  if (summary === undefined) return t`Unavailable`
  if (summary === null) return t`Reading...`
  if (summary.tiles === 0) return t`None yet`
  const megabytes = (summary.bytes / 1e6).toFixed(1)
  return t`${summary.tiles} tiles, ${megabytes} MB`
})

const onSelectSource = (sourceId: TerrainSourceId): void => {
  terrainStore.settings.sourceId = sourceId
  logUserAction(`Selected the "${sourceId}" land source`)
}

const onSelectBathymetry = (sourceId: BathymetrySourceId): void => {
  terrainStore.settings.bathymetrySourceId = sourceId
  logUserAction(`Selected the "${sourceId}" bathymetry source`)
}

const onSetNumber = (setting: string, value: number): void => logUserAction(`Set ${setting} to ${value}`)

const onCustomUrlChange = (event: Event): void => {
  const template = (event.target as HTMLInputElement).value.trim()
  if (template !== '' && !isValidTileUrlTemplate(template)) {
    customUrlError.value = [t`The address needs {z}, {x} and {y}, and to start with http:// or https://.`]
    return
  }
  customUrlError.value = []
  terrainStore.settings.customUrlTemplate = template
  logUserAction('Changed the custom terrain tile address')
}

const onToggle = (key: UploadToggleKey, enabled: boolean, label: string): void => {
  terrainStore.settings[key] = enabled
  logUserAction(`${enabled ? 'Turned on' : 'Turned off'} ${label}`)
}

const onClearCache = async (): Promise<void> => {
  logUserAction('Opened the confirmation to clear the stored terrain')
  const confirmed = await confirmAction(
    t`Clear the stored terrain?`,
    t`Terrain kept for offline use is removed too, and has to be downloaded again before flying without a connection.`,
    t`Clear`,
    '640px'
  )
  if (!confirmed) {
    logUserAction('Canceled clearing the stored terrain')
    return
  }
  logUserAction('Cleared the stored terrain')
  await terrainStore.clearCache()
}

onMounted(() => void terrainStore.refreshCacheSummary())
</script>
