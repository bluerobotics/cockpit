import L from 'leaflet'
import { watchEffect } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { downloadFileFromVehicle } from '@/libs/blueos-files'
import { createCachedTileLayer } from '@/libs/map/cached-tile-layer'
import { type TileArchiveSource, openTileArchive } from '@/libs/map/tile-archive'
import { archiveTransferTimeout, tileArchiveFileName, tileProviderSubfolder } from '@/libs/map/tile-provider-import'
import { getCachedTileArchive, setCachedTileArchive } from '@/libs/map/tile-provider-storage'
import { messageFromError } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { CustomTileProviderMeta } from '@/types/mission'

// Highest zoom a custom provider is shown at; tiles beyond the archive's native maximum are upscaled (overzoom).
const CUSTOM_PROVIDER_MAX_ZOOM = 23

/**
 * Range the brightness and contrast multipliers of a custom provider are limited to, 1 being unadjusted.
 */
export const tileDisplayAdjustmentRange = { min: 0.2, max: 2 }

const clampDisplayAdjustment = (value = 1): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, tileDisplayAdjustmentRange.min), tileDisplayAdjustmentRange.max) : 1

// Leaflet has no tile-styling API, so brightness and contrast are a CSS filter on the layer's container, which
// only exists while the layer is on a map. A neutral adjustment clears the filter rather than writing an
// identity one, which would still make the tile pane a stacking context and containing block. The metadata is
// resolved on each run because a settings sync replaces the whole provider array, so an entry captured once
// would be an orphan the sliders no longer write to.
const bindDisplayAdjustments = (layer: L.GridLayer, resolveMeta: () => CustomTileProviderMeta): (() => void) => {
  const paint = (): void => {
    const meta = resolveMeta()
    const brightness = clampDisplayAdjustment(meta.brightness)
    const contrast = clampDisplayAdjustment(meta.contrast)
    const filter = brightness === 1 && contrast === 1 ? '' : `brightness(${brightness}) contrast(${contrast})`
    const container = layer.getContainer()
    if (container) container.style.filter = filter
  }
  layer.on('add', paint)
  const stopWatch = watchEffect(paint)
  return () => {
    layer.off('add', paint)
    stopWatch()
  }
}

// Fields baked into the layer at build time (or into its control label); a change to any requires rebuilding.
export const customTileProviderSignature = (meta: CustomTileProviderMeta): string =>
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
 * A materialized custom provider: its live Leaflet layer and any backing tile source to release with it.
 */
export interface CustomTileProviderLayer {
  /**
   * The live Leaflet layer drawing the provider's tiles.
   */
  layer: L.GridLayer
  /**
   * Releases the layer's display-adjustment binding and, for file providers, the backing tile source.
   */
  close?: () => void
}

/**
 * Return type of {@link useCustomTileProviderLayer}.
 */
export interface UseCustomTileProviderLayerReturn {
  /**
   * Builds a Leaflet layer for a custom provider, whether it is served from a URL template or from an
   * archive stored on the vehicle. The caller owns the returned layer and must call its `close`.
   */
  createLayer: (meta: CustomTileProviderMeta) => CustomTileProviderLayer
}

/**
 * Turns persisted custom-provider metadata into Leaflet layers, resolving a file provider's archive from the
 * local render cache or from the vehicle. Shared by the layer-control surfaces (`useCustomTileProviders`) and
 * by maps that pick a single provider without a control, such as the MiniMap widget.
 * @returns {UseCustomTileProviderLayerReturn} The layer factory.
 */
export const useCustomTileProviderLayer = (): UseCustomTileProviderLayerReturn => {
  const vehicleStore = useMainVehicleStore()
  const missionStore = useMissionStore()

  // Resolves a file provider's archive: local render cache first, else download from the vehicle (the durable
  // master copy) and cache it before use. Runs only when the provider is first selected (lazy layer).
  const loadArchiveSource = async (meta: CustomTileProviderMeta): Promise<TileArchiveSource> => {
    let archive = await getCachedTileArchive(meta.id)
    if (!archive) {
      const vehicleAddress = vehicleStore.globalAddress
      if (!vehicleAddress) {
        throw new Error(`"${meta.name}" is not cached locally and no vehicle is connected to fetch it.`)
      }
      const fileName = tileArchiveFileName(meta)
      archive = await downloadFileFromVehicle(vehicleAddress, tileProviderSubfolder, fileName, archiveTransferTimeout)
      // The vehicle holds the master copy, so a cache write that does not land only costs a re-download.
      await setCachedTileArchive(meta.id, archive).catch((error) =>
        console.warn(`Could not cache tile archive ${meta.id} locally:`, error)
      )
    }
    if (!meta.format) throw new Error(`"${meta.name}" has no archive format.`)
    return openTileArchive(archive, meta.format)
  }

  const buildUrlLayer = (meta: CustomTileProviderMeta): CustomTileProviderLayer => ({
    layer: L.tileLayer(meta.urlTemplate ?? '', {
      attribution: meta.attribution,
      tms: meta.tms ?? false,
      minZoom: meta.minZoom ?? 0,
      maxNativeZoom: meta.maxZoom,
      maxZoom: CUSTOM_PROVIDER_MAX_ZOOM,
    }),
  })

  const buildFileLayer = (meta: CustomTileProviderMeta): CustomTileProviderLayer => {
    // ponytail: each map showing this provider opens its own source, so a large archive is held once per map.
    // Sharing one source across maps needs reference counting, whose failure mode (closing a source another map
    // still draws from) is worse than the duplication.
    let sourcePromise: Promise<TileArchiveSource> | undefined
    let failureReported = false
    const sourceProvider = (): Promise<TileArchiveSource> => {
      sourcePromise =
        sourcePromise ??
        loadArchiveSource(meta).catch((error) => {
          // Forget the failure so a later tile retries it, since the usual cause is a vehicle not connected yet.
          sourcePromise = undefined
          if (!failureReported) {
            failureReported = true
            const reason = messageFromError(error)
            openSnackbar({ message: `Could not load the "${meta.name}" map: ${reason}`, variant: 'error' })
          }
          throw error
        })
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
    return { layer, close }
  }

  const createLayer = (meta: CustomTileProviderMeta): CustomTileProviderLayer => {
    const built = meta.type === 'url' ? buildUrlLayer(meta) : buildFileLayer(meta)
    const liveMeta = (): CustomTileProviderMeta =>
      missionStore.customTileProviders.find((provider) => provider.id === meta.id) ?? meta
    const unbindDisplayAdjustments = bindDisplayAdjustments(built.layer, liveMeta)
    return {
      layer: built.layer,
      close: () => {
        unbindDisplayAdjustments()
        built.close?.()
      },
    }
  }

  return { createLayer }
}
