import { CockpitTileImageryProvider } from '@/libs/map/cesium-imagery'
import type { CockpitMap, MapLayerSlot } from '@/libs/map/cesium-map'
import type { NoiseTileOptions } from '@/libs/map/map-tile-fallback'
import { type TileDisplayAdjustments, loadArchiveTile, loadTemplateTile } from '@/libs/map/tile-loading'

/**
 * A raster tile layer as Cockpit describes it, independent of the map instance it is drawn on. Zooms are on the
 * tile scale, with Leaflet's meaning: `maxNativeZoom` is the deepest level the provider serves (deeper views upscale
 * it), and `maxZoom` hides the layer past that zoom.
 */
export interface RasterLayerDefinition {
  /** Id unique within the map. */
  id: string
  /** Name shown in the layer selector. */
  label: string
  /** Tile URL template. Alternatively, `archiveToken` names a registered tile archive. */
  template?: string
  /** Token of a tile archive registered with `registerArchiveSource`, for layers drawn from an archive. */
  archiveToken?: string
  /** Values for the template's `{s}` placeholder. */
  subdomains?: string[]
  /** Whether the provider numbers rows from the south (TMS). */
  tms?: boolean
  /** Shallowest zoom the layer shows at. */
  minZoom?: number
  /** Deepest zoom the provider serves tiles for. */
  maxNativeZoom: number
  /** Deepest zoom the layer shows at. */
  maxZoom: number
  /** Area the provider has tiles for, as `[west, south, east, north]`. */
  bounds?: [number, number, number, number]
  /** Attribution shown for the provider. */
  attribution?: string
  /** Whether failed tiles are replaced by the procedural noise background. */
  noiseFallback?: boolean
  /** Whether the provider sends no CORS headers, so only Standalone, which adds them, can draw its tiles. */
  standaloneOnly?: boolean
}

/**
 * Per-map options for {@link addRasterLayer}.
 */
export interface AddRasterLayerOptions {
  /** Stacking slot to insert the layer in. */
  slot: MapLayerSlot
  /** Whether the layer starts visible. */
  visible: boolean
  /** Noise fallback options, used when the definition asks for a fallback. */
  fallback?: NoiseTileOptions
  /** Display adjustments applied to each tile. */
  adjustments?: TileDisplayAdjustments
}

/**
 * Id of the imagery drawing a raster definition on a map.
 * @param {MapLayerSlot} slot - The stacking slot the layer lives in.
 * @param {string} id - The definition's id.
 * @returns {string} The imagery id.
 */
export const rasterLayerId = (slot: MapLayerSlot, id: string): string => `${slot}::${id}`

const providerFor = (
  definition: RasterLayerDefinition,
  options: Omit<AddRasterLayerOptions, 'slot' | 'visible'>
): CockpitTileImageryProvider =>
  new CockpitTileImageryProvider({
    load: (coords) =>
      definition.archiveToken
        ? loadArchiveTile(definition.archiveToken, coords, options.adjustments)
        : loadTemplateTile(definition.template ?? '', coords, {
            subdomains: definition.subdomains,
            fallback: definition.noiseFallback ? options.fallback : undefined,
            adjustments: options.adjustments,
          }),
    minimumLevel: definition.minZoom,
    maximumLevel: definition.maxNativeZoom,
    bounds: definition.bounds,
    tms: definition.tms,
    attribution: definition.attribution,
  })

/**
 * Adds a raster definition to a map as imagery.
 * @param {CockpitMap} map - The map to draw on.
 * @param {RasterLayerDefinition} definition - The layer to draw.
 * @param {AddRasterLayerOptions} options - Where and how to draw it.
 * @returns {string} The id of the created imagery.
 */
export const addRasterLayer = (
  map: CockpitMap,
  definition: RasterLayerDefinition,
  options: AddRasterLayerOptions
): string => {
  const id = rasterLayerId(options.slot, definition.id)
  map.addImagery(id, options.slot, providerFor(definition, options), {
    visible: options.visible,
    minZoom: definition.minZoom,
    maxZoom: definition.maxZoom,
    attribution: definition.attribution,
  })
  return id
}

/**
 * Shows or hides a raster layer added with {@link addRasterLayer}.
 * @param {CockpitMap} map - The map holding the layer.
 * @param {string} id - The id {@link addRasterLayer} returned.
 * @param {boolean} visible - Whether to show it.
 */
export const setRasterLayerVisible = (map: CockpitMap, id: string, visible: boolean): void => {
  map.setImageryVisible(id, visible)
}

/**
 * Whether a raster layer added with {@link addRasterLayer} is visible.
 * @param {CockpitMap} map - The map holding the layer.
 * @param {string} id - The id {@link addRasterLayer} returned.
 * @returns {boolean} True when the layer exists and is shown.
 */
export const isRasterLayerVisible = (map: CockpitMap, id: string): boolean => map.isImageryVisible(id)

/**
 * Reloads a raster layer's tiles after its fallback or display adjustments changed.
 * @param {CockpitMap} map - The map holding the layer.
 * @param {string} id - The id {@link addRasterLayer} returned.
 * @param {RasterLayerDefinition} definition - The layer's definition.
 * @param {Omit<AddRasterLayerOptions, 'slot' | 'visible'>} options - The new fallback and adjustments.
 */
export const refreshRasterLayerTiles = (
  map: CockpitMap,
  id: string,
  definition: RasterLayerDefinition,
  options: Omit<AddRasterLayerOptions, 'slot' | 'visible'>
): void => {
  map.setImageryProvider(id, providerFor(definition, options))
}
