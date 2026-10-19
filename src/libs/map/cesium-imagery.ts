import {
  type ImageryTypes,
  type Request,
  Credit,
  Rectangle,
  UrlTemplateImageryProvider,
  WebMercatorTilingScheme,
} from 'cesium'

import type { TileCoordinates } from '@/libs/map/map-tile-fallback'

/** Options for {@link CockpitTileImageryProvider}. */
export interface CockpitTileImageryOptions {
  /** Loads one tile, addressed on the XYZ grid. */
  load: (coords: TileCoordinates) => Promise<ImageBitmap>
  /** Deepest zoom the provider serves tiles for; deeper views upscale it. */
  maximumLevel?: number
  /** Shallowest zoom the provider serves tiles for. */
  minimumLevel?: number
  /** Area the provider has tiles for, as `[west, south, east, north]` in degrees. */
  bounds?: [number, number, number, number]
  /** Whether the provider numbers rows from the south (TMS). */
  tms?: boolean
  /** Attribution of the provider. */
  attribution?: string
}

/**
 * A Web Mercator raster provider whose tiles come from Cockpit's own loader (offline cache, network, noise fallback,
 * display adjustments) instead of Cesium's image requests. It reuses `UrlTemplateImageryProvider` for the tiling,
 * levels, bounds and credit, and replaces only how an image is fetched.
 */
export class CockpitTileImageryProvider extends UrlTemplateImageryProvider {
  private readonly loadTile: (coords: TileCoordinates) => Promise<ImageBitmap>
  private readonly tms: boolean

  /**
   * Describes the provider.
   * @param {CockpitTileImageryOptions} options - How tiles are loaded and where the provider has them.
   */
  constructor(options: CockpitTileImageryOptions) {
    const [west, south, east, north] = options.bounds ?? [-180, -85.0511287798, 180, 85.0511287798]
    super({
      url: 'cockpit-tile/{z}/{x}/{y}',
      tilingScheme: new WebMercatorTilingScheme(),
      tileWidth: 256,
      tileHeight: 256,
      minimumLevel: options.minimumLevel ?? 0,
      maximumLevel: options.maximumLevel,
      rectangle: Rectangle.fromDegrees(west, south, east, north),
      credit: options.attribution ? new Credit(options.attribution) : undefined,
      hasAlphaChannel: true,
    })
    this.loadTile = options.load
    this.tms = options.tms ?? false
  }

  /**
   * Loads a tile through Cockpit's loader.
   * @param {number} x - Column.
   * @param {number} y - Row, from the north.
   * @param {number} level - Zoom level, which is the tile-scale zoom.
   * @param {Request} [request] - Cesium's request, unused: the loader does its own fetching.
   * @returns {Promise<ImageryTypes>} The tile image.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override requestImage(x: number, y: number, level: number, request?: Request): Promise<ImageryTypes> {
    return this.loadTile({ z: level, x, y: this.tms ? 2 ** level - 1 - y : y })
  }
}
