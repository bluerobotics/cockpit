import L, { type LayersControlEvent, type Map as LeafletMap } from 'leaflet'
import { watch } from 'vue'

import { downloadFileFromVehicle } from '@/libs/blueos-files'
import { createCachedTileLayer } from '@/libs/map/cached-tile-layer'
import { type TileArchiveSource, openTileArchive } from '@/libs/map/tile-archive'
import { tileArchiveFileName, tileProviderSubfolder } from '@/libs/map/tile-provider-import'
import { getCachedTileArchive, setCachedTileArchive } from '@/libs/map/tile-provider-storage'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { CustomTileProviderMeta } from '@/types/mission'

// Highest zoom a custom provider is shown at; tiles beyond the archive's native maximum are upscaled (overzoom).
const CUSTOM_PROVIDER_MAX_ZOOM = 23

/**
 * A materialized provider: its live Leaflet base layer, the signature it was built from, and any backing tile
 * source to release when it is torn down.
 */
interface ProviderEntry {
  /**
   * The live Leaflet layer registered as a selectable base layer.
   */
  layer: L.Layer
  /**
   * Snapshot of the metadata fields that require the layer to be rebuilt when they change.
   */
  signature: string
  /**
   * Releases the backing tile source (file providers only), if it was ever opened.
   */
  close?: () => void
}

/**
 * Return type of {@link useCustomTileProviders}.
 */
export interface UseCustomTileProvidersReturn {
  /**
   * Registers custom providers as selectable base layers on a Leaflet map's layer control and keeps them in
   * sync with the persisted metadata. `builtInBaseLayers` are the built-in base layers, used to deselect the
   * active one when restoring a custom provider as the map's base layer.
   */
  init: (map: LeafletMap, layerControl: L.Control.Layers, builtInBaseLayers: L.Layer[]) => void
  /**
   * Stops syncing and removes all custom provider layers from the map and control.
   */
  destroy: () => void
}

// Fields baked into the layer at build time (or into its control label); a change to any requires rebuilding.
const providerSignature = (meta: CustomTileProviderMeta): string =>
  JSON.stringify([
    meta.name,
    meta.type,
    meta.urlTemplate,
    meta.tms,
    meta.minZoom,
    meta.maxZoom,
    meta.attribution,
    meta.format,
  ])

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
  const vehicleStore = useMainVehicleStore()

  const entries = new Map<string, ProviderEntry>()
  let mapRef: LeafletMap | undefined
  let controlRef: L.Control.Layers | undefined
  let builtInBaseLayersRef: L.Layer[] = []
  let stopWatch: (() => void) | undefined
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

  // Resolves a file provider's archive: local render cache first, else download from the vehicle (the durable
  // master copy) and cache it before use. Runs only when the provider is first selected (lazy layer).
  const loadArchiveSource = async (meta: CustomTileProviderMeta): Promise<TileArchiveSource> => {
    let archive = await getCachedTileArchive(meta.id)
    if (!archive) {
      const vehicleAddress = vehicleStore.globalAddress
      if (!vehicleAddress) {
        throw new Error(`"${meta.name}" is not cached locally and no vehicle is connected to fetch it.`)
      }
      archive = await downloadFileFromVehicle(vehicleAddress, tileProviderSubfolder, tileArchiveFileName(meta))
      await setCachedTileArchive(meta.id, archive)
    }
    if (!meta.format) throw new Error(`"${meta.name}" has no archive format.`)
    return openTileArchive(archive, meta.format)
  }

  const buildUrlLayer = (meta: CustomTileProviderMeta): ProviderEntry => ({
    layer: L.tileLayer(meta.urlTemplate ?? '', {
      attribution: meta.attribution,
      tms: meta.tms ?? false,
      minZoom: meta.minZoom ?? 0,
      maxNativeZoom: meta.maxZoom,
      maxZoom: CUSTOM_PROVIDER_MAX_ZOOM,
    }),
    signature: providerSignature(meta),
  })

  const buildFileLayer = (meta: CustomTileProviderMeta): ProviderEntry => {
    let sourcePromise: Promise<TileArchiveSource> | undefined
    const sourceProvider = (): Promise<TileArchiveSource> => {
      sourcePromise = sourcePromise ?? loadArchiveSource(meta)
      return sourcePromise
    }
    const layer = createCachedTileLayer({
      sourceProvider,
      bounds: meta.bounds ? L.latLngBounds(meta.bounds) : undefined,
      attribution: meta.attribution,
      minZoom: meta.minZoom ?? 0,
      maxNativeZoom: meta.maxZoom,
      maxZoom: CUSTOM_PROVIDER_MAX_ZOOM,
    })
    const close = (): void => void sourcePromise?.then((source) => source.close()).catch(() => undefined)
    return { layer, signature: providerSignature(meta), close }
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
    const entry = meta.type === 'url' ? buildUrlLayer(meta) : buildFileLayer(meta)
    entries.set(meta.id, entry)
    controlRef?.addBaseLayer(entry.layer, meta.name)
    // Keep the provider active after a rebuild (e.g. a rename) if it was the map's base layer before.
    if (selectOnMap && mapRef) entry.layer.addTo(mapRef)
  }

  const reconcile = (): void => {
    if (!mapRef) return
    const metas = missionStore.customTileProviders
    const currentIds = new Set(metas.map((meta) => meta.id))

    for (const id of [...entries.keys()]) {
      if (!currentIds.has(id)) removeEntry(id)
    }

    for (const meta of metas) {
      const entry = entries.get(meta.id)
      if (!entry) {
        addEntry(meta, false)
      } else if (entry.signature !== providerSignature(meta)) {
        const wasActive = removeEntry(meta.id)
        addEntry(meta, wasActive)
      }
    }
  }

  // Restore the custom provider the user last selected as the base layer, replacing the built-in base map that
  // `getInitialLayers` seeded on load.
  const restoreSelection = (): void => {
    const id = missionStore.userLastCustomMapProviderId
    if (!id || !mapRef) return
    const entry = entries.get(id)
    if (!entry) return
    builtInBaseLayersRef.forEach((layer) => {
      if (mapRef?.hasLayer(layer)) mapRef.removeLayer(layer)
    })
    if (!mapRef.hasLayer(entry.layer)) entry.layer.addTo(mapRef)
  }

  const init = (map: LeafletMap, layerControl: L.Control.Layers, builtInBaseLayers: L.Layer[]): void => {
    mapRef = map
    controlRef = layerControl
    builtInBaseLayersRef = builtInBaseLayers
    reconcile()
    restoreSelection()
    stopWatch = watch(() => missionStore.customTileProviders, reconcile, { deep: true })

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
    if (mapRef && onBaseLayerChange) mapRef.off('baselayerchange', onBaseLayerChange)
    onBaseLayerChange = undefined
    for (const id of [...entries.keys()]) removeEntry(id)
    mapRef = undefined
    controlRef = undefined
    builtInBaseLayersRef = []
  }

  return { init, destroy }
}
