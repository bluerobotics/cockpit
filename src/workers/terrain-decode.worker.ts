import { fromArrayBuffer } from 'geotiff'

import { bathymetryTileElevations } from '@/libs/terrain/bathymetry'
import {
  type TerrainTile,
  decodeTerrariumPixels,
  despeckleTerrainElevations,
  TERRAIN_TILE_SIZE,
} from '@/libs/terrain/tiles'

/**
 * How a tile's bytes encode its heights.
 */
export type TerrainTileFormat = 'terrarium' | 'geotiff'

/**
 * Request to decode one elevation tile.
 */
export interface TerrainDecodeRequest {
  /**
   * Caller-chosen id, echoed back so concurrent requests can be told apart.
   */
  id: string
  /**
   * Bytes of the tile: a Terrarium PNG, or a GeoTIFF of heights from a bathymetry service.
   */
  image: ArrayBuffer
  /**
   * How the bytes encode the heights.
   */
  format: TerrainTileFormat
  /**
   * Tile the bytes cover.
   */
  tile: TerrainTile
}

/**
 * Answer to a decode request: either the tile's elevations or why they could not be produced.
 */
export interface TerrainDecodeResponse {
  /**
   * Id of the request this answers.
   */
  id: string
  /**
   * Elevation in meters for every pixel of the tile, row-major, when the decode succeeded.
   */
  elevations?: Float32Array
  /**
   * Why the tile could not be decoded, when it could not.
   */
  error?: string
}

/**
 * The bits of the worker's own global scope this file uses. Spelled out because the project is
 * typed against the DOM library, where the ambient `postMessage` is the window's.
 */
interface TerrainWorkerScope {
  /**
   * Handler invoked with each decode request from the main thread.
   */
  onmessage: ((event: MessageEvent<TerrainDecodeRequest>) => void) | null
  /**
   * Sends an answer back, optionally transferring the elevation buffer instead of copying it.
   */
  postMessage: (message: TerrainDecodeResponse, transfer?: Transferable[]) => void
}

const scope = self as unknown as TerrainWorkerScope

const decodeTerrarium = async (png: ArrayBuffer, zoom: number): Promise<Float32Array> => {
  // The pixels are data, so any color management would shift the heights they encode.
  const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  })
  const canvas = new OffscreenCanvas(TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No 2D canvas available to decode the tile with.')

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const pixels = context.getImageData(0, 0, TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE).data
  return despeckleTerrainElevations(decodeTerrariumPixels(pixels), zoom)
}

const decodeGeotiff = async (bytes: ArrayBuffer, tile: TerrainTile): Promise<Float32Array> => {
  const image = await (await fromArrayBuffer(bytes)).getImage()
  const [values] = (await image.readRasters({ samples: [0] })) as unknown as ArrayLike<number>[]
  return bathymetryTileElevations(
    {
      values,
      width: image.getWidth(),
      height: image.getHeight(),
      bbox: image.getBoundingBox(),
      geographic: image.getGeoKeys()?.GTModelTypeGeoKey === 2,
    },
    tile
  )
}

// Reading a tile's pixels back out of a canvas blocks whoever runs it, which is why the decode
// happens here rather than on the interface thread.
scope.onmessage = async (event: MessageEvent<TerrainDecodeRequest>): Promise<void> => {
  const { id, image, format, tile } = event.data
  try {
    const elevations = format === 'geotiff' ? await decodeGeotiff(image, tile) : await decodeTerrarium(image, tile.z)
    const answer: TerrainDecodeResponse = { id, elevations }
    scope.postMessage(answer, [elevations.buffer as ArrayBuffer])
  } catch (error) {
    const answer: TerrainDecodeResponse = { id, error: error instanceof Error ? error.message : String(error) }
    scope.postMessage(answer)
  }
}
