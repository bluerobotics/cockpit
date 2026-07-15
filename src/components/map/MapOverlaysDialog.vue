<template>
  <v-dialog :model-value="modelValue" width="700" @update:model-value="emit('update:modelValue', $event)">
    <v-card :style="interfaceStore.globalGlassMenuStyles">
      <v-card-title class="text-lg text-center font-semibold mt-2">Map overlays (GeoTIFF)</v-card-title>
      <v-icon icon="mdi-close" class="absolute top-3 right-5 mt-2" @click="emit('update:modelValue', false)" />
      <v-card-text>
        <div class="flex flex-col gap-y-3">
          <div
            v-if="!isElectron()"
            class="flex items-start gap-x-2 p-2 rounded-sm bg-[#FFFFFF14] text-xs text-slate-200"
          >
            <v-icon icon="mdi-information-outline" size="16" class="mt-[2px]" />
            <span>
              In Cockpit Lite, overlays are stored in limited browser storage that the browser may clear, so very large
              surveys may fail to save or not persist. For large datasets or reliable storage, use Cockpit Standalone.
            </span>
          </div>

          <div class="flex items-center justify-between">
            <p class="text-md">Loaded overlays</p>
            <v-btn
              class="bg-[#FFFFFF22]"
              variant="plain"
              size="small"
              prepend-icon="mdi-file-plus-outline"
              :loading="importingOverlays"
              @click="addOverlays"
            >
              Add GeoTIFF
            </v-btn>
          </div>

          <p v-if="missionStore.mapOverlays.length === 0" class="text-sm text-slate-400">
            No overlays loaded. Use "Add GeoTIFF" to load a survey.
          </p>

          <div
            v-for="overlay in missionStore.mapOverlays"
            :key="overlay.id"
            class="flex flex-col gap-y-2 p-3 rounded-sm bg-[#FFFFFF14]"
          >
            <div class="flex items-center justify-between gap-x-3">
              <div class="flex items-center gap-x-2 min-w-0">
                <v-progress-circular
                  v-if="loadingIds.includes(overlay.id)"
                  v-tooltip.bottom="'Rendering overlay…'"
                  indeterminate
                  size="16"
                  width="2"
                  color="white"
                />
                <div class="flex flex-col min-w-0">
                  <span class="text-sm text-white truncate">{{ overlay.name }}</span>
                  <span class="text-xs text-slate-400">{{ formatBytes(overlay.fileSize, 1) }}</span>
                </div>
              </div>
              <div class="flex items-center gap-x-3 shrink-0">
                <v-switch
                  v-model="overlay.visible"
                  label="Visible"
                  color="white"
                  hide-details
                  density="compact"
                  base-color="#FFFFFF33"
                />
                <v-icon
                  v-tooltip.bottom="'Center map on overlay'"
                  icon="mdi-image-filter-center-focus"
                  size="18"
                  color="white"
                  class="cursor-pointer opacity-70 hover:opacity-100"
                  @click="centerOnOverlay(overlay)"
                />
                <v-icon
                  v-tooltip.bottom="'Remove overlay'"
                  icon="mdi-trash-can-outline"
                  size="18"
                  color="white"
                  class="cursor-pointer opacity-70 hover:opacity-100"
                  @click="removeOverlay(overlay)"
                />
              </div>
            </div>
            <div class="flex items-center gap-x-4 flex-wrap">
              <v-select
                v-model="overlay.renderMode"
                :items="renderModeOptions"
                label="Render mode"
                density="compact"
                variant="outlined"
                hide-details
                class="w-[200px]"
                theme="dark"
              />
              <div class="flex items-center gap-x-2 flex-1 min-w-[200px]">
                <span class="text-sm text-slate-200 whitespace-nowrap">Opacity</span>
                <v-slider
                  v-model="overlay.opacity"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  color="white"
                  hide-details
                  density="compact"
                />
                <span class="text-xs text-slate-200 w-10 text-right">{{ Math.round(overlay.opacity * 100) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </v-card-text>
      <v-divider class="mx-8" />
      <v-card-actions>
        <div class="flex justify-end w-full pa-0 mr-2">
          <v-btn color="white" @click="emit('update:modelValue', false)">Close</v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import {
  deleteStoredOverlay,
  importGeoTiffFile,
  isGeoTiffFile,
  OverlayStorageQuotaError,
  pickGeoTiffFiles,
} from '@/libs/map/overlay-import'
import { formatBytes, isElectron } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMissionStore } from '@/stores/mission'
import type { MapOverlayMeta, MapOverlayRenderMode } from '@/types/mission'

withDefaults(
  defineProps<{
    /**
     * Whether the dialog is open.
     */
    modelValue: boolean
    /**
     * Ids of overlays currently rendering on the map, shown with a loading indicator.
     */
    loadingIds?: string[]
  }>(),
  { loadingIds: () => [] }
)

const emit = defineEmits<{
  /**
   * Emitted to update the dialog's open state.
   */
  (event: 'update:modelValue', value: boolean): void
}>()

const missionStore = useMissionStore()
const interfaceStore = useAppInterfaceStore()

const renderModeOptions: {
  /**
   * Label shown in the render-mode dropdown.
   */
  title: string
  /**
   * Render mode applied to the overlay.
   */
  value: MapOverlayRenderMode
}[] = [
  { title: 'Grayscale / RGB', value: 'grayscale' },
  { title: 'Intensity', value: 'intensity' },
  { title: 'Bathymetry', value: 'bathymetry' },
]

const importingOverlays = ref(false)

const addOverlays = async (): Promise<void> => {
  const files = await pickGeoTiffFiles()
  if (files.length === 0) return

  importingOverlays.value = true
  let addedCount = 0
  for (const file of files) {
    if (!isGeoTiffFile(file)) {
      openSnackbar({ message: `"${file.name}" is not a GeoTIFF file.`, variant: 'error', duration: 4000 })
      continue
    }
    try {
      missionStore.addMapOverlay(await importGeoTiffFile(file))
      addedCount += 1
    } catch (error) {
      const message =
        error instanceof OverlayStorageQuotaError
          ? error.message
          : `Failed to load "${file.name}". It may be an unsupported or corrupted GeoTIFF.`
      openSnackbar({ message, variant: 'error', duration: 6000 })
      console.error('Failed to import GeoTIFF overlay', file.name, error)
    }
  }
  importingOverlays.value = false

  if (addedCount > 0) {
    openSnackbar({
      message: `${addedCount} map overlay${addedCount > 1 ? 's' : ''} added.`,
      variant: 'success',
      duration: 3000,
    })
  }
}

const removeOverlay = async (overlay: MapOverlayMeta): Promise<void> => {
  missionStore.removeMapOverlay(overlay.id)
  await deleteStoredOverlay(overlay.id)
}

// Frame the map on the overlay but keep the dialog open so the user can keep adjusting overlay properties.
const centerOnOverlay = (overlay: MapOverlayMeta): void => {
  missionStore.requestMapOverlayFocus(overlay.id)
}
</script>
