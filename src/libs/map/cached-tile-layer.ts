import L from 'leaflet'

import type { TileArchiveSource } from './tile-archive'

// Draws the tile at `coords` onto `ctx`. Zooming past the archive's native maximum never reaches here: Leaflet
// clamps the request to the layer's `maxNativeZoom` and upscales the result itself.
const drawTile = async (
  source: TileArchiveSource,
  coords: L.Coords,
  ctx: CanvasRenderingContext2D,
  size: L.Point
): Promise<void> => {
  const blob = await source.getTile(coords.z, coords.x, coords.y)
  if (!blob) return
  const bitmap = await createImageBitmap(blob)
  ctx.drawImage(bitmap, 0, 0, size.x, size.y)
  bitmap.close()
}

/**
 * Options for {@link createCachedTileLayer}.
 */
export interface CachedTileLayerOptions extends L.GridLayerOptions {
  /**
   * Resolves the archive the layer pulls tiles from. Called only when the layer needs to draw a tile, i.e. when
   * the provider is selected, so its archive is not downloaded/opened until then. Caching the resolved source
   * (and deciding whether a failed resolution may be retried) is the provider's responsibility.
   */
  sourceProvider: () => Promise<TileArchiveSource>
}

/**
 * Builds a Leaflet layer that renders tiles read from a {@link TileArchiveSource} (a locally-cached custom tile
 * archive) instead of fetching them from a URL. Missing tiles render transparent so the base map shows through.
 * The backing archive is resolved lazily via `sourceProvider`, so nothing is downloaded or opened until the
 * layer is actually shown.
 * @param {CachedTileLayerOptions} options - Grid-layer options plus the lazy tile-source provider.
 * @returns {L.GridLayer} The configured layer, ready to add to a map.
 */
export const createCachedTileLayer = (options: CachedTileLayerOptions): L.GridLayer => {
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

      ;(this.options as CachedTileLayerOptions)
        .sourceProvider()
        .then((source) => drawTile(source, coords, ctx, size))
        .then(() => done(undefined, canvas))
        .catch((error) => done(error as Error, canvas))
      return canvas
    },
  }) as unknown as new (layerOptions: CachedTileLayerOptions) => L.GridLayer

  return new CachedGridLayer(options)
}
