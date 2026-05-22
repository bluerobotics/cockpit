import { reactive, ref } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { type BaseStationConfig, DEFAULT_BASE_STATION_CONFIG } from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

// eslint-disable-next-line jsdoc/require-jsdoc, @typescript-eslint/explicit-function-return-type -- type inferred for the reactive() output to keep per-state-field typing local to this file
function initialize() {
  const config = useBlueOsStorage<BaseStationConfig>('cockpit-base-station-config', DEFAULT_BASE_STATION_CONFIG)

  // Merge defaults so newly-added fields are populated for existing users.
  config.value = { ...DEFAULT_BASE_STATION_CONFIG, ...config.value }

  const configPanelOpen = ref(false)

  const contextPopupOpen = ref(false)
  const contextPopupPosition = ref({ x: 0, y: 0 })

  const openContextPopup = (x: number, y: number): void => {
    contextPopupPosition.value = { x, y }
    contextPopupOpen.value = true
  }

  const closeContextPopup = (): void => {
    contextPopupOpen.value = false
  }

  const setPosition = (position: WaypointCoordinates): void => {
    config.value.position = [Number(position[0].toFixed(8)), Number(position[1].toFixed(8))]
    config.value.enabled = true
  }

  const remove = (): void => {
    config.value = { ...DEFAULT_BASE_STATION_CONFIG }
    configPanelOpen.value = false
    contextPopupOpen.value = false
  }

  return reactive({
    config,
    configPanelOpen,
    contextPopupOpen,
    contextPopupPosition,
    openContextPopup,
    closeContextPopup,
    setPosition,
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
