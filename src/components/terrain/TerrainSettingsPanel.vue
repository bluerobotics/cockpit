<template>
  <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
    <template #title>{{ t`Terrain` }}</template>
    <template #info>
      <strong>Land source:</strong> Elevation model used for every terrain check. The Copernicus surface model includes
      trees and buildings and needs Cockpit Standalone; Cockpit Lite uses Tilezen instead.
      <br />
      <strong>Bathymetry source:</strong> Depth model read wherever the land source reads sea level or below. Automatic
      picks the most detailed one published for each point.
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
            <span>Stored terrain</span>
            <InfoTooltip label="Stored terrain information"> Terrain tiles kept on this computer. </InfoTooltip>
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
import type { BathymetrySourceId, TerrainSourceId } from '@/types/terrain'

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

const onClearCache = async (): Promise<void> => {
  logUserAction('Opened the confirmation to clear the stored terrain')
  const confirmed = await confirmAction(
    'Clear the stored terrain?',
    'Terrain checks download it again the next time they need it.',
    'Clear',
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
