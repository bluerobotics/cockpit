import { watchDebounced } from '@vueuse/core'
import type { Map as MapLibreMap } from 'maplibre-gl'

import { openSnackbar } from '@/composables/snackbar'
import { downloadFileFromVehicle } from '@/libs/blueos-files'
import type { MapLayerSlot } from '@/libs/map/maplibre'
import { removeLayersAndSource } from '@/libs/map/maplibre'
import { type RasterLayerDefinition, addRasterLayer, refreshRasterLayerTiles } from '@/libs/map/raster-layers'
import { type TileArchiveSource, openTileArchive } from '@/libs/map/tile-archive'
import { type TileDisplayAdjustments, archiveProtocolUrl, registerArchiveSource } from '@/libs/map/tile-protocol'
import { archiveTransferTimeout, tileArchiveFileName, tileProviderSubfolder } from '@/libs/map/tile-provider-import'
import { getCachedTileArchive, setCachedTileArchive } from '@/libs/map/tile-provider-storage'
import { messageFromError } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { CustomTileProviderMeta } from '@/types/mission'

// Highest zoom a custom provider is shown at; tiles beyond the archive's native maximum are upscaled (overzoom).
const CUSTOM_PROVIDER_MAX_ZOOM = 23

// Leaflet's default `{s}` values, which URL templates saved before the move to MapLibre were drawn with.
const defaultSubdomains = ['a', 'b', 'c']

/**
 * Range the brightness and contrast multipliers of a custom provider are limited to, 1 being unadjusted.
 */
export const tileDisplayAdjustmentRange = { min: 0.2, max: 2 }

const clampDisplayAdjustment = (value = 1): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, tileDisplayAdjustmentRange.min), tileDisplayAdjustmentRange.max) : 1

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
 * A custom provider drawn on a map, with what it takes to release it.
 */
export interface MountedCustomTileProviderLayer {
  /**
   * Id of the provider's source and layer on the map.
   */
  id: string
  /**
   * Removes the layer and releases its display-adjustment binding and, for file providers, the backing tile source.
   */
  close: () => void
}

/**
 * Return type of {@link useCustomTileProviderLayer}.
 */
export interface UseCustomTileProviderLayerReturn {
  /**
   * Draws a custom provider on a map, whether it is served from a URL template or from an archive stored on the
   * vehicle. The caller owns the returned layer and must call its `close`.
   */
  mountLayer: (
    map: MapLibreMap,
    meta: CustomTileProviderMeta,
    options: {
      /** Stacking slot to draw it in. */
      slot: MapLayerSlot
      /** Whether it starts visible. */
      visible: boolean
    }
  ) => MountedCustomTileProviderLayer
}

let archiveTokenCounter = 0

/**
 * A custom provider's layer definition and what has to be released with it.
 */
interface BuiltProviderDefinition {
  /** The layer definition for the given display adjustments. */
  definition: (adjustments: TileDisplayAdjustments) => RasterLayerDefinition
  /** Releases the archive registration and source, for file providers. */
  release?: () => void
}

/**
 * Turns persisted custom-provider metadata into map layers, resolving a file provider's archive from the local render
 * cache or from the vehicle. Shared by the layer-selector surfaces (`useCustomTileProviders`) and by maps that pick a
 * single provider without a selector, such as the MiniMap widget.
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

  const baseDefinition = (meta: CustomTileProviderMeta): Omit<RasterLayerDefinition, 'template' | 'tilesUrl'> => ({
    id: `custom-${meta.id}`,
    label: meta.name,
    attribution: meta.attribution,
    minZoom: meta.minZoom ?? 0,
    maxNativeZoom: meta.maxZoom ?? CUSTOM_PROVIDER_MAX_ZOOM,
    maxZoom: CUSTOM_PROVIDER_MAX_ZOOM,
  })

  // Builds the layer definition plus, for file providers, the archive registration it reads tiles through.
  const buildDefinition = (meta: CustomTileProviderMeta): BuiltProviderDefinition => {
    if (meta.type === 'url') {
      return {
        definition: () => ({
          ...baseDefinition(meta),
          template: meta.urlTemplate ?? '',
          subdomains: defaultSubdomains,
          tms: meta.tms ?? false,
        }),
      }
    }

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
    archiveTokenCounter += 1
    const token = `${meta.id}-${archiveTokenCounter}`
    const unregister = registerArchiveSource(token, sourceProvider)
    const [[south, west], [north, east]] = meta.bounds ?? [
      [-90, -180],
      [90, 180],
    ]
    return {
      definition: (adjustments) => ({
        ...baseDefinition(meta),
        tilesUrl: archiveProtocolUrl(token, adjustments),
        bounds: meta.bounds ? [west, south, east, north] : undefined,
      }),
      release: () => {
        unregister()
        void sourcePromise?.then((source) => source.close()).catch(() => undefined)
      },
    }
  }

  const mountLayer: UseCustomTileProviderLayerReturn['mountLayer'] = (map, meta, options) => {
    const built = buildDefinition(meta)
    // The metadata is resolved on each read because a settings sync replaces the whole provider array, so an entry
    // captured once would be an orphan the sliders no longer write to.
    const adjustments = (): TileDisplayAdjustments => {
      const live = missionStore.customTileProviders.find((provider) => provider.id === meta.id) ?? meta
      return { brightness: clampDisplayAdjustment(live.brightness), contrast: clampDisplayAdjustment(live.contrast) }
    }
    const id = addRasterLayer(map, built.definition(adjustments()), { ...options, adjustments: adjustments() })
    // Adjusted tiles are redrawn by reloading them, so slider drags are coalesced instead of reloading per step.
    const stopAdjustmentsWatch = watchDebounced(
      adjustments,
      (current) => refreshRasterLayerTiles(map, id, built.definition(current), { adjustments: current }),
      { debounce: 200, deep: true }
    )
    return {
      id,
      close: () => {
        stopAdjustmentsWatch()
        removeLayersAndSource(map, [id], id)
        built.release?.()
      },
    }
  }

  return { mountLayer }
}
