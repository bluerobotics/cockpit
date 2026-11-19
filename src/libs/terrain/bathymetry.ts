import { t } from 'ttag'

import type { WaypointCoordinates } from '@/types/mission'
import type { BathymetrySourceId } from '@/types/terrain'

import {
  type TerrainTile,
  type TerrainTileBounds,
  TERRAIN_TILE_SIZE,
  terrainPixelCenter,
  TERRARIUM_NO_DATA_M,
} from './tiles'

/**
 * Bathymetry models published as tiles of their own, each read through its provider's coverage service.
 */
export type BathymetryTileSourceId = 'noaa' | 'emodnet' | 'chs-10' | 'chs-100' | 'ausseabed' | 'gmrt' | 'gebco'

/**
 * A model read for depths, in the order a bathymetry source reads them.
 */
export type BathymetryLayerId = BathymetryTileSourceId | 'tilezen'

/**
 * What a bathymetry source is and where it is worth reading.
 */
export interface BathymetrySourceInfo {
  /**
   * Name shown to the user.
   */
  label: string
  /**
   * Short name, for tags with little room.
   */
  name: string
  /**
   * One sentence on what the model holds.
   */
  description: string
  /**
   * Attribution the source's licence requires wherever its data is shown; see {@link bathymetryAttribution}.
   */
  attribution: string
  /**
   * Models read, in order, each filling what the previous one left without a depth.
   */
  layers: BathymetryLayerId[]
  /**
   * Areas the automatic choice reads the source in, null for anywhere.
   */
  regions: TerrainTileBounds[] | null
}

/**
 * Raster of heights returned by a coverage service, before it is laid onto the tile grid.
 */
export interface BathymetryRaster {
  /**
   * Heights in meters, row-major from the north-west corner.
   */
  values: ArrayLike<number>
  /**
   * Columns in the raster.
   */
  width: number
  /**
   * Rows in the raster.
   */
  height: number
  /**
   * Outer edges as `[minX, minY, maxX, maxY]`, in Web Mercator meters or, when geographic, in degrees.
   */
  bbox: number[]
  /**
   * Whether the raster is in latitude and longitude rather than Web Mercator.
   */
  geographic: boolean
}

const WEB_MERCATOR_HALF_M = 20037508.342789244
// No sea is this deep, so anything below it is a provider's no-data marker rather than a depth.
const DEEPEST_DEPTH_M = -12000
// GMRT answers with its own grid, so the request reaches past the tile for the edge pixels to interpolate.
const GMRT_MARGIN_PX = 8

const US_REGIONS: TerrainTileBounds[] = [
  { south: 24, west: -125, north: 50, east: -66 },
  { south: 51, west: -180, north: 72, east: -129 },
  { south: 51, west: 172, north: 56, east: 180 },
  { south: 18, west: -161, north: 23, east: -154 },
  { south: 17.5, west: -68, north: 18.7, east: -64.3 },
  { south: 13, west: 144, north: 21, east: 146.5 },
  { south: -14.6, west: -171.2, north: -11, east: -168 },
]

export const BATHYMETRY_SOURCES: Record<BathymetrySourceId, BathymetrySourceInfo> = {
  auto: {
    label: t`Automatic, by area`,
    name: t`Auto`,
    // eslint-disable-next-line max-len, vue/max-len
    description: t`The most detailed source for each area: CHS NONNA in Canada, NOAA in the United States, EMODnet in Europe and AusBathyTopo around Australia, then GMRT, GEBCO and Tilezen anywhere else.`,
    attribution: '',
    layers: [],
    regions: null,
  },
  chs: {
    label: t`CHS NONNA (Canada)`,
    name: t`CHS NONNA`,
    // eslint-disable-next-line max-len, vue/max-len
    description: t`Canadian Hydrographic Service surveys of Canadian waters, 10 m per sample where surveyed and 100 m elsewhere. Depths are below chart datum, so they read shallower than at mean sea level.`,
    attribution:
      'Bathymetry: Canadian Hydrographic Service NONNA, Open Government Licence - Canada, not for navigation',
    layers: ['chs-10', 'chs-100'],
    regions: [{ south: 40, west: -142, north: 84, east: -50 }],
  },
  noaa: {
    label: t`NOAA coastal models (United States)`,
    name: t`NOAA`,
    description: t`NOAA coastal elevation models of the United States and its territories, down to a few meters per sample, with the 450 m ETOPO 2022 grid elsewhere.`,
    attribution: 'Bathymetry: NOAA National Centers for Environmental Information',
    layers: ['noaa'],
    regions: US_REGIONS,
  },
  emodnet: {
    label: t`EMODnet Bathymetry (Europe)`,
    name: t`EMODnet`,
    // eslint-disable-next-line max-len, vue/max-len
    description: t`The European seas model, about 115 m per sample, including the UK Hydrographic Office surveys. Depths are below the lowest astronomical tide, so they read shallower than at mean sea level.`,
    attribution: 'Bathymetry: EMODnet Bathymetry Consortium, CC BY 4.0',
    layers: ['emodnet'],
    regions: [{ south: 15, west: -36, north: 90, east: 43 }],
  },
  ausseabed: {
    label: t`AusBathyTopo (Australia)`,
    name: t`AusBathyTopo`,
    description: t`Geoscience Australia's model of the waters around Australia and its territories, 250 m per sample.`,
    attribution: 'Bathymetry: AusBathyTopo, © Commonwealth of Australia (Geoscience Australia), CC BY 4.0',
    layers: ['ausseabed'],
    regions: [{ south: -60, west: 92, north: -8, east: 172 }],
  },
  gmrt: {
    label: t`GMRT multibeam synthesis`,
    name: t`GMRT`,
    description: t`Ship multibeam surveys from around the world, about 100 m per sample where surveyed, over GEBCO everywhere else.`,
    attribution: 'Bathymetry: Global Multi-Resolution Topography (GMRT), CC BY 4.0',
    layers: ['gmrt'],
    regions: null,
  },
  gebco: {
    label: t`GEBCO 2024`,
    name: t`GEBCO`,
    description: t`The global ocean model, about 450 m per sample. Coastal waters are often interpolated.`,
    attribution: 'Bathymetry: GEBCO Compilation Group (2024) GEBCO 2024 Grid',
    layers: ['gebco'],
    regions: null,
  },
  tilezen: {
    label: t`Tilezen`,
    name: t`Tilezen`,
    description: t`Global ocean depths from grids 1 to 2 km apart at sea, so coastal waters often read as land or sea level.`,
    attribution: 'Bathymetry: Tilezen Terrain Tiles, ETOPO1 and the other sources listed there',
    layers: ['tilezen'],
    regions: null,
  },
  none: {
    label: t`None`,
    name: t`None`,
    description: t`Only the depths the terrain source holds itself, such as those of your custom tiles. The Copernicus model holds none, so the depth under water is unknown.`,
    attribution: '',
    layers: [],
    regions: null,
  },
}

const AUTO_ORDER: Exclude<BathymetrySourceId, 'auto' | 'none'>[] = [
  'chs',
  'noaa',
  'emodnet',
  'ausseabed',
  'gmrt',
  'gebco',
  'tilezen',
]

/**
 * Attribution for the depths a bathymetry choice reads.
 * @param {BathymetrySourceId} sourceId Chosen bathymetry source.
 * @returns {string} The attribution, every model's for the automatic choice.
 */
export const bathymetryAttribution = (sourceId: BathymetrySourceId): string =>
  sourceId === 'auto'
    ? AUTO_ORDER.map((id) => BATHYMETRY_SOURCES[id].attribution).join('. ')
    : BATHYMETRY_SOURCES[sourceId].attribution

/**
 * One model a bathymetry source reads, and where.
 */
export interface BathymetryLayer {
  /**
   * Model to read.
   */
  layerId: BathymetryLayerId
  /**
   * Areas to read it in, null for anywhere.
   */
  regions: TerrainTileBounds[] | null
}

/**
 * Models a bathymetry choice reads, in order. The automatic choice keeps each regional model to its
 * own area; a model picked by hand is read everywhere, leaving its gaps without a depth.
 * @param {BathymetrySourceId} sourceId Chosen bathymetry source.
 * @returns {BathymetryLayer[]} The models to read, most detailed first.
 */
export const bathymetryLayers = (sourceId: BathymetrySourceId): BathymetryLayer[] => {
  if (sourceId !== 'auto') return BATHYMETRY_SOURCES[sourceId].layers.map((layerId) => ({ layerId, regions: null }))
  return AUTO_ORDER.flatMap((id) =>
    BATHYMETRY_SOURCES[id].layers.map((layerId) => ({ layerId, regions: BATHYMETRY_SOURCES[id].regions }))
  )
}

/**
 * Whether a bathymetry layer or source is read at a position.
 * @param {Pick<BathymetryLayer, 'regions'>} layer Layer or source to check.
 * @param {number} lat Latitude in degrees.
 * @param {number} lon Longitude in degrees.
 * @returns {boolean} True when the layer has no regions or one of them holds the position.
 */
export const bathymetryLayerCovers = (
  { regions }: Pick<BathymetryLayer, 'regions'>,
  lat: number,
  lon: number
): boolean =>
  regions === null || regions.some((r) => lat >= r.south && lat <= r.north && lon >= r.west && lon <= r.east)

/**
 * Source the automatic choice reads first along some positions: the most detailed one covering any of them.
 * ponytail: named by coverage, so where that source has a gap the depths come from the next one unnamed; tracking
 * the model that answered each sample would name it exactly.
 * @param {WaypointCoordinates[]} coordinates Positions to cover.
 * @returns {BathymetrySourceId} The source.
 */
export const automaticBathymetrySource = (coordinates: WaypointCoordinates[]): BathymetrySourceId =>
  AUTO_ORDER.find((id) => coordinates.some(([lat, lon]) => bathymetryLayerCovers(BATHYMETRY_SOURCES[id], lat, lon))) ??
  'tilezen'

/**
 * Whether a bathymetry layer is read anywhere in an area.
 * @param {BathymetryLayer} layer Layer to check.
 * @param {TerrainTileBounds} bounds Area to check.
 * @returns {boolean} True when the layer has no regions or one of them overlaps the area.
 */
export const bathymetryLayerOverlaps = ({ regions }: BathymetryLayer, bounds: TerrainTileBounds): boolean =>
  regions === null ||
  regions.some(
    (r) => r.south <= bounds.north && r.north >= bounds.south && r.west <= bounds.east && r.east >= bounds.west
  )

/**
 * Deepest zoom each bathymetry model is read at, about a third of its own sample spacing.
 */
export const BATHYMETRY_TILE_MAX_ZOOM: Record<BathymetryTileSourceId, number> = {
  'noaa': 13,
  'emodnet': 11,
  'chs-10': 13,
  'chs-100': 11,
  'ausseabed': 10,
  'gmrt': 12,
  'gebco': 10,
}

const mercatorBbox = ({ z, x, y }: TerrainTile): string => {
  const span = (2 * WEB_MERCATOR_HALF_M) / 2 ** z
  const west = -WEB_MERCATOR_HALF_M + x * span
  const north = WEB_MERCATOR_HALF_M - y * span
  return [west, north - span, west + span, north].join(',')
}

const arcgisImageUrl = (service: string, tile: TerrainTile): string =>
  `${service}/exportImage?bbox=${mercatorBbox(tile)}&bboxSR=3857&imageSR=3857&size=256,256&format=tiff` +
  '&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image'

const wcsCoverageUrl = (endpoint: string, coverage: string, tile: TerrainTile): string =>
  `${endpoint}?service=WCS&version=1.0.0&request=GetCoverage&coverage=${encodeURIComponent(coverage)}` +
  `&crs=EPSG:3857&bbox=${mercatorBbox(tile)}&width=256&height=256&format=image/tiff&interpolation=bilinear`

// GMRT sizes its grid by the resolution asked for rather than by pixels, so coarse tiles ask for a coarser grade
// to stay near 256 samples across instead of megabytes.
const gmrtResolution = (zoom: number): string => {
  if (zoom >= 11) return 'max'
  if (zoom === 10) return 'high'
  return zoom === 9 ? 'med' : 'low'
}

const gmrtUrl = (tile: TerrainTile): string => {
  const [north, west] = terrainPixelCenter(tile, -0.5 - GMRT_MARGIN_PX, -0.5 - GMRT_MARGIN_PX)
  const far = TERRAIN_TILE_SIZE - 0.5 + GMRT_MARGIN_PX
  const [south, east] = terrainPixelCenter(tile, far, far)
  return (
    `https://www.gmrt.org/services/GridServer?north=${north}&south=${south}&east=${east}&west=${west}` +
    `&layer=topo&format=geotiff&resolution=${gmrtResolution(tile.z)}`
  )
}

/**
 * Address of one tile of a bathymetry model, as a GeoTIFF of its heights.
 * @param {BathymetryTileSourceId} sourceId Model to read.
 * @param {TerrainTile} tile Tile to cover.
 * @returns {string} The request URL.
 */
export const bathymetryTileUrl = (sourceId: BathymetryTileSourceId, tile: TerrainTile): string => {
  switch (sourceId) {
    case 'noaa':
      return arcgisImageUrl(
        'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer',
        tile
      )
    case 'gebco':
      return arcgisImageUrl('https://gis.ccom.unh.edu/server/rest/services/GEBCO/gebco_2024_depth_IS/ImageServer', tile)
    case 'emodnet':
      return wcsCoverageUrl('https://ows.emodnet-bathymetry.eu/wcs', 'emodnet:mean', tile)
    case 'chs-10':
      return wcsCoverageUrl('https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs', 'nonna:NONNA 10 Coverage', tile)
    case 'chs-100':
      return wcsCoverageUrl('https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs', 'nonna:NONNA 100 Coverage', tile)
    case 'ausseabed':
      return wcsCoverageUrl(
        'https://warehouse.ausseabed.gov.au/geoserver/ows',
        'ausseabed:AusBathyTopo__Australia__Bathymetry__250m_2026_OV',
        tile
      )
    case 'gmrt':
      return gmrtUrl(tile)
  }
}

const isDepth = (value: number): boolean => Number.isFinite(value) && value < 0 && value > DEEPEST_DEPTH_M

/**
 * Lays a coverage raster onto a tile's pixels, interpolating between the raster samples that hold a
 * depth. Heights at or above sea level and the providers' no-data markers become no data, so a
 * bathymetry tile only ever answers with depths.
 * @param {BathymetryRaster} raster Raster from the provider.
 * @param {TerrainTile} tile Tile to fill.
 * @returns {Float32Array} Depth in meters for every pixel, row-major, {@link TERRARIUM_NO_DATA_M} where unknown.
 */
export const bathymetryTileElevations = (raster: BathymetryRaster, tile: TerrainTile): Float32Array => {
  const { values, width, height, geographic } = raster
  const [minX, minY, maxX, maxY] = raster.bbox
  const depthAt = (col: number, row: number): number | null => {
    const value = values[row * width + col]
    return isDepth(value) ? value : null
  }
  const scale = 2 ** tile.z
  const elevations = new Float32Array(TERRAIN_TILE_SIZE * TERRAIN_TILE_SIZE).fill(TERRARIUM_NO_DATA_M)
  for (let row = 0; row < TERRAIN_TILE_SIZE; row++) {
    for (let column = 0; column < TERRAIN_TILE_SIZE; column++) {
      let x = (2 * ((tile.x + (column + 0.5) / TERRAIN_TILE_SIZE) / scale) - 1) * WEB_MERCATOR_HALF_M
      let y = (1 - 2 * ((tile.y + (row + 0.5) / TERRAIN_TILE_SIZE) / scale)) * WEB_MERCATOR_HALF_M
      if (geographic) [y, x] = terrainPixelCenter(tile, column, row)
      const fx = ((x - minX) / (maxX - minX)) * width - 0.5
      const fy = ((maxY - y) / (maxY - minY)) * height - 0.5
      const col0 = Math.min(width - 1, Math.max(0, Math.floor(fx)))
      const row0 = Math.min(height - 1, Math.max(0, Math.floor(fy)))
      const col1 = Math.min(width - 1, col0 + 1)
      const row1 = Math.min(height - 1, row0 + 1)
      const tx = Math.min(1, Math.max(0, fx - col0))
      const ty = Math.min(1, Math.max(0, fy - row0))
      const corners: [number | null, number][] = [
        [depthAt(col0, row0), (1 - tx) * (1 - ty)],
        [depthAt(col1, row0), tx * (1 - ty)],
        [depthAt(col0, row1), (1 - tx) * ty],
        [depthAt(col1, row1), tx * ty],
      ]
      let sum = 0
      let weight = 0
      for (const [depth, cornerWeight] of corners) {
        if (depth === null) continue
        sum += depth * cornerWeight
        weight += cornerWeight
      }
      // Under a quarter of the weight, the pixel sits mostly over samples without a depth, so it has none either.
      if (weight >= 0.25) elevations[row * TERRAIN_TILE_SIZE + column] = sum / weight
    }
  }
  return elevations
}

let selfChecked = false

/**
 * Development self-check of the bathymetry tiles and the automatic order, run once where bootstrap installed `assert`.
 */
export const checkBathymetryOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  const tile: TerrainTile = { z: 12, x: 2108, y: 1497 }
  const values = new Float32Array(TERRAIN_TILE_SIZE * TERRAIN_TILE_SIZE).map((_, index) => -1 - index)
  values[5] = 3
  values[6] = Number.NaN
  values[7] = -22222
  const bbox = mercatorBbox(tile).split(',').map(Number)
  const raster: BathymetryRaster = {
    values,
    width: TERRAIN_TILE_SIZE,
    height: TERRAIN_TILE_SIZE,
    bbox,
    geographic: false,
  }
  const elevations = bathymetryTileElevations(raster, tile)
  assert(Math.abs(elevations[300] - values[300]) < 1e-3, 'An aligned raster keeps its own samples')
  assert(
    [5, 6, 7].every((index) => elevations[index] === TERRARIUM_NO_DATA_M),
    'Land and no data carry no depth'
  )
  const marseille = bathymetryLayers('auto').find((layer) => bathymetryLayerCovers(layer, 43.3, 5.35))
  assert(marseille?.layerId === 'emodnet', 'Europe reads EMODnet first')
  const pacific = bathymetryLayers('auto').find((layer) => bathymetryLayerCovers(layer, -20, -140))
  assert(pacific?.layerId === 'gmrt', 'Open ocean reads GMRT first')
}
