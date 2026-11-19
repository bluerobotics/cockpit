import { app, ipcMain, nativeImage } from 'electron'
import { promises as fs } from 'fs'
import { type BlockedSourceOptions, type GeoTIFF, type RemoteSourceOptions, fromUrl } from 'geotiff'
import { join } from 'path'

import {
  type CopernicusCell,
  type CopernicusCellReader,
  type CopernicusWindow,
  buildCopernicusTile,
  copernicusCellName,
  copernicusCellUrl,
} from '../../libs/terrain/copernicus'
import { encodeTerrariumPixels, TERRAIN_TILE_SIZE } from '../../libs/terrain/tiles'

type Resolution = 30 | 90

const CELL_LIST_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 20000
// A tile reads up to four cells, each a header and a few blocks, so it may take several fetches in a row.
const TILE_BUILD_TIMEOUT_MS = 90000
const MAX_OPEN_FILES = 12
// No surface on Earth is this deep, so anything below it is a void in the model rather than a height.
const VOID_BELOW_M = -12000
const MIN_ZOOM = 8
const MAX_ZOOM = 13

const cellLists = new Map<Resolution, Promise<Set<string>>>()
const openFiles = new Map<string, Promise<GeoTIFF>>()
const inFlightTiles = new Map<string, Promise<Uint8Array>>()

const cellListPath = (resolutionM: Resolution): string =>
  join(app.getPath('userData'), 'terrain', `copernicus-${resolutionM}m-cells.txt`)

const parseCellList = (text: string): Set<string> =>
  new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('Copernicus_DSM_'))
  )

const readCachedCellList = async (
  resolutionM: Resolution
): Promise<{
  /**
   * Cells the bucket holds.
   */
  cells: Set<string>
  /**
   * Whether the list is recent enough to use without refreshing it.
   */
  fresh: boolean
} | null> => {
  try {
    const path = cellListPath(resolutionM)
    const [text, stats] = await Promise.all([fs.readFile(path, 'utf8'), fs.stat(path)])
    const cells = parseCellList(text)
    if (cells.size === 0) return null
    return { cells, fresh: Date.now() - stats.mtimeMs < CELL_LIST_MAX_AGE_MS }
  } catch {
    return null
  }
}

// Which cells exist is what tells open sea from a file that failed to download, so the list is kept
// on disk and only an empty or unreadable answer is ever treated as "no list".
const fetchCellList = async (resolutionM: Resolution): Promise<Set<string>> => {
  const cached = await readCachedCellList(resolutionM)
  if (cached?.fresh) return cached.cells
  try {
    const url = `https://copernicus-dem-${resolutionM}m.s3.amazonaws.com/tileList.txt`
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    const cells = parseCellList(text)
    if (cells.size === 0) throw new Error('The cell list is empty.')
    const path = cellListPath(resolutionM)
    await fs.mkdir(join(path, '..'), { recursive: true })
    await fs.writeFile(`${path}.tmp`, text)
    await fs.rename(`${path}.tmp`, path)
    return cells
  } catch (error) {
    if (cached) return cached.cells
    throw new Error(`Could not list the Copernicus ${resolutionM} m cells: ${(error as Error).message}`)
  }
}

const cellList = (resolutionM: Resolution): Promise<Set<string>> => {
  const existing = cellLists.get(resolutionM)
  if (existing) return existing
  const loading = fetchCellList(resolutionM)
  loading.catch(() => cellLists.delete(resolutionM))
  cellLists.set(resolutionM, loading)
  return loading
}

const openFile = (url: string): Promise<GeoTIFF> => {
  const existing = openFiles.get(url)
  if (existing) {
    openFiles.delete(url)
    openFiles.set(url, existing)
    return existing
  }
  // Neighboring tiles read the same internal blocks, so the source keeps about 8 MB of them per file.
  const blockOptions: BlockedSourceOptions = { blockSize: 65536, cacheSize: 128 }
  // geotiff forwards block options to the remote source, though its typing only names the remote ones.
  const opening = fromUrl(url, blockOptions as RemoteSourceOptions, AbortSignal.timeout(FETCH_TIMEOUT_MS))
  opening.catch(() => openFiles.delete(url))
  openFiles.set(url, opening)
  while (openFiles.size > MAX_OPEN_FILES) {
    const oldest = openFiles.keys().next().value
    if (oldest === undefined) break
    openFiles.delete(oldest)
  }
  return opening
}

// GLO-90 fills the few cells GLO-30 omits; it is read on the same 30 m lattice, three samples per pixel.
const resolutionOf = async (cell: CopernicusCell): Promise<Resolution | null> => {
  if ((await cellList(30)).has(copernicusCellName(cell, 30))) return 30
  if ((await cellList(90)).has(copernicusCellName(cell, 90))) return 90
  return null
}

const readWindow = async (cell: CopernicusCell, window: CopernicusWindow): Promise<Float32Array | null> => {
  const resolutionM = await resolutionOf(cell)
  if (resolutionM === null) return null
  const tiff = await openFile(copernicusCellUrl(cell, resolutionM))
  const base = await tiff.getImage(0)
  const datasetFactor = resolutionM === 30 ? 1 : 3

  // ponytail: an overview pixel is read as if centered on its first 30 m sample, up to half an overview pixel off;
  // reading the overview's own geotransform is the upgrade.
  let image = base
  let factor = datasetFactor
  const imageCount = await tiff.getImageCount()
  for (let index = 1; index < imageCount; index++) {
    const overview = await tiff.getImage(index)
    const overviewFactor = datasetFactor * Math.round(base.getWidth() / overview.getWidth())
    if (overviewFactor > window.step) break
    image = overview
    factor = overviewFactor
  }

  const width = image.getWidth()
  const height = image.getHeight()
  const sourceRow = (row: number): number => Math.min(height - 1, Math.floor(row / factor))
  const sourceCol = (col: number): number => Math.min(width - 1, Math.floor(col / factor))
  const [x0, y0, x1, y1] = [
    sourceCol(window.col0),
    sourceRow(window.row0),
    sourceCol(window.col1),
    sourceRow(window.row1),
  ]
  const raster = (await image.readRasters({
    window: [x0, y0, x1 + 1, y1 + 1],
    samples: [0],
    interleave: true,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })) as Float32Array | Int16Array
  const rasterWidth = x1 - x0 + 1

  const columns = (window.col1 - window.col0) / window.step + 1
  const rows = (window.row1 - window.row0) / window.step + 1
  const values = new Float32Array(columns * rows)
  for (let row = 0; row < rows; row++) {
    const y = sourceRow(window.row0 + row * window.step) - y0
    for (let col = 0; col < columns; col++) {
      const x = sourceCol(window.col0 + col * window.step) - x0
      const value = raster[y * rasterWidth + x]
      values[row * columns + col] = value < VOID_BELOW_M ? 0 : value
    }
  }
  return values
}

const reader: CopernicusCellReader = { readWindow }

// Terrarium tiles are opaque, so swapping red and blue into the BGRA order nativeImage takes is all the encoding needs.
const encodePng = (rgba: Uint8ClampedArray, size: number): Buffer => {
  const bgra = Buffer.from(rgba)
  for (let index = 0; index < bgra.length; index += 4) [bgra[index], bgra[index + 2]] = [bgra[index + 2], bgra[index]]
  return nativeImage.createFromBitmap(bgra, { width: size, height: size }).toPNG()
}

// ponytail: tiles are resampled and encoded on the main process, a few milliseconds of blocking each; a utility
// process is the upgrade if prefetching large areas makes the window stutter.
const buildTile = async (z: number, x: number, y: number): Promise<Uint8Array> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`The Copernicus tile ${z}/${x}/${y} took too long to build.`)),
      TILE_BUILD_TIMEOUT_MS
    )
  })
  try {
    const heights = await Promise.race([buildCopernicusTile({ z, x, y }, reader), deadline])
    return new Uint8Array(encodePng(encodeTerrariumPixels(heights), TERRAIN_TILE_SIZE))
  } finally {
    clearTimeout(timer)
  }
}

const getCopernicusTerrainTile = async (
  _event: Electron.IpcMainInvokeEvent,
  z: number,
  x: number,
  y: number
): Promise<Uint8Array> => {
  const valid = [z, x, y].every(Number.isInteger) && z >= MIN_ZOOM && z <= MAX_ZOOM
  if (!valid || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    throw new Error(`There is no Copernicus terrain tile ${z}/${x}/${y}.`)
  }
  const key = `${z}/${x}/${y}`
  const running = inFlightTiles.get(key)
  if (running) return running
  const building = buildTile(z, x, y).finally(() => inFlightTiles.delete(key))
  inFlightTiles.set(key, building)
  return building
}

/**
 * Serves Terrarium tiles built from the Copernicus surface model, whose public files cannot be read
 * from the renderer because they are published without CORS headers.
 */
export const setupTerrainService = (): void => {
  ipcMain.handle('get-copernicus-terrain-tile', getCopernicusTerrainTile)
}
