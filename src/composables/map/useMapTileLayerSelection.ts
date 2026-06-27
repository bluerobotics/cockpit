import L, { type Control, type Layer, type LayersControlEvent, type Map as LeafletMap } from 'leaflet'
import { watch } from 'vue'

import type { MapTileLayers } from '@/composables/map/useMapTileLayers'
import { useMissionStore } from '@/stores/mission'
import type { MapTileProvider } from '@/types/mission'

type OverlayPersistenceFlag = 'userLastMapShowSeamarks' | 'userLastMapShowMarineProfile'

// Maps each overlay's layer-control label to the mission-store flag that persists its toggle.
const overlayPersistenceFlags: Record<string, OverlayPersistenceFlag> = {
  'Seamarks': 'userLastMapShowSeamarks',
  'Marine Profile': 'userLastMapShowMarineProfile',
}

/**
 * Helpers to seed and persist a map's base-map and overlay selection.
 */
export interface MapTileLayerSelection {
  /**
   * Builds the map's initial base layer plus any overlays the user last had enabled.
   */
  getInitialLayers: () => Layer[]
  /**
   * Builds the leaflet layer control listing the base maps and overlays.
   */
  createLayerControl: () => Control.Layers
  /**
   * Wires base-layer and overlay selection persistence and the default-provider watch to a map.
   */
  registerLayerSync: (map: LeafletMap) => void
}

/**
 * Syncs a leaflet map's base-map and overlay selection with the mission store, restoring the
 * user's last choice on load and persisting it on change. Complements the `useMapTileLayers`
 * factory, which only builds the layers.
 * @param {MapTileLayers} tileLayers - The layers built by `useMapTileLayers`.
 * @returns {MapTileLayerSelection} Helpers to seed the initial layers, build the layer control, and register persistence.
 */
export const useMapTileLayerSelection = (tileLayers: MapTileLayers): MapTileLayerSelection => {
  const missionStore = useMissionStore()
  const { baseMaps, overlays, esri } = tileLayers

  const preferredBaseLayer = (): L.TileLayer => {
    const preferredProvider =
      missionStore.defaultMapTileProvider === 'Use last selected'
        ? missionStore.userLastMapTileProvider
        : missionStore.defaultMapTileProvider
    return baseMaps[preferredProvider] || esri
  }

  const getInitialLayers = (): Layer[] => {
    const layers: Layer[] = [preferredBaseLayer()]
    Object.entries(overlays).forEach(([name, layer]) => {
      const flag = overlayPersistenceFlags[name]
      if (flag && missionStore[flag]) layers.push(layer)
    })
    return layers
  }

  const createLayerControl = (): Control.Layers => L.control.layers(baseMaps, overlays)

  const registerLayerSync = (map: LeafletMap): void => {
    // These layers-control events only fire from user clicks on the control, so logging here reflects a real
    // interaction (programmatic base/overlay changes go through map.addLayer/removeLayer, not the control).
    map.on('baselayerchange', (event: LayersControlEvent) => {
      const name = event.name
      if (!name.includes(name as MapTileProvider)) return
      logUserAction(`Switched map base layer to '${event.name}'`)
      missionStore.userLastMapTileProvider = event.name as MapTileProvider
    })

    const persistOverlay = (name: string, enabled: boolean): void => {
      logUserAction(`${enabled ? 'Enabled' : 'Disabled'} map overlay '${name}'`)
      const flag = overlayPersistenceFlags[name]
      if (flag) missionStore[flag] = enabled
    }
    map.on('overlayadd', (event: LayersControlEvent) => persistOverlay(event.name, true))
    map.on('overlayremove', (event: LayersControlEvent) => persistOverlay(event.name, false))

    watch(
      () => missionStore.defaultMapTileProvider,
      (newPref) => {
        if (newPref === 'Use last selected') return
        const targetLayer = baseMaps[newPref]
        if (!targetLayer) return
        Object.values(baseMaps).forEach((layer) => {
          if (layer !== targetLayer && map.hasLayer(layer)) map.removeLayer(layer)
        })
        if (!map.hasLayer(targetLayer)) map.addLayer(targetLayer)
      }
    )
  }

  return { getInitialLayers, createLayerControl, registerLayerSync }
}
