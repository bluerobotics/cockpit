import { type Ref, ref, watch } from 'vue'

import {
  type MountedCustomTileProviderLayer,
  customTileProviderSignature,
  useCustomTileProviderLayer,
} from '@/composables/map/useCustomTileProviderLayer'
import type { CockpitMap } from '@/libs/map/cesium-map'
import { setRasterLayerVisible } from '@/libs/map/raster-layers'
import { useMissionStore } from '@/stores/mission'
import type { CustomTileProviderMeta } from '@/types/mission'

/**
 * A materialized provider: its layer on the map and the signature it was built from.
 */
interface ProviderEntry extends MountedCustomTileProviderLayer {
  /**
   * Snapshot of the metadata fields that require the layer to be rebuilt when they change.
   */
  signature: string
}

/**
 * A custom provider as the layer selector lists it.
 */
export interface CustomTileProviderEntry {
  /**
   * The provider id.
   */
  id: string
  /**
   * The provider name.
   */
  label: string
}

/**
 * Return type of {@link useCustomTileProviders}.
 */
export interface UseCustomTileProvidersReturn {
  /**
   * The providers drawn on the map, in settings order.
   */
  entries: Ref<CustomTileProviderEntry[]>
  /**
   * Id of the provider currently shown as the base layer, if any.
   */
  activeId: Ref<string | undefined>
  /**
   * Draws the custom providers on a map (hidden) and keeps them in sync with the persisted metadata.
   * `onActiveRemoved` is called when the provider shown as the base layer is deleted, so the caller can put a
   * built-in base map back.
   */
  init: (map: CockpitMap, onActiveRemoved: () => void) => void
  /**
   * Shows one provider as the base layer and hides the others, or hides all of them when given undefined.
   * `frame` jumps to the provider's area, for a selection the user just made.
   */
  select: (id: string | undefined, frame?: boolean) => void
  /**
   * Stops syncing and removes all custom provider layers from the map.
   */
  destroy: () => void
}

/**
 * Draws user-defined custom tile providers as selectable base layers on a single map, keeping them in sync with the
 * persisted provider metadata in the mission store. Shared by the dashboard Map widget and the Mission Planning view
 * through `useMapTileLayerSelection`. Management (add/rename/delete/import) lives in the Sources config panel, not
 * here.
 * @returns {UseCustomTileProvidersReturn} The provider list and methods to bind, select and tear down.
 */
export const useCustomTileProviders = (): UseCustomTileProvidersReturn => {
  const missionStore = useMissionStore()
  const { mountLayer } = useCustomTileProviderLayer()

  const layers = new Map<string, ProviderEntry>()
  const entries = ref<CustomTileProviderEntry[]>([])
  const activeId = ref<string | undefined>()
  let mapRef: CockpitMap | undefined
  let onActiveRemovedRef: (() => void) | undefined
  let stopWatch: (() => void) | undefined

  // Regional archives (common for PMTiles demos) only have tiles inside their bounds. Jump there on select so
  // the map does not look "broken" when the previous view was elsewhere.
  const fitProviderBounds = (meta: CustomTileProviderMeta): void => {
    if (!mapRef || !meta.bounds) return
    mapRef.fitBounds(meta.bounds, { maxZoom: Math.min(meta.maxZoom ?? 12, 12), padding: 24 })
  }

  const removeLayer = (id: string): void => {
    layers.get(id)?.close()
    layers.delete(id)
  }

  const addLayer = (meta: CustomTileProviderMeta): void => {
    if (!mapRef) return
    const mounted = mountLayer(mapRef, meta, { slot: 'base', visible: activeId.value === meta.id })
    layers.set(meta.id, { ...mounted, signature: customTileProviderSignature(meta) })
  }

  const reconcile = (): void => {
    if (!mapRef) return
    const metas = missionStore.customTileProviders
    const currentIds = new Set(metas.map((meta) => meta.id))

    // Deleting the provider the map is drawing would otherwise leave it with overlays over an empty background.
    for (const id of [...layers.keys()]) {
      if (currentIds.has(id)) continue
      removeLayer(id)
      if (activeId.value === id) {
        activeId.value = undefined
        missionStore.userLastCustomMapProviderId = null
        onActiveRemovedRef?.()
      }
    }

    // A rebuild (e.g. a rename) keeps the provider active, since `addLayer` reads the active id.
    for (const meta of metas) {
      const layer = layers.get(meta.id)
      if (layer?.signature === customTileProviderSignature(meta)) continue
      if (layer) removeLayer(meta.id)
      addLayer(meta)
    }

    entries.value = metas.map((meta) => ({ id: meta.id, label: meta.name }))
  }

  const select = (id: string | undefined, frame = false): void => {
    activeId.value = id && layers.has(id) ? id : undefined
    if (mapRef) {
      for (const [layerId, layer] of layers) setRasterLayerVisible(mapRef, layer.id, layerId === activeId.value)
    }
    const meta = missionStore.customTileProviders.find((provider) => provider.id === activeId.value)
    if (frame && meta) fitProviderBounds(meta)
  }

  const init = (map: CockpitMap, onActiveRemoved: () => void): void => {
    mapRef = map
    onActiveRemovedRef = onActiveRemoved
    reconcile()
    stopWatch = watch(() => missionStore.customTileProviders, reconcile, { deep: true })
  }

  const destroy = (): void => {
    stopWatch?.()
    stopWatch = undefined
    for (const id of [...layers.keys()]) removeLayer(id)
    entries.value = []
    activeId.value = undefined
    mapRef = undefined
    onActiveRemovedRef = undefined
  }

  return { entries, activeId, init, select, destroy }
}
