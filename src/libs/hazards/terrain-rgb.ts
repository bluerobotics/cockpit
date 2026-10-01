import type { WaypointCoordinates } from '@/types/mission'

/** Terrarium tiles are 256 px square, whatever the zoom. */
export const TERRAIN_TILE_SIZE = 256

// The deepest zoom the tiles are published at, about 5 m per pixel at the equator. Outside regions
// with finer national surveys the model is roughly 30 m per sample, so there it only upsamples.
export const TERRAIN_TILE_ZOOM = 15

const TERRAIN_TILE_BASE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'

// Web Mercator is undefined at the poles, and the tile grid stops just short of them.
const MAX_MERCATOR_LAT = 85.0511287798

/**
 * A tile of the Terrarium elevation pyramid.
 */
export interface TerrainTile {
  /**
   * Zoom level of the tile.
   */
  z: number
  /**
   * Column of the tile, counted west to east.
   */
  x: number
  /**
   * Row of the tile, counted north to south.
   */
  y: number
}

/**
 * Where one coordinate lands in the elevation pyramid.
 */
export interface TerrainSampleTarget {
  /**
   * Tile holding the sample.
   */
  tile: TerrainTile
  /**
   * Index of the sample within that tile's decoded elevations, row-major.
   */
  index: number
}

/**
 * Key identifying a tile in a cache.
 * @param {TerrainTile} tile Tile to key.
 * @returns {string} The `z/x/y` key.
 */
export const terrainTileKey = ({ z, x, y }: TerrainTile): string => `${z}/${x}/${y}`

/**
 * URL of one Terrarium elevation tile.
 * @param {TerrainTile} tile Tile to address.
 * @returns {string} The tile's public URL.
 */
export const terrainTileUrl = (tile: TerrainTile): string => `${TERRAIN_TILE_BASE_URL}/${terrainTileKey(tile)}.png`

/**
 * Locates a coordinate in the elevation pyramid, as the tile covering it and the pixel within that
 * tile. Nearest pixel rather than an interpolation: with the model's samples roughly 30 m apart in
 * most of the world, a smoothed value would read as more precise than the model behind it.
 * @param {WaypointCoordinates} coordinates Position to locate, as `[latitude, longitude]`.
 * @param {number} zoom Zoom level to sample at.
 * @returns {TerrainSampleTarget} The tile and the index of the sample inside it.
 */
export const terrainSampleTarget = (
  [lat, lng]: WaypointCoordinates,
  zoom: number = TERRAIN_TILE_ZOOM
): TerrainSampleTarget => {
  const scale = 2 ** zoom
  const clampedLat = Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat))
  const latRad = (clampedLat * Math.PI) / 180

  const worldX = ((((lng + 180) % 360) + 360) % 360) / 360
  const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2

  const columnFloat = worldX * scale
  const rowFloat = worldY * scale
  const x = Math.min(scale - 1, Math.floor(columnFloat))
  const y = Math.min(scale - 1, Math.floor(rowFloat))

  const pixelX = Math.min(TERRAIN_TILE_SIZE - 1, Math.floor((columnFloat - x) * TERRAIN_TILE_SIZE))
  const pixelY = Math.min(TERRAIN_TILE_SIZE - 1, Math.floor((rowFloat - y) * TERRAIN_TILE_SIZE))

  return { tile: { z: zoom, x, y }, index: pixelY * TERRAIN_TILE_SIZE + pixelX }
}

/**
 * Decodes a Terrarium tile's RGBA pixels into meters above sea level, one value per pixel, using
 * the format's `(R * 256 + G + B / 256) - 32768` encoding.
 * @param {Uint8ClampedArray} pixels RGBA bytes of a decoded tile image.
 * @returns {Float32Array} Elevation in meters for every pixel, row-major.
 */
export const decodeTerrariumPixels = (pixels: Uint8ClampedArray): Float32Array => {
  const elevations = new Float32Array(pixels.length / 4)
  for (let index = 0; index < elevations.length; index++) {
    const offset = index * 4
    elevations[index] = pixels[offset] * 256 + pixels[offset + 1] + pixels[offset + 2] / 256 - 32768
  }
  return elevations
}
