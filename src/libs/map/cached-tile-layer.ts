import L from 'leaflet'

import type { TileArchiveSource } from './tile-archive'

// Draws the tile at `coords` onto `ctx`. For zoom beyond the archive's native maximum, the matching region of
// the deepest available parent tile is upscaled so the chart stays visible while planning zoomed in.
const drawTile = async (
  source: TileArchiveSource,
  coords: L.Coords,
  ctx: CanvasRenderingContext2D,
  size: L.Point
): Promise<void> => {
  if (coords.z <= source.maxZoom) {
    const blob = await source.getTile(coords.z, coords.x, coords.y)
    if (!blob) return
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, 0, 0, size.x, size.y)
    bitmap.close()
    return
  }

  const scale = 2 ** (coords.z - source.maxZoom)
  const parentX = Math.floor(coords.x / scale)
  const parentY = Math.floor(coords.y / scale)
  const blob = await source.getTile(source.maxZoom, parentX, parentY)
  if (!blob) return
  const bitmap = await createImageBitmap(blob)
  const sourceSize = bitmap.width / scale
  const sourceX = (coords.x % scale) * sourceSize
  const sourceY = (coords.y % scale) * sourceSize
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size.x, size.y)
  bitmap.close()
}

/**
 * Options for {@link createCachedTileLayer}.
 */
export interface CachedTileLayerOptions extends L.GridLayerOptions {
  /**
   * Lazily resolves the archive the layer pulls tiles from. Invoked (once) only when the layer first needs to
   * draw a tile, i.e. when the provider is selected, so its archive is not downloaded/opened until then.
   */
  sourceProvider: () => Promise<TileArchiveSource>
}

/**
 * Builds a Leaflet layer that renders tiles read from a {@link TileArchiveSource} (a locally-cached custom tile
 * archive) instead of fetching them from a URL. Missing tiles render transparent so the base map shows through.
 * The backing archive is resolved lazily via `sourceProvider` and memoized, so nothing is downloaded or opened
 * until the layer is actually shown.
 * @param {CachedTileLayerOptions} options - Grid-layer options plus the lazy tile-source provider.
 * @returns {L.GridLayer} The configured layer, ready to add to a map.
 */
export const createCachedTileLayer = (options: CachedTileLayerOptions): L.GridLayer => {
  let sourcePromise: Promise<TileArchiveSource> | undefined

  const CachedGridLayer = L.GridLayer.extend({
    createTile(this: L.GridLayer, coords: L.Coords, done: L.DoneCallback): HTMLElement {
      const size = this.getTileSize()
      const canvas = document.createElement('canvas')
      canvas.width = size.x
      canvas.height = size.y
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        done(undefined, canvas)
        return canvas
      }

      sourcePromise = sourcePromise ?? (this.options as CachedTileLayerOptions).sourceProvider()
      sourcePromise
        .then((source) => drawTile(source, coords, ctx, size))
        .then(() => done(undefined, canvas))
        .catch((error) => done(error as Error, canvas))
      return canvas
    },
  }) as unknown as new (layerOptions: CachedTileLayerOptions) => L.GridLayer

  return new CachedGridLayer(options)
}
