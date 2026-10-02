import { type Map as MapLibreMap, Marker } from 'maplibre-gl'
import { type ComputedRef, type Ref, computed, ref, watch } from 'vue'

import type { MapLayerSelectorEntry } from '@/composables/map/useMapTileLayerSelection'
import { OVERLAY_RENDER_VERSION, renderGeoTiffImage } from '@/libs/map/geotiff-overlay'
import {
  beforeIdForSlot,
  fitMapBounds,
  overlayBoundsToImageCoordinates,
  removeLayersAndSource,
  slottedLayerId,
} from '@/libs/map/maplibre'
import {
  type CachedOverlayRender,
  getCachedOverlayRender,
  mapOverlayStorage,
  setCachedOverlayRender,
} from '@/libs/map/overlay-storage'
import { useMissionStore } from '@/stores/mission'
import type { MapOverlayMeta } from '@/types/mission'

// Module-level so the rendered image is shared across every map instance: switching between the dashboard Map
// widget and the Mission Planning view reuses the cached image instead of re-parsing the (potentially large)
// raster. Backed by a persistent IndexedDB cache so it also survives app reloads. Entries are evicted when
// their overlay is removed from the mission.
const renderCache = new Map<string, CachedOverlayRender>()

const overlayEntryPrefix = 'geotiff:'

/**
 * A materialized overlay: its layer on the map plus the metadata signature it was built from.
 */
interface OverlayEntry {
  /**
   * Id of the overlay's image source and raster layer.
   */
  layerId: string
  /**
   * Snapshot of the metadata fields that require the layer to be rebuilt when they change.
   */
  signature: string
}

/**
 * Return type of {@link useMapOverlays}.
 */
export interface UseMapOverlaysReturn {
  /**
   * Ids of overlays whose raster is currently being rendered (used to show loading indicators).
   */
  loadingIds: Ref<string[]>
  /**
   * The drawn overlays as layer-selector rows, which hide or show an overlay on this map only.
   */
  selectorEntries: ComputedRef<MapLayerSelectorEntry[]>
  /**
   * Hides or shows an overlay on this map, from its layer-selector row.
   */
  setOverlayShown: (entryId: string, shown: boolean) => void
  /**
   * Binds the registry to a map and starts syncing overlays.
   */
  initOverlays: (map: MapLibreMap) => Promise<void>
  /**
   * Frames the map on the given overlay's bounds.
   */
  zoomToOverlay: (id: string) => void
  /**
   * Stops syncing and removes all overlay layers from the map.
   */
  destroyOverlays: () => void
}

// Fields whose change requires recreating the layer (the color function and label are baked in at build time).
const overlaySignature = (meta: MapOverlayMeta): string => JSON.stringify([meta.name, meta.renderMode])

const spinnerElement = (): HTMLElement => {
  const element = document.createElement('div')
  element.className = 'geotiff-overlay-spinner'
  element.style.pointerEvents = 'none'
  element.innerHTML =
    '<span class="mdi mdi-loading mdi-spin" style="font-size: 36px; color: #fff; text-shadow: 0 0 4px rgba(0, 0, 0, 0.7);"></span>'
  return element
}

/**
 * Manages the lifecycle of GeoTIFF overlays on a single map, keeping the rendered layers in sync with the persisted
 * overlay metadata in the mission store. Shared by the dashboard Map widget, the Mission Planning view and the MiniMap
 * so the overlay behavior lives in one place.
 * @returns {UseMapOverlaysReturn} Reactive loading state and methods to initialize, frame, and tear down the overlays.
 */
export const useMapOverlays = (): UseMapOverlaysReturn => {
  const missionStore = useMissionStore()

  const entries = new Map<string, OverlayEntry>()
  const placeholders = new Map<string, Marker>()
  const loadingIds = ref<string[]>([])
  // Overlays drawn on this map, and the ones unchecked in this map's layer selector, which is not persisted.
  const drawnIds = ref<string[]>([])
  const hiddenOnMap = ref<string[]>([])
  let mapRef: MapLibreMap | undefined
  let stopWatch: (() => void) | undefined
  let reconcileChain: Promise<void> = Promise.resolve()

  const setLoading = (id: string, loading: boolean): void => {
    const isTracked = loadingIds.value.includes(id)
    if (loading && !isTracked) loadingIds.value = [...loadingIds.value, id]
    else if (!loading && isTracked) loadingIds.value = loadingIds.value.filter((trackedId) => trackedId !== id)
  }

  // Show a spinner centered on the overlay's footprint while the raster renders, so the operator sees where the
  // overlay will appear during the (potentially slow) parse.
  const showPlaceholder = (meta: MapOverlayMeta): void => {
    if (!mapRef || placeholders.has(meta.id)) return
    const [[south, west], [north, east]] = meta.bounds
    const spinner = new Marker({ element: spinnerElement() })
      .setLngLat([(west + east) / 2, (south + north) / 2])
      .addTo(mapRef)
    placeholders.set(meta.id, spinner)
  }

  const hidePlaceholder = (id: string): void => {
    placeholders.get(id)?.remove()
    placeholders.delete(id)
  }

  const applyVisibility = (id: string): void => {
    const entry = entries.get(id)
    if (!mapRef || !entry || !mapRef.getLayer(entry.layerId)) return
    mapRef.setLayoutProperty(entry.layerId, 'visibility', hiddenOnMap.value.includes(id) ? 'none' : 'visible')
  }

  const removeEntry = (id: string): void => {
    hidePlaceholder(id)
    const entry = entries.get(id)
    if (!entry) return
    removeLayersAndSource(mapRef, [entry.layerId], entry.layerId)
    entries.delete(id)
    drawnIds.value = drawnIds.value.filter((drawnId) => drawnId !== id)
    hiddenOnMap.value = hiddenOnMap.value.filter((hiddenId) => hiddenId !== id)
  }

  const addEntry = async (meta: MapOverlayMeta): Promise<void> => {
    if (!mapRef) return

    const inMemory = renderCache.get(meta.id)
    let render = inMemory && inMemory.renderMode === meta.renderMode ? inMemory : undefined
    // In-memory hits are instant; the persistent-cache read and a full render both take time, so show the
    // loading placeholder whenever the image isn't already in memory.
    const showLoading = render === undefined

    if (showLoading) {
      setLoading(meta.id, true)
      showPlaceholder(meta)
    }
    try {
      // Tier 2: persistent IndexedDB cache (survives app reloads) — reads a small image instead of re-parsing
      // the (potentially huge) raster.
      if (!render) {
        const persisted = await getCachedOverlayRender(meta.id)
        if (persisted && persisted.renderMode === meta.renderMode && persisted.version === OVERLAY_RENDER_VERSION) {
          render = persisted
          renderCache.set(meta.id, render)
        }
      }

      // Tier 3: render from the raw raster (the expensive path), then populate both caches.
      if (!render) {
        const blob = await mapOverlayStorage.getItem(meta.id)
        if (!blob) {
          console.warn(`Map overlay "${meta.name}" has no stored raster; skipping render.`)
          return
        }
        const image = await renderGeoTiffImage(blob, meta.renderMode)
        render = {
          version: OVERLAY_RENDER_VERSION,
          renderMode: meta.renderMode,
          dataUrl: image.dataUrl,
          bounds: image.bounds,
        }
        renderCache.set(meta.id, render)
        await setCachedOverlayRender(meta.id, render)
      }

      // The map may have been torn down while the raster was rendering.
      if (!mapRef) return

      const layerId = slottedLayerId('geotiff', meta.id)
      mapRef.addSource(layerId, {
        type: 'image',
        url: render.dataUrl,
        coordinates: overlayBoundsToImageCoordinates(render.bounds),
      })
      mapRef.addLayer(
        {
          id: layerId,
          type: 'raster',
          source: layerId,
          paint: { 'raster-opacity': meta.opacity, 'raster-fade-duration': 0 },
        },
        beforeIdForSlot(mapRef, 'geotiff')
      )
      entries.set(meta.id, { layerId, signature: overlaySignature(meta) })
      drawnIds.value = [...drawnIds.value, meta.id]
    } finally {
      if (showLoading) {
        hidePlaceholder(meta.id)
        setLoading(meta.id, false)
      }
    }
  }

  // Only visible overlays are materialized as live layers; hidden ones keep just their metadata and stored
  // bytes, so memory is bounded by what the operator is actually viewing.
  const reconcile = async (): Promise<void> => {
    if (!mapRef) return
    const metas = missionStore.mapOverlays

    // Reclaim cached renders for overlays that have been removed from the mission entirely (hidden ones keep
    // their cache so re-showing stays instant).
    const allIds = new Set(metas.map((meta) => meta.id))
    for (const id of [...renderCache.keys()]) {
      if (!allIds.has(id)) renderCache.delete(id)
    }

    const visibleIds = new Set(metas.filter((meta) => meta.visible).map((meta) => meta.id))

    for (const id of [...entries.keys()]) {
      if (!visibleIds.has(id)) removeEntry(id)
    }

    for (const meta of metas) {
      if (!meta.visible) continue
      const entry = entries.get(meta.id)
      if (!entry) {
        await addEntry(meta)
      } else if (entry.signature !== overlaySignature(meta)) {
        removeEntry(meta.id)
        await addEntry(meta)
      } else if (mapRef?.getLayer(entry.layerId)) {
        mapRef.setPaintProperty(entry.layerId, 'raster-opacity', meta.opacity)
      }
    }
  }

  // Serialize reconciles so rapid metadata changes can't interleave layer creation/removal.
  const scheduleReconcile = (): Promise<void> => {
    reconcileChain = reconcileChain.then(reconcile).catch((error) => {
      console.error('Failed to sync map overlays:', error)
    })
    return reconcileChain
  }

  const selectorEntries = computed<MapLayerSelectorEntry[]>(() =>
    drawnIds.value.map((id) => ({
      id: `${overlayEntryPrefix}${id}`,
      label: missionStore.mapOverlays.find((overlay) => overlay.id === id)?.name ?? id,
      active: !hiddenOnMap.value.includes(id),
    }))
  )

  const setOverlayShown = (entryId: string, shown: boolean): void => {
    if (!entryId.startsWith(overlayEntryPrefix)) return
    const id = entryId.slice(overlayEntryPrefix.length)
    const label = selectorEntries.value.find((entry) => entry.id === entryId)?.label ?? id
    logUserAction(`${shown ? 'Enabled' : 'Disabled'} map overlay '${label}'`)
    hiddenOnMap.value = shown
      ? hiddenOnMap.value.filter((hiddenId) => hiddenId !== id)
      : [...new Set([...hiddenOnMap.value, id])]
    applyVisibility(id)
  }

  const initOverlays = async (map: MapLibreMap): Promise<void> => {
    mapRef = map
    await scheduleReconcile()
    stopWatch = watch(
      () => missionStore.mapOverlays,
      () => scheduleReconcile(),
      { deep: true }
    )
  }

  const zoomToOverlay = (id: string): void => {
    const meta = missionStore.mapOverlays.find((overlay) => overlay.id === id)
    if (!meta || !mapRef) return
    const [[south, west], [north, east]] = meta.bounds
    fitMapBounds(mapRef, [
      [west, south],
      [east, north],
    ])
  }

  const destroyOverlays = (): void => {
    stopWatch?.()
    stopWatch = undefined
    for (const id of [...entries.keys()]) removeEntry(id)
    for (const id of [...placeholders.keys()]) hidePlaceholder(id)
    loadingIds.value = []
    mapRef = undefined
  }

  return { loadingIds, selectorEntries, setOverlayShown, initOverlays, zoomToOverlay, destroyOverlays }
}
