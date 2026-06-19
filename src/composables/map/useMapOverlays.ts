import L, { type Map as LeafletMap } from 'leaflet'
import { type Ref, ref, watch } from 'vue'

import { OVERLAY_RENDER_VERSION, renderGeoTiffImage } from '@/libs/map/geotiff-overlay'
import {
  type CachedOverlayRender,
  getCachedOverlayRender,
  mapOverlayStorage,
  setCachedOverlayRender,
} from '@/libs/map/overlay-storage'
import { useMissionStore } from '@/stores/mission'
import type { MapOverlayMeta } from '@/types/mission'

const OVERLAY_PANE = 'geotiffOverlayPane'

// Module-level so the rendered image is shared across every map instance: switching between the dashboard Map
// widget and the Mission Planning view reuses the cached image instead of re-parsing the (potentially large)
// raster. Backed by a persistent IndexedDB cache so it also survives app reloads. Entries are evicted when
// their overlay is removed from the mission.
const renderCache = new Map<string, CachedOverlayRender>()

/**
 * A materialized overlay: its live Leaflet layer plus the metadata signature it was built from.
 */
interface OverlayEntry {
  /**
   * The live Leaflet layer rendering the overlay.
   */
  layer: L.ImageOverlay
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
   * Binds the registry to a Leaflet map (and optional layer control) and starts syncing overlays.
   */
  initOverlays: (map: LeafletMap, layerControl?: L.Control.Layers) => Promise<void>
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

/**
 * Manages the lifecycle of GeoTIFF overlays on a single Leaflet map, keeping the rendered layers in sync with
 * the persisted overlay metadata in the mission store. Shared by the dashboard Map widget and the Mission
 * Planning view so the overlay behavior lives in one place.
 * @returns {UseMapOverlaysReturn} Reactive loading state and methods to initialize, frame, and tear down the overlays.
 */
export const useMapOverlays = (): UseMapOverlaysReturn => {
  const missionStore = useMissionStore()

  const entries = new Map<string, OverlayEntry>()
  const placeholders = new Map<string, L.LayerGroup>()
  const loadingIds = ref<string[]>([])
  let mapRef: LeafletMap | undefined
  let controlRef: L.Control.Layers | undefined
  let stopWatch: (() => void) | undefined
  let reconcileChain: Promise<void> = Promise.resolve()

  const ensurePane = (): void => {
    if (!mapRef || mapRef.getPane(OVERLAY_PANE)) return
    // Above the base tile pane (200) but below vector overlays/markers so mission data stays on top.
    mapRef.createPane(OVERLAY_PANE).style.zIndex = '250'
  }

  const setLoading = (id: string, loading: boolean): void => {
    const isTracked = loadingIds.value.includes(id)
    if (loading && !isTracked) loadingIds.value = [...loadingIds.value, id]
    else if (!loading && isTracked) loadingIds.value = loadingIds.value.filter((trackedId) => trackedId !== id)
  }

  // Show a spinner centered on the overlay's footprint while the raster renders, so the operator sees where the
  // overlay will appear during the (potentially slow) parse.
  const showPlaceholder = (meta: MapOverlayMeta): void => {
    if (!mapRef || placeholders.has(meta.id)) return
    const bounds = L.latLngBounds(meta.bounds)
    const spinner = L.marker(bounds.getCenter(), {
      pane: OVERLAY_PANE,
      interactive: false,
      icon: L.divIcon({
        className: 'geotiff-overlay-spinner',
        html: '<span class="mdi mdi-loading mdi-spin" style="font-size: 36px; color: #fff; text-shadow: 0 0 4px rgba(0, 0, 0, 0.7);"></span>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    })
    placeholders.set(meta.id, L.layerGroup([spinner]).addTo(mapRef))
  }

  const hidePlaceholder = (id: string): void => {
    const group = placeholders.get(id)
    if (!group) return
    mapRef?.removeLayer(group)
    placeholders.delete(id)
  }

  const removeEntry = (id: string): void => {
    hidePlaceholder(id)
    const entry = entries.get(id)
    if (!entry) return
    controlRef?.removeLayer(entry.layer)
    mapRef?.removeLayer(entry.layer)
    entries.delete(id)
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

      const layer = L.imageOverlay(render.dataUrl, L.latLngBounds(render.bounds), {
        opacity: meta.opacity,
        pane: OVERLAY_PANE,
        interactive: false,
      })
      entries.set(meta.id, { layer, signature: overlaySignature(meta) })
      controlRef?.addOverlay(layer, meta.name)
      layer.addTo(mapRef)
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
      } else {
        entry.layer.setOpacity?.(meta.opacity)
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

  const initOverlays = async (map: LeafletMap, layerControl?: L.Control.Layers): Promise<void> => {
    mapRef = map
    controlRef = layerControl
    ensurePane()
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
    mapRef.fitBounds(L.latLngBounds(meta.bounds))
  }

  const destroyOverlays = (): void => {
    stopWatch?.()
    stopWatch = undefined
    for (const id of [...entries.keys()]) removeEntry(id)
    for (const id of [...placeholders.keys()]) hidePlaceholder(id)
    loadingIds.value = []
    mapRef = undefined
    controlRef = undefined
  }

  return { loadingIds, initOverlays, zoomToOverlay, destroyOverlays }
}
