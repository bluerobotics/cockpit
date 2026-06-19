import 'leaflet-edgebuffer'

import L from 'leaflet'
import { tileLayerOffline } from 'leaflet.offline'

import type { MapTileProvider } from '@/types/mission'

const tileBufferOptions = { edgeBufferTiles: 2, keepBuffer: 8, updateWhenIdle: false } as const

/**
 * Which optional layers to build alongside the OSM/Esri base maps.
 */
export interface MapTileLayersOptions {
  /**
   * Build the OpenSeaMap seamarks overlay (dashboard Map widget).
   */
  seamarks?: boolean
  /**
   * Build the GEBCO marine-profile WMS overlay (dashboard Map widget).
   */
  marineProfile?: boolean
  /**
   * Build an extra always-on OSM layer drawn over the base map (Mission Planning view).
   */
  extraOsm?: boolean
}

/**
 * The base maps, overlays and individual tile layers shared by the map views.
 */
export interface MapTileLayers {
  /**
   * Shared edge-buffer/keep-buffer options applied to every tile layer.
   */
  tileBufferOptions: typeof tileBufferOptions
  /**
   * OpenStreetMap base layer (offline-capable).
   */
  osm: L.TileLayer
  /**
   * Esri World Imagery base layer (offline-capable).
   */
  esri: L.TileLayer
  /**
   * OpenSeaMap seamarks overlay, when requested.
   */
  seamarks?: L.TileLayer
  /**
   * GEBCO marine-profile WMS overlay, when requested.
   */
  marineProfile?: L.TileLayer
  /**
   * Extra always-on OSM layer, when requested.
   */
  extraOsm?: L.TileLayer
  /**
   * Base maps keyed by their layer-control label.
   */
  baseMaps: Record<MapTileProvider, L.TileLayer>
  /**
   * Overlays keyed by their layer-control label.
   */
  overlays: Record<string, L.TileLayer>
}

/**
 * Builds the base map and overlay tile layers shared by the dashboard Map widget and the Mission Planning view,
 * so their tile-provider definitions live in one place. This is a plain factory (no Vue reactivity), safe to
 * call from component setup or inside `onMounted`.
 * @param {MapTileLayersOptions} [options] - Which optional overlays/extra layers to include.
 * @returns {MapTileLayers} The created tile layers, base maps and overlays.
 */
export const useMapTileLayers = (options: MapTileLayersOptions = {}): MapTileLayers => {
  const osm = tileLayerOffline('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 23,
    maxNativeZoom: 19,
    attribution: '© OpenStreetMap',
    // Required by the OSM tile usage policy: tiles requested without a Referer are blocked (403R).
    // See https://wiki.openstreetmap.org/wiki/Referer
    referrerPolicy: 'strict-origin-when-cross-origin',
    // CORS is required so the noise-fallback utility can read tile pixels via canvas
    // to detect placeholder tiles that return HTTP 200.
    crossOrigin: 'anonymous',
    ...tileBufferOptions,
  })

  const esri = tileLayerOffline(
    // `blankTile=false` makes ArcGIS return HTTP 404 for missing tiles instead of a
    // "Map data not yet available" placeholder image. This lets the standard `tileerror`
    // path drive our procedural-noise fallback.
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false',
    {
      maxZoom: 23,
      maxNativeZoom: 19,
      attribution: '© Esri World Imagery',
      // CORS is required so the noise-fallback utility can read tile pixels via canvas
      // to detect any remaining provider-side placeholders that still return HTTP 200.
      crossOrigin: 'anonymous',
      ...tileBufferOptions,
    }
  )

  const baseMaps: Record<MapTileProvider, L.TileLayer> = {
    'OpenStreetMap': osm,
    'Esri World Imagery': esri,
  }

  const layers: MapTileLayers = { tileBufferOptions, osm, esri, baseMaps, overlays: {} }

  if (options.seamarks) {
    layers.seamarks = tileLayerOffline('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenSeaMap contributors',
      ...tileBufferOptions,
    })
    layers.overlays['Seamarks'] = layers.seamarks
  }

  if (options.marineProfile) {
    layers.marineProfile = L.tileLayer.wms('https://geoserver.openseamap.org/geoserver/gwc/service/wms', {
      layers: 'gebco2021:gebco_2021',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      attribution: '© GEBCO, OpenSeaMap',
      tileSize: 256,
      maxZoom: 19,
      ...tileBufferOptions,
    })
    layers.overlays['Marine Profile'] = layers.marineProfile
  }

  if (options.extraOsm) {
    layers.extraOsm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      // Required by the OSM tile usage policy: tiles requested without a Referer are blocked (403R).
      // See https://wiki.openstreetmap.org/wiki/Referer
      referrerPolicy: 'strict-origin-when-cross-origin',
      crossOrigin: 'anonymous',
      ...tileBufferOptions,
    })
  }

  return layers
}
