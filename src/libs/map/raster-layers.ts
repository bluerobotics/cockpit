import type { Map as MapLibreMap, RasterTileSource } from 'maplibre-gl'

import type { NoiseTileOptions } from '@/libs/map/map-tile-fallback'
import { type MapLayerSlot, beforeIdForSlot, slottedLayerId, toMapLibreZoom } from '@/libs/map/maplibre'
import { type TileDisplayAdjustments, tileProtocolUrl } from '@/libs/map/tile-protocol'

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
  /** Tile URL template. Alternatively, `tilesUrl` gives the URL MapLibre requests directly. */
  template?: string
  /** URL MapLibre requests tiles from, for layers not loaded from a URL template (such as archive providers). */
  tilesUrl?: string
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
 * Id of the source and layer drawing a raster definition on a map.
 * @param {MapLayerSlot} slot - The stacking slot the layer lives in.
 * @param {string} id - The definition's id.
 * @returns {string} The id used for both the source and the layer.
 */
export const rasterLayerId = (slot: MapLayerSlot, id: string): string => slottedLayerId(slot, id)

const tilesFor = (
  definition: RasterLayerDefinition,
  options: Omit<AddRasterLayerOptions, 'slot' | 'visible'>
): string =>
  definition.tilesUrl ??
  tileProtocolUrl(definition.template ?? '', {
    subdomains: definition.subdomains,
    fallback: definition.noiseFallback ? options.fallback : undefined,
    adjustments: options.adjustments,
  })

/**
 * Adds a raster definition to a map as a source and layer.
 * @param {MapLibreMap} map - The map to draw on.
 * @param {RasterLayerDefinition} definition - The layer to draw.
 * @param {AddRasterLayerOptions} options - Where and how to draw it.
 * @returns {string} The id of the created source and layer.
 */
export const addRasterLayer = (
  map: MapLibreMap,
  definition: RasterLayerDefinition,
  options: AddRasterLayerOptions
): string => {
  const id = rasterLayerId(options.slot, definition.id)
  if (map.getLayer(id)) return id
  map.addSource(id, {
    type: 'raster',
    tiles: [tilesFor(definition, options)],
    tileSize: 256,
    scheme: definition.tms ? 'tms' : 'xyz',
    minzoom: definition.minZoom ?? 0,
    maxzoom: definition.maxNativeZoom,
    bounds: definition.bounds,
    attribution: definition.attribution,
  })
  map.addLayer(
    {
      id,
      type: 'raster',
      source: id,
      // Layer zoom limits are on MapLibre's scale and the upper one is exclusive, while Leaflet's was inclusive.
      minzoom: definition.minZoom ? Math.max(toMapLibreZoom(definition.minZoom), 0) : undefined,
      maxzoom: Math.min(toMapLibreZoom(definition.maxZoom) + 1, 24),
      layout: { visibility: options.visible ? 'visible' : 'none' },
      paint: { 'raster-fade-duration': 200 },
    },
    beforeIdForSlot(map, options.slot)
  )
  return id
}

/**
 * Shows or hides a raster layer added with {@link addRasterLayer}.
 * @param {MapLibreMap} map - The map holding the layer.
 * @param {string} id - The id {@link addRasterLayer} returned.
 * @param {boolean} visible - Whether to show it.
 */
export const setRasterLayerVisible = (map: MapLibreMap, id: string, visible: boolean): void => {
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

/**
 * Whether a raster layer added with {@link addRasterLayer} is visible.
 * @param {MapLibreMap} map - The map holding the layer.
 * @param {string} id - The id {@link addRasterLayer} returned.
 * @returns {boolean} True when the layer exists and is shown.
 */
export const isRasterLayerVisible = (map: MapLibreMap, id: string): boolean =>
  Boolean(map.getLayer(id)) && map.getLayoutProperty(id, 'visibility') !== 'none'

/**
 * Re-points a raster layer's tiles, which reloads them, after its fallback or display adjustments changed.
 * @param {MapLibreMap} map - The map holding the layer.
 * @param {string} id - The id {@link addRasterLayer} returned.
 * @param {RasterLayerDefinition} definition - The layer's definition.
 * @param {Omit<AddRasterLayerOptions, 'slot' | 'visible'>} options - The new fallback and adjustments.
 */
export const refreshRasterLayerTiles = (
  map: MapLibreMap,
  id: string,
  definition: RasterLayerDefinition,
  options: Omit<AddRasterLayerOptions, 'slot' | 'visible'>
): void => {
  const source = map.getSource<RasterTileSource>(id)
  const tiles = tilesFor(definition, options)
  if (source && source.tiles?.[0] !== tiles) source.setTiles([tiles])
}
