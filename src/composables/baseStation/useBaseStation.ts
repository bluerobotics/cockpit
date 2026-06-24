import { computed, reactive, ref, watch } from 'vue'

import type { DialogOptions, DialogResult } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { useAppInterfaceStore } from '@/stores/appInterface'
import {
  type BaseStationConfig,
  type MobileCoverageCache,
  ANTENNA_FACTORY_DEFAULTS,
  AntennaType,
  BaseStationCommsType,
  DEFAULT_BASE_STATION_CONFIG,
  DEFAULT_MOBILE_COVERAGE_CACHE,
  TopSideComputerType,
} from '@/types/baseStation'
import type { DialogActions } from '@/types/general'
import type { WaypointCoordinates } from '@/types/mission'

const normalizeBearing = (bearing: number): number => ((bearing % 360) + 360) % 360

// eslint-disable-next-line jsdoc/require-jsdoc, @typescript-eslint/explicit-function-return-type -- type inferred for the reactive() output to keep per-state-field typing local to this file
function initialize() {
  const config = useBlueOsStorage<BaseStationConfig>('cockpit-base-station-config', DEFAULT_BASE_STATION_CONFIG)
  const mobileCoverageCache = useBlueOsStorage<MobileCoverageCache>(
    'cockpit-base-station-mobile-coverage-cache',
    DEFAULT_MOBILE_COVERAGE_CACHE
  )

  // Merge defaults so newly-added fields are populated for existing users.
  config.value = {
    ...DEFAULT_BASE_STATION_CONFIG,
    ...config.value,
    antenna: { ...DEFAULT_BASE_STATION_CONFIG.antenna, ...(config.value.antenna ?? {}) },
    mobileCoverage: {
      ...DEFAULT_BASE_STATION_CONFIG.mobileCoverage,
      ...(config.value.mobileCoverage ?? {}),
    },
  }
  mobileCoverageCache.value = {
    ...DEFAULT_MOBILE_COVERAGE_CACHE,
    ...mobileCoverageCache.value,
    openCellId: mobileCoverageCache.value.openCellId ?? [],
    osmOverpass: mobileCoverageCache.value.osmOverpass ?? [],
  }

  // Operators discovered in the most recent Overpass response. Populates the panel selector
  // dynamically since the OSM `operator` tag varies wildly between regions.
  const availableOsmOperators = ref<string[]>([])
  const availableOpenCellIdOperators = ref<string[]>([])
  const mobileCoverageLoading = ref(false)
  const mobileCoverageReloadToken = ref(0)
  const mobileCoverageVisibleDataResetToken = ref(0)
  const mobileCoverageTargetToolActive = ref(false)
  const openCellIdApiKeyStatus = ref<'unknown' | 'valid' | 'invalid'>('unknown')

  const configPanelOpen = ref(false)

  const interfaceStore = useAppInterfaceStore()
  watch(configPanelOpen, (isOpen) => {
    interfaceStore.configPanelVisible = isOpen
  })

  const contextPopupOpen = ref(false)
  const contextPopupPosition = ref({ x: 0, y: 0 })

  const openContextPopup = (x: number, y: number): void => {
    contextPopupPosition.value = { x, y }
    contextPopupOpen.value = true
  }

  const closeContextPopup = (): void => {
    contextPopupOpen.value = false
  }

  const requestMobileCoverageReload = (): void => {
    mobileCoverageReloadToken.value += 1
  }

  const requestVisibleMobileCoverageDataReset = (): void => {
    mobileCoverageVisibleDataResetToken.value += 1
  }

  const showCoverage = computed(
    () =>
      config.value.enabled &&
      config.value.position !== null &&
      (config.value.commsType === BaseStationCommsType.RadioLink ||
        config.value.commsType === BaseStationCommsType.Tethered)
  )

  const setPosition = (position: WaypointCoordinates): void => {
    config.value.position = [Number(position[0].toFixed(8)), Number(position[1].toFixed(8))]
    config.value.enabled = true
  }

  const remove = (): void => {
    // Keep the OpenCellID API key around as a user-level credential — having to retype it
    // every time the base station is removed/recreated would be annoying and error-prone.
    const preservedApiKey = config.value.mobileCoverage.openCellIdApiKey
    config.value = {
      ...DEFAULT_BASE_STATION_CONFIG,
      mobileCoverage: { ...DEFAULT_BASE_STATION_CONFIG.mobileCoverage, openCellIdApiKey: preservedApiKey },
    }
    configPanelOpen.value = false
    contextPopupOpen.value = false
  }

  const resetAntennaToDefaults = (): void => {
    const factory = ANTENNA_FACTORY_DEFAULTS[config.value.antenna.type]
    config.value.antenna = { ...factory, bearing: config.value.antenna.bearing }
  }

  const setAntennaType = (type: AntennaType): void => {
    const factory = ANTENNA_FACTORY_DEFAULTS[type]
    config.value.antenna = { ...factory, bearing: config.value.antenna.bearing }
  }

  const setBearing = (bearing: number): void => {
    config.value.antenna.bearing = normalizeBearing(bearing)
  }

  let geoWatchId: number | null = null
  const stopGeoWatch = (): void => {
    if (geoWatchId !== null && navigator?.geolocation) {
      navigator.geolocation.clearWatch(geoWatchId)
      geoWatchId = null
    }
  }
  const startGeoWatch = (): void => {
    if (geoWatchId !== null || !navigator?.geolocation) return
    geoWatchId = navigator.geolocation.watchPosition(
      (position) => setPosition([position.coords.latitude, position.coords.longitude]),
      (error) => {
        openSnackbar({
          variant: 'error',
          message: `Base station GPS tracking failed: ${error.message}. Disabling.`,
          duration: 4000,
        })
        config.value.trackByGps = false
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    )
  }

  watch(
    () => [config.value.trackByGps, config.value.enabled] as const,
    ([tracking, enabled]) => {
      if (tracking && enabled) startGeoWatch()
      else stopGeoWatch()
    },
    { immediate: true }
  )

  // This singleton never unmounts, so the watch above can't release the geolocation watch on a
  // full app teardown; clear it on window unload to avoid leaking it across reloads.
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', stopGeoWatch)

  watch(
    () => config.value.topSideComputerType,
    (topSideType) => {
      if (topSideType !== TopSideComputerType.Portable) config.value.trackByGps = false
    },
    { immediate: true }
  )

  // Provider/key changes invalidate any previously-determined validity; the next fetch resets it.
  watch(
    () => [config.value.mobileCoverage.provider, config.value.mobileCoverage.openCellIdApiKey] as const,
    () => {
      openCellIdApiKeyStatus.value = 'unknown'
    }
  )

  return reactive({
    config,
    mobileCoverageCache,
    configPanelOpen,
    contextPopupOpen,
    contextPopupPosition,
    availableOsmOperators,
    availableOpenCellIdOperators,
    mobileCoverageLoading,
    mobileCoverageReloadToken,
    mobileCoverageVisibleDataResetToken,
    mobileCoverageTargetToolActive,
    openCellIdApiKeyStatus,
    showCoverage,
    setPosition,
    setBearing,
    setAntennaType,
    resetAntennaToDefaults,
    openContextPopup,
    closeContextPopup,
    requestMobileCoverageReload,
    requestVisibleMobileCoverageDataReset,
    remove,
  })
}

let api: ReturnType<typeof initialize> | null = null

/**
 * Singleton-style composable holding the base-station configuration, transient UI state
 * (config panel / context popup / coverage controls), and the actions that mutate them.
 * State is shared across all callers; the first call lazily initializes it so dependent
 * stores (Pinia, BlueOS settings) are guaranteed to be ready.
 * @returns {ReturnType<typeof initialize>} Reactive base-station state and actions.
 */
export const useBaseStation = (): ReturnType<typeof initialize> => {
  if (!api) api = initialize()
  return api
}

/**
 * Shows the shared confirmation dialog for removing the base station and clears it once confirmed.
 * Centralizes the prompt so every entry point (context popup, config panel, map context menu)
 * asks before the destructive, undo-less removal.
 * @param {(options: DialogOptions) => Promise<DialogResult>} showDialog - Opens the caller's interaction dialog.
 * @param {() => void} closeDialog - Closes the caller's interaction dialog.
 * @returns {void}
 */
export const confirmRemoveBaseStation = (
  showDialog: (options: DialogOptions) => Promise<DialogResult>,
  closeDialog: () => void
): void => {
  showDialog({
    variant: 'text-only',
    message: 'Remove the base station? This will clear its position and configuration.',
    persistent: false,
    maxWidth: '480px',
    actions: [
      { text: 'Cancel', color: 'white', action: closeDialog },
      {
        text: 'Remove',
        color: 'white',
        action: () => {
          useBaseStation().remove()
          closeDialog()
        },
      },
    ] as DialogActions[],
  })
}
