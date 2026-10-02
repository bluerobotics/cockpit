import type { RasterLayerDefinition } from '@/libs/map/raster-layers'
import type { MapTileProvider } from '@/types/mission'

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
   * OpenStreetMap base layer (offline-capable).
   */
  osm: RasterLayerDefinition
  /**
   * Esri World Imagery base layer (offline-capable).
   */
  esri: RasterLayerDefinition
  /**
   * OpenSeaMap seamarks overlay, when requested.
   */
  seamarks?: RasterLayerDefinition
  /**
   * GEBCO marine-profile WMS overlay, when requested.
   */
  marineProfile?: RasterLayerDefinition
  /**
   * Extra always-on OSM layer, when requested.
   */
  extraOsm?: RasterLayerDefinition
  /**
   * Base maps keyed by their layer-control label.
   */
  baseMaps: Record<MapTileProvider, RasterLayerDefinition>
  /**
   * Overlays keyed by their layer-control label.
   */
  overlays: Record<string, RasterLayerDefinition>
}

const osmTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/**
 * Builds the base map and overlay tile layers shared by the dashboard Map widget and the Mission Planning view,
 * so their tile-provider definitions live in one place. This is a plain factory (no Vue reactivity), safe to
 * call from component setup or inside `onMounted`.
 * @param {MapTileLayersOptions} [options] - Which optional overlays/extra layers to include.
 * @returns {MapTileLayers} The created tile layers, base maps and overlays.
 */
export const useMapTileLayers = (options: MapTileLayersOptions = {}): MapTileLayers => {
  const osm: RasterLayerDefinition = {
    id: 'osm',
    label: 'OpenStreetMap',
    template: osmTemplate,
    maxZoom: 23,
    maxNativeZoom: 19,
    attribution: '© OpenStreetMap',
    noiseFallback: true,
  }

  const esri: RasterLayerDefinition = {
    id: 'esri',
    label: 'Esri World Imagery',
    // `blankTile=false` makes ArcGIS return HTTP 404 for missing tiles instead of a
    // "Map data not yet available" placeholder image, which drives our procedural-noise fallback.
    template:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false',
    maxZoom: 23,
    maxNativeZoom: 19,
    attribution: '© Esri World Imagery',
    noiseFallback: true,
  }

  const baseMaps: Record<MapTileProvider, RasterLayerDefinition> = {
    'OpenStreetMap': osm,
    'Esri World Imagery': esri,
  }

  const layers: MapTileLayers = { osm, esri, baseMaps, overlays: {} }

  if (options.seamarks) {
    layers.seamarks = {
      id: 'seamarks',
      label: 'Seamarks',
      template: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
      maxZoom: 18,
      maxNativeZoom: 18,
      attribution: '© OpenSeaMap contributors',
    }
    layers.overlays['Seamarks'] = layers.seamarks
  }

  if (options.marineProfile) {
    layers.marineProfile = {
      id: 'marine-profile',
      label: 'Marine Profile',
      // The WMS request Leaflet built for this layer, parameter for parameter.
      template:
        'https://geoserver.openseamap.org/geoserver/gwc/service/wms?service=WMS&request=GetMap' +
        '&layers=gebco2021%3Agebco_2021&styles=&format=image%2Fpng&transparent=true&version=1.1.1' +
        '&width=256&height=256&srs=EPSG%3A3857&bbox={bbox-epsg-3857}',
      maxZoom: 19,
      maxNativeZoom: 19,
      attribution: '© GEBCO, OpenSeaMap',
      standaloneOnly: true,
    }
    layers.overlays['Marine Profile'] = layers.marineProfile
  }

  if (options.extraOsm) {
    layers.extraOsm = {
      id: 'extra-osm',
      label: 'OpenStreetMap',
      template: osmTemplate,
      maxZoom: 19,
      maxNativeZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      noiseFallback: true,
    }
  }

  return layers
}
