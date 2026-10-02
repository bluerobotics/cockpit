import type { Map as MapLibreMap } from 'maplibre-gl'
import { type ComputedRef, computed, ref, watch } from 'vue'

import { useCustomTileProviders } from '@/composables/map/useCustomTileProviders'
import type { MapTileLayers } from '@/composables/map/useMapTileLayers'
import type { NoiseTileOptions } from '@/libs/map/map-tile-fallback'
import { removeLayersAndSource } from '@/libs/map/maplibre'
import {
  type RasterLayerDefinition,
  addRasterLayer,
  rasterLayerId,
  refreshRasterLayerTiles,
  setRasterLayerVisible,
} from '@/libs/map/raster-layers'
import { registerTileProtocols } from '@/libs/map/tile-protocol'
import { useMissionStore } from '@/stores/mission'
import type { MapTileProvider } from '@/types/mission'

type OverlayPersistenceFlag = 'userLastMapShowSeamarks' | 'userLastMapShowMarineProfile'

// Maps each overlay's layer-selector label to the mission-store flag that persists its toggle.
const overlayPersistenceFlags: Record<string, OverlayPersistenceFlag> = {
  'Seamarks': 'userLastMapShowSeamarks',
  'Marine Profile': 'userLastMapShowMarineProfile',
}

const customEntryPrefix = 'custom:'

// Shown when the preferred base map is unavailable, as it always was.
const esriProvider: MapTileProvider = 'Esri World Imagery'

/**
 * One row of the map layer selector.
 */
export interface MapLayerSelectorEntry {
  /**
   * Id the selector reports back when the row is picked.
   */
  id: string
  /**
   * Name shown for the row.
   */
  label: string
  /**
   * Whether the layer is currently shown.
   */
  active: boolean
}

/**
 * A map's base-map and overlay selection.
 */
export interface MapTileLayerSelection {
  /**
   * The base maps the selector offers, built-in ones first and then the custom providers.
   */
  baseLayers: ComputedRef<MapLayerSelectorEntry[]>
  /**
   * The tile overlays the selector offers.
   */
  overlays: ComputedRef<MapLayerSelectorEntry[]>
  /**
   * Draws the tile layers on a map, restoring the user's last choice, and keeps them in sync with the settings.
   */
  init: (map: MapLibreMap) => void
  /**
   * Shows a base map the user picked in the selector, and persists the choice.
   */
  selectBaseLayer: (id: string) => void
  /**
   * Shows or hides an overlay the user toggled in the selector, and persists the choice.
   */
  setOverlayEnabled: (id: string, enabled: boolean) => void
  /**
   * Stops syncing and removes the tile layers from the map.
   */
  destroy: () => void
}

/**
 * Draws a map's tile layers and syncs its base-map and overlay selection with the mission store, restoring the user's
 * last choice on load and persisting the ones made in the layer selector. Complements the `useMapTileLayers` factory,
 * which only defines the layers.
 * @param {MapTileLayers} tileLayers - The layers defined by `useMapTileLayers`.
 * @param {() => NoiseTileOptions} fallbackOptions - The noise background drawn under failed base-map tiles.
 * @returns {MapTileLayerSelection} The selector rows and the methods to bind, change and tear down the selection.
 */
export const useMapTileLayerSelection = (
  tileLayers: MapTileLayers,
  fallbackOptions: () => NoiseTileOptions
): MapTileLayerSelection => {
  const missionStore = useMissionStore()
  const customProviders = useCustomTileProviders()
  const { baseMaps, overlays: overlayDefinitions, extraOsm } = tileLayers

  const activeBuiltIn = ref<MapTileProvider | undefined>()
  const enabledOverlays = ref<string[]>([])
  const stopWatches: (() => void)[] = []
  let mapRef: MapLibreMap | undefined

  const preferredBuiltInProvider = (): MapTileProvider => {
    const preferred =
      missionStore.defaultMapTileProvider === 'Use last selected'
        ? missionStore.userLastMapTileProvider
        : missionStore.defaultMapTileProvider
    return baseMaps[preferred] ? preferred : esriProvider
  }

  const fallbackDefinitions = (): RasterLayerDefinition[] =>
    [...Object.values(baseMaps), ...(extraOsm ? [extraOsm] : [])].filter((definition) => definition.noiseFallback)

  const showBuiltIn = (provider: MapTileProvider | undefined): void => {
    activeBuiltIn.value = provider
    if (!mapRef) return
    for (const [name, definition] of Object.entries(baseMaps)) {
      setRasterLayerVisible(mapRef, rasterLayerId('base', definition.id), name === provider)
    }
  }

  const showOverlay = (name: string, enabled: boolean): void => {
    enabledOverlays.value = enabled
      ? [...new Set([...enabledOverlays.value, name])]
      : enabledOverlays.value.filter((overlay) => overlay !== name)
    const definition = overlayDefinitions[name]
    if (mapRef && definition) setRasterLayerVisible(mapRef, rasterLayerId('raster-overlay', definition.id), enabled)
  }

  const baseLayers = computed<MapLayerSelectorEntry[]>(() => [
    ...Object.keys(baseMaps).map((name) => ({
      id: name,
      label: name,
      active: !customProviders.activeId.value && activeBuiltIn.value === name,
    })),
    ...customProviders.entries.value.map((entry) => ({
      id: `${customEntryPrefix}${entry.id}`,
      label: entry.label,
      active: customProviders.activeId.value === entry.id,
    })),
  ])

  const overlays = computed<MapLayerSelectorEntry[]>(() =>
    Object.keys(overlayDefinitions).map((name) => ({
      id: name,
      label: name,
      active: enabledOverlays.value.includes(name),
    }))
  )

  const init = (map: MapLibreMap): void => {
    mapRef = map
    registerTileProtocols()
    const fallback = fallbackOptions()
    const initialProvider = preferredBuiltInProvider()

    // The extra OSM layer goes under the base maps, where Leaflet's layer control z-indexes left it, showing only
    // through gaps in the selected one.
    if (extraOsm) addRasterLayer(map, extraOsm, { slot: 'base', visible: true, fallback })
    for (const [name, definition] of Object.entries(baseMaps)) {
      addRasterLayer(map, definition, { slot: 'base', visible: name === initialProvider, fallback })
    }
    activeBuiltIn.value = initialProvider

    for (const [name, definition] of Object.entries(overlayDefinitions)) {
      const flag = overlayPersistenceFlags[name]
      const enabled = Boolean(flag && missionStore[flag])
      addRasterLayer(map, definition, { slot: 'raster-overlay', visible: enabled })
      if (enabled) enabledOverlays.value = [...enabledOverlays.value, name]
    }

    customProviders.init(map, () => showBuiltIn(preferredBuiltInProvider()))

    // Restore the custom provider the user last selected, replacing the built-in base map seeded above. An explicit
    // default provider outranks the last selection, the same way `preferredBuiltInProvider` treats it.
    const lastCustomId = missionStore.userLastCustomMapProviderId
    if (missionStore.defaultMapTileProvider === 'Use last selected' && lastCustomId) {
      customProviders.select(lastCustomId)
      if (customProviders.activeId.value) showBuiltIn(undefined)
    }

    stopWatches.push(
      watch(
        () => missionStore.defaultMapTileProvider,
        (preference) => {
          if (preference === 'Use last selected' || !baseMaps[preference]) return
          customProviders.select(undefined)
          missionStore.userLastCustomMapProviderId = null
          showBuiltIn(preference)
        }
      ),
      // Settings tweaks to the noise background apply to the tiles already drawn, not only to the next ones.
      watch(fallbackOptions, (options) => {
        if (!mapRef) return
        for (const definition of fallbackDefinitions()) {
          refreshRasterLayerTiles(mapRef, rasterLayerId('base', definition.id), definition, { fallback: options })
        }
      })
    )
  }

  const selectBaseLayer = (id: string): void => {
    if (id.startsWith(customEntryPrefix)) {
      const providerId = id.slice(customEntryPrefix.length)
      const label = customProviders.entries.value.find((entry) => entry.id === providerId)?.label ?? providerId
      logUserAction(`Switched map base layer to '${label}'`)
      showBuiltIn(undefined)
      customProviders.select(providerId, true)
      missionStore.userLastCustomMapProviderId = providerId
      return
    }
    const provider = id as MapTileProvider
    if (!baseMaps[provider]) return
    logUserAction(`Switched map base layer to '${provider}'`)
    customProviders.select(undefined)
    showBuiltIn(provider)
    missionStore.userLastMapTileProvider = provider
    missionStore.userLastCustomMapProviderId = null
  }

  const setOverlayEnabled = (id: string, enabled: boolean): void => {
    if (!overlayDefinitions[id]) return
    logUserAction(`${enabled ? 'Enabled' : 'Disabled'} map overlay '${id}'`)
    showOverlay(id, enabled)
    const flag = overlayPersistenceFlags[id]
    if (flag) missionStore[flag] = enabled
  }

  const destroy = (): void => {
    stopWatches.splice(0).forEach((stop) => stop())
    customProviders.destroy()
    if (mapRef) {
      const ids = [
        ...Object.values(baseMaps).map((definition) => rasterLayerId('base', definition.id)),
        ...(extraOsm ? [rasterLayerId('base', extraOsm.id)] : []),
        ...Object.values(overlayDefinitions).map((definition) => rasterLayerId('raster-overlay', definition.id)),
      ]
      ids.forEach((id) => removeLayersAndSource(mapRef, [id], id))
    }
    mapRef = undefined
  }

  return { baseLayers, overlays, init, selectBaseLayer, setOverlayEnabled, destroy }
}
