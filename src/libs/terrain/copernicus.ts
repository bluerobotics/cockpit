import { type TerrainTile, TERRAIN_TILE_SIZE, terrainPixelCenter, terrainPixelSizeMeters } from './tiles'

/**
 * One one-degree file of the Copernicus surface model, named by its south-west corner.
 */
export interface CopernicusCell {
  /**
   * Latitude of the southern edge, a whole degree.
   */
  latFloor: number
  /**
   * Longitude of the western edge, a whole degree.
   */
  lonFloor: number
}

/**
 * A block of samples of one cell, in 30 m lattice indices counted from its north-west sample.
 */
export interface CopernicusWindow {
  /**
   * First row, 0 on the northern edge.
   */
  row0: number
  /**
   * Last row, inclusive.
   */
  row1: number
  /**
   * First column, 0 on the western edge.
   */
  col0: number
  /**
   * Last column, inclusive.
   */
  col1: number
  /**
   * Distance between the rows and columns read, in lattice indices; above 1 reads an overview.
   */
  step: number
}

/**
 * Reads blocks of Copernicus cells, wherever they are stored. Cockpit Standalone reads the public
 * files over HTTP.
 */
export interface CopernicusCellReader {
  /**
   * Reads one window, row-major, with `step` between samples. Resolves to null for a cell that
   * does not exist because it is open sea, and rejects when the cell could not be read.
   */
  readWindow: (cell: CopernicusCell, window: CopernicusWindow) => Promise<Float32Array | null>
}

/** Samples per degree of latitude in the 30 m model. */
const COPERNICUS_ROWS_PER_DEGREE = 3600

/**
 * Columns per degree of longitude in a cell, which the model thins toward the poles so its samples
 * stay roughly square on the ground.
 * @param {number} latFloor Latitude of the cell's southern edge.
 * @returns {number} Columns in the 30 m cell.
 */
const copernicusColumnsPerDegree = (latFloor: number): number => {
  const bandLat = latFloor >= 0 ? latFloor : -latFloor - 1
  if (bandLat < 50) return 3600
  if (bandLat < 60) return 2400
  if (bandLat < 70) return 1800
  if (bandLat < 80) return 1200
  if (bandLat < 85) return 720
  return 360
}

/**
 * File name of a cell, without extension, as published in the public bucket.
 * @param {CopernicusCell} cell Cell to name.
 * @param {30 | 90} resolutionM Model resolution.
 * @returns {string} Name such as `Copernicus_DSM_COG_10_N46_00_E007_00_DEM`.
 */
export const copernicusCellName = ({ latFloor, lonFloor }: CopernicusCell, resolutionM: 30 | 90 = 30): string => {
  const lat = `${latFloor >= 0 ? 'N' : 'S'}${String(Math.abs(latFloor)).padStart(2, '0')}`
  const lon = `${lonFloor >= 0 ? 'E' : 'W'}${String(Math.abs(lonFloor)).padStart(3, '0')}`
  return `Copernicus_DSM_COG_${resolutionM === 30 ? 10 : 30}_${lat}_00_${lon}_00_DEM`
}

/**
 * Public URL of a cell's Cloud Optimized GeoTIFF.
 * @param {CopernicusCell} cell Cell to address.
 * @param {30 | 90} resolutionM Model resolution.
 * @returns {string} The file URL.
 */
export const copernicusCellUrl = (cell: CopernicusCell, resolutionM: 30 | 90 = 30): string => {
  const name = copernicusCellName(cell, resolutionM)
  return `https://copernicus-dem-${resolutionM}m.s3.amazonaws.com/${name}/${name}.tif`
}

const wrapLongitude = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180

type LatticePoint = {
  /**
   * Cell the point lies in.
   */
  cell: CopernicusCell
  /**
   * Row inside the cell, from its north edge.
   */
  row: number
  /**
   * Column inside the cell, from its west edge.
   */
  col: number
}
type RowSample = {
  /**
   * Lattice point west of the sample.
   */
  west: LatticePoint
  /**
   * Lattice point east of it.
   */
  east: LatticePoint
  /**
   * How far the sample sits from the west point toward the east one, from 0 to 1.
   */
  fx: number
}

const cellKey = ({ latFloor, lonFloor }: CopernicusCell): string => `${latFloor}/${lonFloor}`

// A sample on a whole degree belongs to the cell south of it, whose first row it is.
const latticeRowAt = (
  globalRow: number
): {
  /**
   * Latitude of the southern edge of the cell holding the row.
   */
  latFloor: number
  /**
   * Row inside that cell, from its north edge.
   */
  row: number
} => {
  const lat = 90 - globalRow / COPERNICUS_ROWS_PER_DEGREE
  const latFloor = Math.ceil(lat - 1e-9) - 1
  return { latFloor, row: Math.round((latFloor + 1 - lat) * COPERNICUS_ROWS_PER_DEGREE) }
}

// Interpolates along one lattice row, whose column spacing is set by the cell the row lies in.
const rowSample = (latFloor: number, row: number, lon: number, step: number): RowSample => {
  const lonFloor = Math.floor(lon)
  const columns = copernicusColumnsPerDegree(latFloor)
  const position = (lon - lonFloor) * columns
  const westCol = Math.floor(position / step) * step
  const eastCol = westCol + step
  const west: LatticePoint = { cell: { latFloor, lonFloor }, row, col: westCol }
  const crossesSeam = eastCol >= columns
  const east: LatticePoint = crossesSeam
    ? { cell: { latFloor, lonFloor: wrapLongitude(lonFloor + 1) }, row, col: 0 }
    : { cell: { latFloor, lonFloor }, row, col: eastCol }
  const span = (crossesSeam ? columns : eastCol) - westCol
  return { west, east, fx: (position - westCol) / span }
}

/**
 * Lattice step to read a tile at, so coarse zooms read the model's overviews instead of every sample.
 * @param {TerrainTile} tile Tile to build.
 * @returns {number} Step in 30 m samples, a power of two.
 */
const copernicusStepForTile = (tile: TerrainTile): number => {
  const [lat] = terrainPixelCenter(tile, TERRAIN_TILE_SIZE / 2, TERRAIN_TILE_SIZE / 2)
  const pixelM = terrainPixelSizeMeters(lat, tile.z)
  let step = 1
  while (step < 16 && step * 2 * 30 <= pixelM) step *= 2
  return step
}

/**
 * Where one tile pixel reads the lattice.
 */
interface PixelSample {
  /**
   * Lattice row on or above the pixel.
   */
  north: RowSample
  /**
   * Lattice row below it.
   */
  south: RowSample
  /**
   * How far the pixel sits from the north row toward the south one, from 0 to 1.
   */
  fy: number
}

/**
 * The part of a cell a tile reads.
 */
interface CellWindow {
  /**
   * Cell read.
   */
  cell: CopernicusCell
  /**
   * Rows and columns read from it.
   */
  window: CopernicusWindow
}

/**
 * Builds the heights of one Terrarium tile from the Copernicus surface model, interpolating between
 * its samples, including across the seams between its one-degree files. Open sea reads 0 m, as in
 * the model itself.
 * @param {TerrainTile} tile Tile to build.
 * @param {CopernicusCellReader} reader Where the cells are read from.
 * @returns {Promise<Float32Array>} Height in meters for every pixel, row-major.
 */
export const buildCopernicusTile = async (tile: TerrainTile, reader: CopernicusCellReader): Promise<Float32Array> => {
  const step = copernicusStepForTile(tile)
  const samples: PixelSample[] = []
  for (let row = 0; row < TERRAIN_TILE_SIZE; row++) {
    for (let column = 0; column < TERRAIN_TILE_SIZE; column++) {
      const [lat, lon] = terrainPixelCenter(tile, column, row)
      const globalRow = (90 - lat) * COPERNICUS_ROWS_PER_DEGREE
      const northRow = Math.floor(globalRow / step) * step
      const north = latticeRowAt(northRow)
      const south = latticeRowAt(northRow + step)
      samples.push({
        north: rowSample(north.latFloor, north.row, lon, step),
        south: rowSample(south.latFloor, south.row, lon, step),
        fy: (globalRow - northRow) / step,
      })
    }
  }

  const windows = new Map<string, CellWindow>()
  const include = ({ cell, row, col }: LatticePoint): void => {
    const key = cellKey(cell)
    const entry = windows.get(key)
    if (!entry) {
      windows.set(key, { cell, window: { row0: row, row1: row, col0: col, col1: col, step } })
      return
    }
    const window = entry.window
    window.row0 = Math.min(window.row0, row)
    window.row1 = Math.max(window.row1, row)
    window.col0 = Math.min(window.col0, col)
    window.col1 = Math.max(window.col1, col)
  }
  samples.forEach(({ north, south }) => [north.west, north.east, south.west, south.east].forEach(include))

  const values = new Map<string, Float32Array | null>()
  await Promise.all(
    [...windows].map(async ([key, { cell, window }]) => values.set(key, await reader.readWindow(cell, window)))
  )

  const valueAt = ({ cell, row, col }: LatticePoint): number => {
    const key = cellKey(cell)
    const block = values.get(key)
    if (!block) return 0
    const { window } = windows.get(key)!
    const width = (window.col1 - window.col0) / step + 1
    return block[((row - window.row0) / step) * width + (col - window.col0) / step] ?? 0
  }
  const along = ({ west, east, fx }: RowSample): number => valueAt(west) + (valueAt(east) - valueAt(west)) * fx

  const heights = new Float32Array(TERRAIN_TILE_SIZE * TERRAIN_TILE_SIZE)
  samples.forEach(({ north, south, fy }, index) => {
    const northValue = along(north)
    heights[index] = northValue + (along(south) - northValue) * fy
  })
  return heights
}

let selfChecked = false

/**
 * Development self-check of the cell lattice, run once where bootstrap installed `assert`.
 */
export const checkCopernicusLatticeOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV || typeof assert !== 'function') return
  selfChecked = true
  assert(
    copernicusCellName({ latFloor: -1, lonFloor: -73 }) === 'Copernicus_DSM_COG_10_S01_00_W073_00_DEM',
    'A cell is named by its south-west corner'
  )
  assert(copernicusColumnsPerDegree(55) === 2400 && copernicusColumnsPerDegree(-56) === 2400, 'Bands are symmetric')
  const onDegree = latticeRowAt((90 - 46) * COPERNICUS_ROWS_PER_DEGREE)
  assert(onDegree.latFloor === 45 && onDegree.row === 0, 'A whole-degree row belongs to the cell south of it')
  const seam = rowSample(46, 10, 7.99999, 1)
  assert(seam.east.cell.lonFloor === 8 && seam.east.col === 0, 'The last column interpolates into the next cell')
}
