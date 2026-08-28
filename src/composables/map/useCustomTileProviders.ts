import L, { type LayersControlEvent, type Map as LeafletMap } from 'leaflet'
import { watch } from 'vue'

import {
  type CustomTileProviderLayer,
  customTileProviderSignature,
  useCustomTileProviderLayer,
} from '@/composables/map/useCustomTileProviderLayer'
import { useMissionStore } from '@/stores/mission'
import type { CustomTileProviderMeta } from '@/types/mission'

/**
 * A materialized provider: its live Leaflet base layer, any backing tile source to release when it is torn
 * down, and the signature it was built from.
 */
interface ProviderEntry extends CustomTileProviderLayer {
  /**
   * Snapshot of the metadata fields that require the layer to be rebuilt when they change.
   */
  signature: string
}

/**
 * Return type of {@link useCustomTileProviders}.
 */
export interface UseCustomTileProvidersReturn {
  /**
   * Registers custom providers as selectable base layers on a Leaflet map's layer control and keeps them in
   * sync with the persisted metadata. `builtInBaseLayers` are the built-in base layers, used to deselect the
   * active one when restoring a custom provider as the map's base layer, and `preferredBuiltInBaseLayer`
   * resolves the one to fall back to when the active custom provider is deleted.
   */
  init: (
    map: LeafletMap,
    layerControl: L.Control.Layers,
    builtInBaseLayers: L.Layer[],
    preferredBuiltInBaseLayer: () => L.Layer
  ) => void
  /**
   * Stops syncing and removes all custom provider layers from the map and control.
   */
  destroy: () => void
}

/**
 * Registers user-defined custom tile providers as selectable base layers on a single Leaflet map, keeping the
 * layer-control entries in sync with the persisted provider metadata in the mission store. Shared by the
 * dashboard Map widget and the Mission Planning view, so each view only calls {@link UseCustomTileProvidersReturn.init}
 * and {@link UseCustomTileProvidersReturn.destroy}. Management (add/rename/delete/import) lives in the Sources
 * config panel, not here.
 * @returns {UseCustomTileProvidersReturn} Methods to bind and tear down the providers on a map.
 */
export const useCustomTileProviders = (): UseCustomTileProvidersReturn => {
  const missionStore = useMissionStore()
  const { createLayer } = useCustomTileProviderLayer()

  const entries = new Map<string, ProviderEntry>()
  let mapRef: LeafletMap | undefined
  let controlRef: L.Control.Layers | undefined
  let builtInBaseLayersRef: L.Layer[] = []
  let preferredBuiltInBaseLayerRef: (() => L.Layer) | undefined
  let stopWatch: (() => void) | undefined
  let stopDefaultProviderWatch: (() => void) | undefined
  let onBaseLayerChange: ((event: LayersControlEvent) => void) | undefined

  // Regional archives (common for PMTiles demos) only have tiles inside their bounds. Jump there on select so
  // the map does not look "broken" when the previous view was elsewhere.
  const fitProviderBounds = (meta: CustomTileProviderMeta): void => {
    if (!mapRef || !meta.bounds) return
    mapRef.fitBounds(L.latLngBounds(meta.bounds), {
      maxZoom: Math.min(meta.maxZoom ?? 12, 12),
      padding: [24, 24],
    })
  }

  const removeEntry = (id: string): boolean => {
    const entry = entries.get(id)
    if (!entry) return false
    const wasActive = Boolean(mapRef?.hasLayer(entry.layer))
    controlRef?.removeLayer(entry.layer)
    mapRef?.removeLayer(entry.layer)
    entry.close?.()
    entries.delete(id)
    return wasActive
  }

  const addEntry = (meta: CustomTileProviderMeta, selectOnMap: boolean): void => {
    const entry = { ...createLayer(meta), signature: customTileProviderSignature(meta) }
    entries.set(meta.id, entry)
    controlRef?.addBaseLayer(entry.layer, meta.name)
    // Keep the provider active after a rebuild (e.g. a rename) if it was the map's base layer before.
    if (selectOnMap && mapRef) entry.layer.addTo(mapRef)
  }

  const reconcile = (): void => {
    if (!mapRef) return
    const metas = missionStore.customTileProviders
    const currentIds = new Set(metas.map((meta) => meta.id))

    // Deleting the provider the map is drawing would otherwise leave it with overlays over an empty background,
    // since nothing else puts a base layer back outside `init` and the default-provider watch.
    let removedActiveProvider = false
    for (const id of [...entries.keys()]) {
      if (!currentIds.has(id)) removedActiveProvider = removeEntry(id) || removedActiveProvider
    }
    if (removedActiveProvider && preferredBuiltInBaseLayerRef) {
      const fallback = preferredBuiltInBaseLayerRef()
      if (!mapRef.hasLayer(fallback)) fallback.addTo(mapRef)
      missionStore.userLastCustomMapProviderId = null
    }

    for (const meta of metas) {
      const entry = entries.get(meta.id)
      if (!entry) {
        addEntry(meta, false)
      } else if (entry.signature !== customTileProviderSignature(meta)) {
        const wasActive = removeEntry(meta.id)
        addEntry(meta, wasActive)
      }
    }
  }

  const deselectCustomLayers = (): void => {
    for (const entry of entries.values()) {
      if (mapRef?.hasLayer(entry.layer)) mapRef.removeLayer(entry.layer)
    }
  }

  // Restore the custom provider the user last selected as the base layer, replacing the built-in base map that
  // `getInitialLayers` seeded on load.
  const restoreSelection = (): void => {
    // An explicit default provider outranks the last selection, the same way `preferredBaseLayer` treats it.
    if (missionStore.defaultMapTileProvider !== 'Use last selected') return
    const id = missionStore.userLastCustomMapProviderId
    if (!id || !mapRef) return
    const entry = entries.get(id)
    if (!entry) return
    builtInBaseLayersRef.forEach((layer) => {
      if (mapRef?.hasLayer(layer)) mapRef.removeLayer(layer)
    })
    if (!mapRef.hasLayer(entry.layer)) entry.layer.addTo(mapRef)
  }

  const init = (
    map: LeafletMap,
    layerControl: L.Control.Layers,
    builtInBaseLayers: L.Layer[],
    preferredBuiltInBaseLayer: () => L.Layer
  ): void => {
    mapRef = map
    controlRef = layerControl
    builtInBaseLayersRef = builtInBaseLayers
    preferredBuiltInBaseLayerRef = preferredBuiltInBaseLayer
    reconcile()
    restoreSelection()
    stopWatch = watch(() => missionStore.customTileProviders, reconcile, { deep: true })

    // Picking an explicit built-in default must also drop the active custom layer, which the built-in selection
    // sync cannot do: it only knows about the built-in base maps.
    stopDefaultProviderWatch = watch(
      () => missionStore.defaultMapTileProvider,
      (preference) => {
        if (preference === 'Use last selected') return
        deselectCustomLayers()
        missionStore.userLastCustomMapProviderId = null
      }
    )

    // Persist the selection by layer identity (not name, which is not guaranteed unique) and frame its bounds.
    onBaseLayerChange = (event: LayersControlEvent) => {
      for (const [id, entry] of entries) {
        if (entry.layer !== event.layer) continue
        missionStore.userLastCustomMapProviderId = id
        const meta = missionStore.customTileProviders.find((provider) => provider.id === id)
        if (meta) fitProviderBounds(meta)
        break
      }
    }
    map.on('baselayerchange', onBaseLayerChange)
  }

  const destroy = (): void => {
    stopWatch?.()
    stopWatch = undefined
    stopDefaultProviderWatch?.()
    stopDefaultProviderWatch = undefined
    if (mapRef && onBaseLayerChange) mapRef.off('baselayerchange', onBaseLayerChange)
    onBaseLayerChange = undefined
    for (const id of [...entries.keys()]) removeEntry(id)
    mapRef = undefined
    controlRef = undefined
    builtInBaseLayersRef = []
    preferredBuiltInBaseLayerRef = undefined
  }

  return { init, destroy }
}
