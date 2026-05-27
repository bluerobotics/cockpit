import { useStorage, useThrottleFn } from '@vueuse/core'
import { computed, reactive, ref, watch } from 'vue'

import type { DialogOptions, DialogResult } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { useGnss } from '@/composables/useGnss'
import { normalizeBearing } from '@/libs/baseStation/coverage'
import {
  type BaseStationConfig,
  type MobileCoverageCache,
  ANTENNA_FACTORY_DEFAULTS,
  AntennaType,
  BaseStationCommsType,
  BROWSER_GEOLOCATION_SOURCE_ID,
  DEFAULT_BASE_STATION_CONFIG,
  DEFAULT_MOBILE_COVERAGE_CACHE,
} from '@/types/baseStation'
import type { DialogActions } from '@/types/general'
import type { WaypointCoordinates } from '@/types/mission'

// GNSS receivers report at up to 10 Hz while a base station barely moves, so fixes are sampled down
// before they reach the persisted config and the coverage overlay that redraws with it.
const gnssPositionSampleRateMs = 1000

// eslint-disable-next-line jsdoc/require-jsdoc, @typescript-eslint/explicit-function-return-type -- type inferred for the reactive() output to keep per-state-field typing local to this file
function initialize() {
  const config = useBlueOsStorage<BaseStationConfig>('cockpit-base-station-config', DEFAULT_BASE_STATION_CONFIG)

  // Machine-local, deliberately outside the vehicle-synced config: a positioning device and the
  // decision to follow it describe *this* topside computer, so a synced value would make every
  // other operator's machine overwrite the shared station position with its own location. The
  // OpenCellID key is a personal credential, and the coverage cache is re-downloadable bulk data
  // that has no business being pretty-printed into the vehicle's settings on every append.
  const trackByGps = useStorage('cockpit-base-station-track-by-gps', false)
  const gpsSourceId = useStorage('cockpit-base-station-gps-source-id', BROWSER_GEOLOCATION_SOURCE_ID)
  const openCellIdApiKey = useStorage('cockpit-base-station-opencellid-api-key', '')
  const mobileCoverageCache = useStorage<MobileCoverageCache>(
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

  watch(configPanelOpen, (isOpen) => {
    if (isOpen) logUserAction('Opened the base station configuration panel')
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
      config.value.showSignalOnMap &&
      config.value.position !== null &&
      (config.value.commsType === BaseStationCommsType.RadioLink ||
        config.value.commsType === BaseStationCommsType.Tethered)
  )

  // Position to feed map targets/arrows: only when a station is actually placed.
  const activePosition = computed<WaypointCoordinates | undefined>(() =>
    config.value.enabled ? config.value.position ?? undefined : undefined
  )

  const setPosition = (position: WaypointCoordinates): void => {
    config.value.position = [Number(position[0].toFixed(8)), Number(position[1].toFixed(8))]
    config.value.enabled = true
  }

  const remove = (): void => {
    // The OpenCellID API key survives removal on its own now that it lives in machine-local
    // storage: retyping it on every remove/recreate cycle would be annoying and error-prone.
    config.value = structuredClone(DEFAULT_BASE_STATION_CONFIG)
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

  const gnss = useGnss()

  // Serial GNSS receivers only work on Standalone, so Lite is left with the browser's Geolocation API.
  const gpsSourceOptions = computed(() => [
    { id: BROWSER_GEOLOCATION_SOURCE_ID, label: 'Browser geolocation' },
    ...(gnss.isSupported ? gnss.devices.value.map((device) => ({ id: device.id, label: device.name })) : []),
  ])

  // Sources that are gone (device removed, or a device id synced in from a Standalone install) fall back
  // to the browser, so tracking never waits on a source that cannot report a position.
  const gpsSource = computed(() =>
    gpsSourceOptions.value.some((source) => source.id === gpsSourceId.value)
      ? gpsSourceId.value
      : BROWSER_GEOLOCATION_SOURCE_ID
  )

  const isTracking = computed(() => trackByGps.value && config.value.enabled)

  const toggleSignalVisibility = (): void => {
    config.value.showSignalOnMap = !config.value.showSignalOnMap
    logUserAction(`${config.value.showSignalOnMap ? 'Showed' : 'Hid'} the base station signal on the map`)
  }

  const applyTrackedPosition = useThrottleFn(setPosition, gnssPositionSampleRateMs, true, true)

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
      (position) => applyTrackedPosition([position.coords.latitude, position.coords.longitude]),
      (error) => {
        openSnackbar({
          variant: 'error',
          message: `Base station GPS tracking failed: ${error.message}. Disabling.`,
          duration: 4000,
        })
        trackByGps.value = false
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    )
  }

  watch(
    () => isTracking.value && gpsSource.value === BROWSER_GEOLOCATION_SOURCE_ID,
    (usingBrowserGeolocation) => (usingBrowserGeolocation ? startGeoWatch() : stopGeoWatch()),
    { immediate: true }
  )

  const trackedGnssDeviceId = computed(() =>
    isTracking.value && gpsSource.value !== BROWSER_GEOLOCATION_SOURCE_ID ? gpsSource.value : null
  )

  watch(
    () => (trackedGnssDeviceId.value === null ? undefined : gnss.latestFixes[trackedGnssDeviceId.value]),
    (fix) => {
      if (fix?.latitude == null || fix.longitude == null || !fix.hasValidFix) return
      applyTrackedPosition([fix.latitude, fix.longitude])
    },
    { immediate: true }
  )

  // This singleton never unmounts, so the watch above can't release the geolocation watch on a
  // full app teardown; clear it on window unload to avoid leaking it across reloads.
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', stopGeoWatch)

  // Provider/key changes invalidate any previously-determined validity; the next fetch resets it.
  watch(
    () => [config.value.mobileCoverage.provider, openCellIdApiKey.value] as const,
    () => {
      openCellIdApiKeyStatus.value = 'unknown'
    }
  )

  return reactive({
    config,
    trackByGps,
    gpsSourceId,
    openCellIdApiKey,
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
    gpsSource,
    gpsSourceOptions,
    activePosition,
    setPosition,
    setBearing,
    toggleSignalVisibility,
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
          logUserAction('Removed the base station')
          useBaseStation().remove()
          closeDialog()
        },
      },
    ] as DialogActions[],
  })
}
