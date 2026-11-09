import { defineStore } from 'pinia'
import { t } from 'ttag'
import { computed, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useSnackbar } from '@/composables/snackbar'
import { BATHYMETRY_SOURCES } from '@/libs/terrain/bathymetry'
import {
  configureTerrainService,
  effectiveTerrainSource,
  isTerrainSourceAvailable,
} from '@/libs/terrain/elevation-service'
import { isValidTileUrlTemplate, TERRAIN_SOURCES } from '@/libs/terrain/sources'
import { type TerrainCacheSummary, clearTerrainCache, summarizeTerrainCache } from '@/libs/terrain/tile-store'
import type { BathymetrySourceId, TerrainSettings, TerrainSourceId } from '@/types/terrain'

export const DEFAULT_TERRAIN_SETTINGS: TerrainSettings = {
  sourceId: 'copernicus',
  bathymetrySourceId: 'auto',
  customUrlTemplate: '',
  customMaxZoom: 15,
}

export const useTerrainStore = defineStore('terrain', () => {
  const { openSnackbar } = useSnackbar()

  // Shared with every computer flying the vehicle: the model and thresholds describe the operating area and
  // the vehicle, nothing that belongs to one machine.
  const settings = useBlueOsStorage<TerrainSettings>('cockpit-terrain-settings-v1', DEFAULT_TERRAIN_SETTINGS)

  /** Terrain source chosen, the default for an id this version does not know, as synced from another Cockpit. */
  const sourceId = computed<TerrainSourceId>(() =>
    settings.value.sourceId in TERRAIN_SOURCES ? settings.value.sourceId : DEFAULT_TERRAIN_SETTINGS.sourceId
  )

  /** Bathymetry read under water, automatic by area on settings saved before it could be chosen. */
  const bathymetrySourceId = computed<BathymetrySourceId>(() =>
    settings.value.bathymetrySourceId in BATHYMETRY_SOURCES ? settings.value.bathymetrySourceId : 'auto'
  )

  watch(
    () =>
      [
        sourceId.value,
        bathymetrySourceId.value,
        settings.value.customUrlTemplate,
        settings.value.customMaxZoom,
      ] as const,
    ([source, bathymetry, customUrlTemplate, customMaxZoom]) =>
      configureTerrainService({ sourceId: source, bathymetrySourceId: bathymetry, customUrlTemplate, customMaxZoom }),
    { immediate: true }
  )

  /** Source actually read on this computer, Tilezen when the chosen one needs Cockpit Standalone. */
  const effectiveSourceId = computed<TerrainSourceId>(() =>
    effectiveTerrainSource(sourceId.value, settings.value.customUrlTemplate)
  )

  /** Information on the source actually read. */
  const effectiveSource = computed(() => TERRAIN_SOURCES[effectiveSourceId.value])

  /** Why the chosen source is not the one read, when it is not. */
  const sourceFallbackReason = computed<string | null>(() => {
    const { customUrlTemplate } = settings.value
    if (sourceId.value === 'custom' && !isValidTileUrlTemplate(customUrlTemplate)) {
      return t`The custom tile address needs http(s) and the {z}, {x} and {y} placeholders.`
    }
    if (!isTerrainSourceAvailable(sourceId.value, customUrlTemplate)) {
      const sourceLabel = TERRAIN_SOURCES[sourceId.value].label
      return t`${sourceLabel} is available in Cockpit Standalone, so Cockpit Lite reads Tilezen instead.`
    }
    return null
  })

  /** Terrain kept on this computer, null while it is read and undefined when it could not be. */
  const cacheSummary = ref<TerrainCacheSummary | null | undefined>(null)

  const refreshCacheSummary = async (): Promise<void> => {
    try {
      cacheSummary.value = await summarizeTerrainCache()
    } catch (error) {
      cacheSummary.value = undefined
      console.warn('Could not read the terrain cache size:', error)
    }
  }

  const clearCache = async (): Promise<void> => {
    try {
      await clearTerrainCache()
      openSnackbar({ variant: 'success', message: t`Stored terrain cleared.`, duration: 3000 })
    } catch (error) {
      openSnackbar({ variant: 'error', message: t`Could not clear the stored terrain: ${error}`, duration: 5000 })
    }
    await refreshCacheSummary()
  }

  return {
    settings,
    sourceId,
    bathymetrySourceId,
    effectiveSourceId,
    effectiveSource,
    sourceFallbackReason,
    cacheSummary,
    refreshCacheSummary,
    clearCache,
  }
})
