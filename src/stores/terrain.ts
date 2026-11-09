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
import { type VehicleTerrainParameters, TERRAIN_PERFORMANCE_PARAMETERS } from '@/libs/terrain/mission-terrain'
import {
  type OfflineTerrainProgress,
  downloadOfflineTerrain,
  MAX_OFFLINE_TERRAIN_TILES,
  offlineTerrainPlan,
} from '@/libs/terrain/offline'
import { isValidTileUrlTemplate, TERRAIN_SOURCES } from '@/libs/terrain/sources'
import { type TerrainCacheSummary, clearTerrainCache, summarizeTerrainCache } from '@/libs/terrain/tile-store'
import type { TerrainTileBounds } from '@/libs/terrain/tiles'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { BathymetrySourceId, TerrainSettings, TerrainSourceId } from '@/types/terrain'

export const DEFAULT_TERRAIN_SETTINGS: TerrainSettings = {
  sourceId: 'copernicus',
  bathymetrySourceId: 'auto',
  customUrlTemplate: '',
  customMaxZoom: 15,
  minimumClearanceM: 10,
  minimumUnderKeelM: 0.5,
  vesselDraftM: 0.3,
  waterLevelOffsetM: 0,
  tideRangeM: 2,
  checkTerrainOnUpload: false,
  resolveTerrainOnUpload: false,
  terrainFollowToleranceM: 5,
  aimRoiAtGround: false,
  radioFrequencyMhz: 2400,
  visualObservers: [],
  visualRangeM: 500,
  cloudBaseM: 0,
}

export const useTerrainStore = defineStore('terrain', () => {
  const { openSnackbar } = useSnackbar()
  const vehicleStore = useMainVehicleStore()

  // Shared with every computer flying the vehicle: the model, thresholds and observers describe the
  // operating area and the vehicle, nothing that belongs to one machine.
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
  const downloadProgress = ref<OfflineTerrainProgress | null>(null)
  let downloadController: AbortController | null = null

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

  /**
   * Keeps the terrain over an area on this computer, so every terrain check works there offline.
   * @param {TerrainTileBounds} bounds Area to keep.
   * @returns {Promise<void>}
   */
  const downloadArea = async (bounds: TerrainTileBounds): Promise<void> => {
    if (downloadController) return
    const plan = offlineTerrainPlan(bounds, effectiveSourceId.value, bathymetrySourceId.value)
    if (plan.length > MAX_OFFLINE_TERRAIN_TILES) {
      const message = t`That area needs ${plan.length} terrain tiles; zoom in to under ${MAX_OFFLINE_TERRAIN_TILES}.`
      openSnackbar({ variant: 'warning', message, duration: 6000 })
      return
    }
    downloadController = new AbortController()
    downloadProgress.value = { done: 0, failed: 0, total: plan.length }
    try {
      const result = await downloadOfflineTerrain(plan, downloadController.signal, (progress) => {
        downloadProgress.value = progress
      })
      const cancelled = downloadController.signal.aborted
      const stored =
        result.failed > 0
          ? t`${result.done} of ${result.total} terrain tiles stored for offline use, ${result.failed} could not be downloaded.`
          : t`${result.done} of ${result.total} terrain tiles stored for offline use.`
      const variant = result.failed > 0 || cancelled ? 'warning' : 'success'
      openSnackbar({ variant, message: cancelled ? t`Cancelled: ${stored}` : stored, duration: 5000 })
    } catch (error) {
      openSnackbar({
        variant: 'error',
        message: t`Could not store the terrain for offline use: ${error}`,
        duration: 5000,
      })
    } finally {
      downloadController = null
      downloadProgress.value = null
      void refreshCacheSummary()
    }
  }

  const cancelDownload = (): void => downloadController?.abort()

  /** Climb and return parameters of the connected vehicle, read once per connection. */
  const vehicleParameters = ref<VehicleTerrainParameters>({})
  watch(
    () => (vehicleStore.isVehicleOnline ? vehicleStore.mainVehicle : undefined),
    async (vehicle) => {
      vehicleParameters.value = {}
      if (!vehicle) return
      const values = await Promise.all(
        TERRAIN_PERFORMANCE_PARAMETERS.map((name) => vehicle.requestParameterValue(name))
      )
      if (vehicleStore.mainVehicle !== vehicle) return
      const read: VehicleTerrainParameters = {}
      TERRAIN_PERFORMANCE_PARAMETERS.forEach((name, index) => {
        if (values[index] !== undefined) read[name] = values[index]
      })
      vehicleParameters.value = read
    },
    { immediate: true }
  )

  /**
   * Water surface height now, as configured.
   * @returns {number} Meters above the terrain model's sea level.
   */
  const waterLevelNowM = (): number => settings.value.waterLevelOffsetM

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
    downloadProgress,
    downloadArea,
    cancelDownload,
    vehicleParameters,
    waterLevelNowM,
  }
})
