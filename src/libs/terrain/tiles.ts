import type { WaypointCoordinates } from '@/types/mission'

/** Terrarium tiles are 256 px square, whatever the zoom. */
export const TERRAIN_TILE_SIZE = 256

// The deepest zoom the tiles are published at, about 5 m per pixel at the equator. Outside regions
// with finer national surveys the model is roughly 30 m per sample, so there it only upsamples.
export const TERRAIN_TILE_ZOOM = 15

/**
 * Coarsest zoom whose pixels are no wider than a grid's spacing, so a coarse grid reads few tiles.
 * @param {number} spacingDeg Grid spacing, in degrees of longitude.
 * @returns {number} The zoom, at most the deepest one published.
 */
export const terrainZoomForSpacing = (spacingDeg: number): number =>
  Math.max(0, Math.min(TERRAIN_TILE_ZOOM, Math.ceil(Math.log2(360 / (TERRAIN_TILE_SIZE * spacingDeg)))))

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
 * The four tile pixels surrounding a coordinate, and where the coordinate sits between them.
 */
export interface TerrainLatticeCell {
  /**
   * North-west, north-east, south-west and south-east pixels, in that order. They can belong to
   * different tiles when the coordinate falls near a tile edge.
   */
  corners: [TerrainSampleTarget, TerrainSampleTarget, TerrainSampleTarget, TerrainSampleTarget]
  /**
   * Fraction of the way from the western pixels to the eastern ones, 0 to 1.
   */
  fx: number
  /**
   * Fraction of the way from the northern pixels to the southern ones, 0 to 1.
   */
  fy: number
}

/**
 * Geographic bounds of a tile, in degrees.
 */
export interface TerrainTileBounds {
  /**
   * Northern edge latitude.
   */
  north: number
  /**
   * Southern edge latitude.
   */
  south: number
  /**
   * Western edge longitude.
   */
  west: number
  /**
   * Eastern edge longitude.
   */
  east: number
}

/**
 * Key identifying a tile in a cache.
 * @param {TerrainTile} tile Tile to key.
 * @returns {string} The `z/x/y` key.
 */
export const terrainTileKey = ({ z, x, y }: TerrainTile): string => `${z}/${x}/${y}`

const worldPixel = ([lat, lng]: WaypointCoordinates, zoom: number): [number, number] => {
  const worldSize = TERRAIN_TILE_SIZE * 2 ** zoom
  const clampedLat = Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat))
  const latRad = (clampedLat * Math.PI) / 180
  const worldX = ((((lng + 180) % 360) + 360) % 360) / 360
  const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
  return [worldX * worldSize, worldY * worldSize]
}

const targetAtPixel = (pixelX: number, pixelY: number, zoom: number): TerrainSampleTarget => {
  const worldSize = TERRAIN_TILE_SIZE * 2 ** zoom
  const wrappedX = ((pixelX % worldSize) + worldSize) % worldSize
  const clampedY = Math.min(worldSize - 1, Math.max(0, pixelY))
  const x = Math.floor(wrappedX / TERRAIN_TILE_SIZE)
  const y = Math.floor(clampedY / TERRAIN_TILE_SIZE)
  const index = (clampedY - y * TERRAIN_TILE_SIZE) * TERRAIN_TILE_SIZE + (wrappedX - x * TERRAIN_TILE_SIZE)
  return { tile: { z: zoom, x, y }, index }
}

/**
 * Locates a coordinate in the elevation pyramid, as the tile covering it and the pixel within that
 * tile. Nearest pixel rather than an interpolation: with the model's samples roughly 30 m apart in
 * most of the world, a smoothed value would read as more precise than the model behind it.
 * @param {WaypointCoordinates} coordinates Position to locate, as `[latitude, longitude]`.
 * @param {number} zoom Zoom level to sample at.
 * @returns {TerrainSampleTarget} The tile and the index of the sample inside it.
 */
export const terrainSampleTarget = (
  coordinates: WaypointCoordinates,
  zoom: number = TERRAIN_TILE_ZOOM
): TerrainSampleTarget => {
  const [pixelX, pixelY] = worldPixel(coordinates, zoom)
  return targetAtPixel(Math.floor(pixelX), Math.floor(pixelY), zoom)
}

/**
 * Locates the four pixels around a coordinate, treating each pixel as a sample at its center, so
 * callers can interpolate between them or take the highest.
 * @param {WaypointCoordinates} coordinates Position to locate, as `[latitude, longitude]`.
 * @param {number} zoom Zoom level to sample at.
 * @returns {TerrainLatticeCell} The surrounding pixels and the position between them.
 */
export const terrainLatticeCell = (coordinates: WaypointCoordinates, zoom: number): TerrainLatticeCell => {
  const [pixelX, pixelY] = worldPixel(coordinates, zoom)
  const column = Math.floor(pixelX - 0.5)
  const row = Math.floor(pixelY - 0.5)
  return {
    corners: [
      targetAtPixel(column, row, zoom),
      targetAtPixel(column + 1, row, zoom),
      targetAtPixel(column, row + 1, zoom),
      targetAtPixel(column + 1, row + 1, zoom),
    ],
    fx: pixelX - 0.5 - column,
    fy: pixelY - 0.5 - row,
  }
}

const latitudeAtWorldY = (worldY: number): number => {
  const mercator = Math.PI * (1 - 2 * worldY)
  return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI
}

/**
 * Position of the center of one pixel of a tile.
 * @param {TerrainTile} tile Tile the pixel belongs to.
 * @param {number} column Pixel column, 0 at the western edge.
 * @param {number} row Pixel row, 0 at the northern edge.
 * @returns {WaypointCoordinates} The pixel center as `[latitude, longitude]`.
 */
export const terrainPixelCenter = ({ z, x, y }: TerrainTile, column: number, row: number): WaypointCoordinates => {
  const scale = 2 ** z
  const worldX = (x + (column + 0.5) / TERRAIN_TILE_SIZE) / scale
  const worldY = (y + (row + 0.5) / TERRAIN_TILE_SIZE) / scale
  return [latitudeAtWorldY(worldY), worldX * 360 - 180]
}

/**
 * Every tile at a zoom that overlaps some bounds.
 * @param {TerrainTileBounds} bounds Area to cover, in degrees, not crossing the antimeridian.
 * @param {number} zoom Zoom level.
 * @returns {TerrainTile[]} The tiles, row by row.
 */
export const terrainTilesInBounds = (bounds: TerrainTileBounds, zoom: number): TerrainTile[] => {
  const northWest = terrainSampleTarget([bounds.north, bounds.west], zoom).tile
  const southEast = terrainSampleTarget([bounds.south, bounds.east], zoom).tile
  const tiles: TerrainTile[] = []
  for (let y = northWest.y; y <= southEast.y; y++) {
    for (let x = northWest.x; x <= southEast.x; x++) tiles.push({ z: zoom, x, y })
  }
  return tiles
}

/**
 * Approximate ground distance between two neighboring pixels at a latitude and zoom.
 * @param {number} lat Latitude in degrees.
 * @param {number} zoom Zoom level.
 * @returns {number} Pixel size in meters.
 */
export const terrainPixelSizeMeters = (lat: number, zoom: number): number =>
  (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (TERRAIN_TILE_SIZE * 2 ** zoom)

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

export const TERRARIUM_NO_DATA_M = -32768

const NEIGHBOR_OFFSETS = [-2, -1, 0, 1, 2].flatMap((dy) =>
  [-2, -1, 0, 1, 2].flatMap((dx) => (dx === 0 && dy === 0 ? [] : [[dx, dy] as const]))
)

const neighborMedianM = (elevations: Float32Array, column: number, row: number): number | null => {
  const values: number[] = []
  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const x = column + dx
    const y = row + dy
    if (x < 0 || y < 0 || x >= TERRAIN_TILE_SIZE || y >= TERRAIN_TILE_SIZE) continue
    const value = elevations[y * TERRAIN_TILE_SIZE + x]
    if (value !== TERRARIUM_NO_DATA_M) values.push(value)
  }
  if (values.length === 0) return null
  values.sort((a, b) => a - b)
  const middle = values.length >> 1
  return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}

let despeckleChecked = false

/**
 * Development self-check of {@link despeckleTerrainElevations}, run once where bootstrap installed `assert`.
 */
export const checkDespeckleOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (despeckleChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  despeckleChecked = true
  const seam = new Float32Array(TERRAIN_TILE_SIZE * TERRAIN_TILE_SIZE).fill(-15)
  seam.fill(-4586, 10 * TERRAIN_TILE_SIZE, 12 * TERRAIN_TILE_SIZE)
  seam[200 * TERRAIN_TILE_SIZE + 5] = TERRARIUM_NO_DATA_M
  seam[100 * TERRAIN_TILE_SIZE + 100] = 50
  despeckleTerrainElevations(seam, 15)
  assert(seam[11 * TERRAIN_TILE_SIZE + 40] === -15, 'A two-pixel seam takes the height around it')
  assert(seam[200 * TERRAIN_TILE_SIZE + 5] === -15, 'A pixel with no data takes the height around it')
  assert(seam[100 * TERRAIN_TILE_SIZE + 100] === 50, 'A plausible bump is kept')
}

const despecklePass = (elevations: Float32Array, limitM: number): number => {
  const source = elevations.slice()
  const step = 2 * TERRAIN_TILE_SIZE
  const last = TERRAIN_TILE_SIZE - 2
  let repaired = 0
  for (let index = 0; index < source.length; index++) {
    const value = source[index]
    const column = index % TERRAIN_TILE_SIZE
    const row = (index - column) / TERRAIN_TILE_SIZE
    const left = source[column < 2 ? index + 2 : index - 2]
    const right = source[column >= last ? index - 2 : index + 2]
    const up = source[row < 2 ? index + step : index - step]
    const down = source[row >= last ? index - step : index + step]
    const suspect = value === TERRARIUM_NO_DATA_M || Math.abs(value - (left + right + up + down) / 4) > limitM / 2
    if (!suspect) continue
    const median = neighborMedianM(source, column, row)
    if (median === null || Math.abs(value - median) <= limitM) continue
    elevations[index] = median
    repaired++
  }
  return repaired
}

/**
 * Repairs small faults in a decoded tile, in place: pixels with no data, and the rows, columns and
 * smears a few pixels wide that some published tiles carry thousands of meters off the ground
 * around them. Each takes the median of the 5 by 5 pixels around it, over a few passes so a wider
 * smear is worn down from its edges.
 * @param {Float32Array} elevations Elevation in meters for every pixel of the tile, row-major.
 * @param {number} zoom Zoom of the tile, which bounds how far a real pixel stands from its neighbors.
 * @returns {Float32Array} The same array, repaired.
 */
export const despeckleTerrainElevations = (elevations: Float32Array, zoom: number): Float32Array => {
  // A real pixel standing that far off the pixels around it would be a 63 degree spire or pit.
  // ponytail: faults within the limit of their surroundings (a few hundred meters) pass; comparing
  // against the coarser zoom's tile would catch those too.
  const limitM = Math.max(300, 4 * terrainPixelSizeMeters(0, zoom))
  for (let pass = 0; pass < 4; pass++) {
    if (despecklePass(elevations, limitM) === 0) break
  }
  return elevations
}

/**
 * Encodes elevations into Terrarium RGBA pixels, the inverse of {@link decodeTerrariumPixels} to the
 * format's 1/256 m step.
 * @param {Float32Array} elevations Elevation in meters for every pixel, row-major.
 * @returns {Uint8ClampedArray} RGBA bytes, fully opaque.
 */
export const encodeTerrariumPixels = (elevations: Float32Array): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(elevations.length * 4)
  for (let index = 0; index < elevations.length; index++) {
    const value = Math.min(32767.99, Math.max(-32768, elevations[index])) + 32768
    const red = Math.floor(value / 256)
    const green = Math.floor(value - red * 256)
    const offset = index * 4
    pixels[offset] = red
    pixels[offset + 1] = green
    pixels[offset + 2] = Math.round((value - red * 256 - green) * 256)
    pixels[offset + 3] = 255
  }
  return pixels
}
