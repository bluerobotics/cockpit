import { decodeTerrariumPixels, TERRAIN_TILE_SIZE } from '@/libs/hazards/terrain-rgb'

/**
 * Request to decode one elevation tile.
 */
export interface TerrainDecodeRequest {
  /**
   * Caller-chosen id, echoed back so concurrent requests can be told apart.
   */
  id: string
  /**
   * URL of the Terrarium PNG tile to fetch.
   */
  url: string
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

// Reading a tile's pixels back out of a canvas blocks whoever runs it, which is why the whole
// fetch-and-decode round happens here rather than on the interface thread.
scope.onmessage = async (event: MessageEvent<TerrainDecodeRequest>): Promise<void> => {
  const { id, url } = event.data
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const bitmap = await createImageBitmap(await response.blob())
    const canvas = new OffscreenCanvas(TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('No 2D canvas available to decode the tile with.')

    context.drawImage(bitmap, 0, 0)
    bitmap.close()

    const elevations = decodeTerrariumPixels(context.getImageData(0, 0, TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE).data)
    const answer: TerrainDecodeResponse = { id, elevations }
    scope.postMessage(answer, [elevations.buffer as ArrayBuffer])
  } catch (error) {
    const answer: TerrainDecodeResponse = { id, error: error instanceof Error ? error.message : String(error) }
    scope.postMessage(answer)
  }
}
