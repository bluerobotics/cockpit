import { type GetResourceResponse, type Map as MapLibreMap, type RequestParameters, addProtocol } from 'maplibre-gl'

const terrainProtocol = 'cockpit-terrain'
const terrainSourceId = 'cockpit-terrain'
const terrariumTileUrl = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
// The last level the elevation tiles are published at; MapLibre stretches it past that.
const terrariumMaxZoom = 15

/**
 * Raises everything below sea level to it in a Terrarium tile's RGBA pixels, in place, so the sea stays a flat surface
 * under the imagery and the boats on it.
 * @param {Uint8ClampedArray} pixels - The tile's pixels.
 */
export const flattenSeafloor = (pixels: Uint8ClampedArray): void => {
  // Terrarium stores the height plus 32768 m as red * 256 + green + blue / 256, so a red under 128 is below 0 m.
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] >= 128) continue
    pixels[i] = 128
    pixels[i + 1] = 0
    pixels[i + 2] = 0
  }
}

const loadTerrainTile = async (
  request: RequestParameters,
  abortController: AbortController
): Promise<GetResourceResponse<ArrayBuffer>> => {
  const path = request.url.slice(`${terrainProtocol}://`.length)
  const response = await fetch(`${terrariumTileUrl}/${path}.png`, { signal: abortController.signal })
  if (!response.ok) throw new Error(`Terrain tile request failed with status ${response.status}`)
  const image = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(image.width, image.height)
  const context = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
  context.drawImage(image, 0, 0)
  image.close()
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  flattenSeafloor(pixels.data)
  context.putImageData(pixels, 0, 0)
  return { data: await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer() }
}

let protocolRegistered = false

/**
 * Shows or hides 3D terrain on a map, from public elevation tiles with the seafloor raised to sea level.
 * @param {MapLibreMap} map - The map, with its style loaded.
 * @param {boolean} enabled - Whether to show terrain.
 */
export const setMapTerrain = (map: MapLibreMap, enabled: boolean): void => {
  if (!enabled) {
    map.setTerrain(null)
    return
  }
  if (!protocolRegistered) {
    protocolRegistered = true
    addProtocol(terrainProtocol, loadTerrainTile)
  }
  if (!map.getSource(terrainSourceId)) {
    map.addSource(terrainSourceId, {
      type: 'raster-dem',
      tiles: [`${terrainProtocol}://{z}/{x}/{y}`],
      tileSize: 256,
      maxzoom: terrariumMaxZoom,
      encoding: 'terrarium',
      attribution: '© Mapzen terrain tiles',
    })
  }
  map.setTerrain({ source: terrainSourceId })
}
