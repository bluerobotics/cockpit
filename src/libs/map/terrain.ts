import { Credit, CustomHeightmapTerrainProvider, WebMercatorTilingScheme } from 'cesium'

const terrariumTileUrl = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
// The last level the elevation tiles are published at; deeper tiles are cut from it.
const terrariumMaxZoom = 15
// Height samples along each side of a terrain tile, which neighboring tiles share at their edges.
const samplesPerSide = 65

/**
 * Heights for one Web Mercator tile from the public Terrarium elevation tiles, with everything below sea level raised
 * to it, so the sea stays a flat surface under the imagery and the boats on it.
 * @param {number} x - Tile column.
 * @param {number} y - Tile row, from the north.
 * @param {number} zoom - Tile level.
 * @param {number} size - Samples along each side.
 * @returns {Promise<Float32Array>} The `size` by `size` heights in meters, row by row from the north-west corner.
 */
export const terrariumHeights = async (x: number, y: number, zoom: number, size: number): Promise<Float32Array> => {
  const sourceZoom = Math.min(zoom, terrariumMaxZoom)
  const scale = 2 ** (zoom - sourceZoom)
  const [sourceX, sourceY] = [Math.floor(x / scale), Math.floor(y / scale)]
  const response = await fetch(`${terrariumTileUrl}/${sourceZoom}/${sourceX}/${sourceY}.png`)
  if (!response.ok) throw new Error(`Terrain tile request failed with status ${response.status}`)
  const image = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(image.width, image.height)
  const context = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
  context.drawImage(image, 0, 0)
  image.close()
  const { data: pixels, width } = context.getImageData(0, 0, canvas.width, canvas.height)

  const span = width / scale
  const [originX, originY] = [(x - sourceX * scale) * span, (y - sourceY * scale) * span]
  const pixelAt = (sample: number, origin: number): number =>
    Math.min(Math.floor(origin + (sample / (size - 1)) * span), width - 1)
  const heights = new Float32Array(size * size)
  for (let row = 0; row < size; row++) {
    const pixelRow = pixelAt(row, originY)
    for (let column = 0; column < size; column++) {
      const i = (pixelRow * width + pixelAt(column, originX)) * 4
      // Terrarium stores the height plus 32768 m as red * 256 + green + blue / 256.
      heights[row * size + column] = Math.max(pixels[i] * 256 + pixels[i + 1] + pixels[i + 2] / 256 - 32768, 0)
    }
  }
  return heights
}

/**
 * Terrarium covers the whole world down to its last level, and saying so lets Cesium load the tiles in view at once.
 * Left unknown, Cesium only learns a tile exists from its loaded parent, so the view would sharpen one level at a time,
 * each a round trip to the tile server.
 */
class TerrariumTerrainProvider extends CustomHeightmapTerrainProvider {
  /**
   * Whether a tile exists.
   * @returns {boolean} Always true.
   */
  override getTileDataAvailable(): boolean {
    return true
  }
}

/**
 * A terrain provider drawing {@link terrariumHeights}.
 * @param {() => void} onTileLoaded - Called as each tile's heights arrive. A map rendering on demand has to render
 *   then, since these requests bypass Cesium's scheduler, whose completions are what normally trigger a render.
 * @returns {CustomHeightmapTerrainProvider} The provider.
 */
export const terrariumTerrainProvider = (onTileLoaded: () => void): CustomHeightmapTerrainProvider =>
  new TerrariumTerrainProvider({
    width: samplesPerSide,
    height: samplesPerSide,
    tilingScheme: new WebMercatorTilingScheme(),
    callback: (x, y, level) => terrariumHeights(x, y, level, samplesPerSide).finally(onTileLoaded),
    credit: new Credit('© Mapzen terrain tiles'),
  })
