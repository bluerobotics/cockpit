import type { MapOverlayBounds, MapOverlayRenderMode } from '@/types/mission'

// Cap on the rendered image's largest dimension. The raster is rasterized once to a static image; capping keeps
// memory bounded for huge surveys while staying sharp at typical zoom levels.
const MAX_OVERLAY_IMAGE_DIM = 4096

// Bump whenever the rasterization/color logic changes, so persisted render caches produced by an older version
// are treated as misses and regenerated instead of showing a stale image.
export const OVERLAY_RENDER_VERSION = 1

/**
 * The rasterized GeoTIFF as a static image (PNG data URL) plus the geographic bounds it covers. This is the
 * expensive-to-produce artifact; callers can cache it and cheaply build per-map Leaflet image overlays from it.
 */
export interface GeoTiffImage {
  /**
   * PNG data URL of the colorized raster.
   */
  dataUrl: string
  /**
   * WGS84 bounds of the raster as `[[south, west], [north, east]]`.
   */
  bounds: MapOverlayBounds
}

/**
 * Maps a pixel's per-band values to an RGB color, or `null` for transparent (nodata) pixels.
 */
type RasterColorFn = (values: number[]) => [number, number, number] | null

const clampByte = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : Math.round(value))

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value)

// Two-stop ramp: shallow (low value) -> light teal, deep (high value) -> dark navy.
const depthColor = (t: number): [number, number, number] => {
  const ratio = clamp01(t)
  return [
    Math.round(186 * (1 - ratio) + 4 * ratio),
    Math.round(231 * (1 - ratio) + 38 * ratio),
    Math.round(242 * (1 - ratio) + 84 * ratio),
  ]
}

/**
 * Builds the per-pixel color mapping for a render mode. 8-bit rasters are rendered as-is (true color for RGB,
 * grey for single-band); higher bit-depth/float rasters are contrast-stretched per band by their min/max so they
 * don't clamp to a solid white square. Nodata pixels map to `null` (transparent).
 * @param {MapOverlayRenderMode} mode - The selected render mode.
 * @param {number | null} noData - The raster's nodata value, if any.
 * @param {number[] | undefined} mins - Per-band minimums (only needed/used for non-8-bit rasters).
 * @param {number[] | undefined} maxs - Per-band maximums (only needed/used for non-8-bit rasters).
 * @param {boolean} is8bit - Whether the raster is 8-bit (rendered as-is) or must be contrast-stretched.
 * @param {number | null} alphaIndex - Band index holding per-pixel alpha, or `null` when the raster has none.
 * @returns {RasterColorFn} A function mapping a pixel's band values to an RGB tuple or `null`.
 */
const buildColorFn = (
  mode: MapOverlayRenderMode,
  noData: number | null,
  mins: number[] | undefined,
  maxs: number[] | undefined,
  is8bit: boolean,
  alphaIndex: number | null
): RasterColorFn => {
  const isNoData = (value: number | null | undefined): boolean =>
    value === null || value === undefined || Number.isNaN(value) || (noData !== null && value === noData)

  // A zero alpha sample means the pixel is outside the raster's footprint, so it must be transparent in every
  // render mode — otherwise the single-band modes paint that border with their lowest-value color.
  const isTransparent = (values: number[]): boolean => alphaIndex !== null && values[alphaIndex] === 0

  const scaleBand = (value: number, band: number): number => {
    if (is8bit) return clampByte(value)
    const min = mins?.[band]
    const max = maxs?.[band]
    if (typeof min === 'number' && typeof max === 'number' && max > min) {
      return clampByte(((value - min) / (max - min)) * 255)
    }
    return clampByte(value)
  }

  const min0 = mins?.[0]
  const max0 = maxs?.[0]
  const hasRange0 = typeof min0 === 'number' && typeof max0 === 'number' && max0 > min0
  const normalize0 = (value: number): number =>
    hasRange0 ? (value - (min0 as number)) / ((max0 as number) - (min0 as number)) : value / 255

  if (mode === 'bathymetry') {
    return (values) => {
      const value = values[0]
      if (isTransparent(values) || isNoData(value)) return null
      return depthColor(normalize0(value))
    }
  }

  if (mode === 'intensity') {
    return (values) => {
      const value = values[0]
      if (isTransparent(values) || isNoData(value)) return null
      const grey = clampByte(clamp01(normalize0(value)) * 255)
      return [grey, grey, grey]
    }
  }

  // grayscale: render multi-band rasters as RGB(A), single-band as grey, scaling each band to 8-bit.
  return (values) => {
    if (isTransparent(values)) return null
    if (values.length >= 3) {
      const [r, g, b] = values
      if (isNoData(r) && isNoData(g) && isNoData(b)) return null
      return [scaleBand(r, 0), scaleBand(g, 1), scaleBand(b, 2)]
    }
    const value = values[0]
    if (isNoData(value)) return null
    const grey = scaleBand(value, 0)
    return [grey, grey, grey]
  }
}

// Locate the band holding per-pixel alpha via the TIFF ExtraSamples tag (1 = associated, 2 = unassociated alpha),
// falling back to the conventional last band for RGBA / grey+alpha rasters that omit the tag.
const findAlphaBandIndex = (fileDirectory: Record<string, unknown>, bandCount: number): number | null => {
  const extraSamples = fileDirectory.ExtraSamples
  if (Array.isArray(extraSamples) && extraSamples.length > 0) {
    const alphaOffset = extraSamples.findIndex((sample) => sample === 1 || sample === 2)
    if (alphaOffset >= 0) return bandCount - extraSamples.length + alphaOffset
  }
  if (bandCount === 4 || bandCount === 2) return bandCount - 1
  return null
}

/**
 * Per-band minimums and maximums of a raster.
 */
interface BandStats {
  /**
   * Minimum value per band.
   */
  mins: number[]
  /**
   * Maximum value per band.
   */
  maxs: number[]
}

// Per-band min/max over the (already downsampled) bands, skipping nodata/NaN. Only computed for non-8-bit
// rasters, where it's needed to contrast-stretch into the 8-bit display range.
const computeBandStats = (bands: ArrayLike<number>[], noData: number | null): BandStats => {
  const mins: number[] = []
  const maxs: number[] = []
  for (const band of bands) {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < band.length; i++) {
      const value = band[i]
      if (Number.isNaN(value) || (noData !== null && value === noData)) continue
      if (value < min) min = value
      if (value > max) max = value
    }
    mins.push(min)
    maxs.push(max)
  }
  return { mins, maxs }
}

const renderBandsToDataUrl = (
  bands: ArrayLike<number>[],
  width: number,
  height: number,
  colorFn: RasterColorFn
): string => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get a 2D canvas context to render the GeoTIFF')

  const image = ctx.createImageData(width, height)
  const buffer = image.data
  const bandCount = bands.length
  const pixel = new Array<number>(bandCount)

  const pixelCount = width * height
  let offset = 0
  for (let p = 0; p < pixelCount; p++) {
    for (let band = 0; band < bandCount; band++) pixel[band] = bands[band][p]
    const color = colorFn(pixel)
    if (color !== null) {
      buffer[offset] = color[0]
      buffer[offset + 1] = color[1]
      buffer[offset + 2] = color[2]
      buffer[offset + 3] = 255
    }
    offset += 4
  }

  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

// geotiff.js reads byte ranges from the Blob on demand, so for a Cloud-Optimized GeoTIFF only the chosen
// overview's bytes are fetched/decoded — never the whole file. Falls back to the full image for plain GeoTIFFs.
const pickOverviewIndex = async (
  tiff: Awaited<ReturnType<typeof import('geotiff')['fromBlob']>>,
  imageCount: number
): Promise<number> => {
  let chosenIndex = 0
  let chosenLongEdge = Infinity
  for (let i = 0; i < imageCount; i++) {
    const img = await tiff.getImage(i)
    const longEdge = Math.max(img.getWidth(), img.getHeight())
    // Smallest IFD that still covers our display cap, so we decode as few pixels as possible without losing
    // detail. If none reaches the cap (all overviews are smaller), keep the full-resolution image (index 0).
    if (longEdge >= MAX_OVERLAY_IMAGE_DIM && longEdge < chosenLongEdge) {
      chosenLongEdge = longEdge
      chosenIndex = i
    }
  }
  return chosenIndex
}

/**
 * Parses a GeoTIFF blob and rasterizes it once to a static PNG image (the expensive step). Reads from an internal
 * overview when the file is a COG, so large COGs load quickly; the result can be cached and reused to build cheap
 * per-map Leaflet image overlays.
 * @param {Blob} blob - The GeoTIFF file/blob.
 * @param {MapOverlayRenderMode} [renderMode] - Color mapping for the raster values. Defaults to `grayscale`.
 * @returns {Promise<GeoTiffImage>} The rendered image data URL and its WGS84 bounds.
 */
export const renderGeoTiffImage = async (
  blob: Blob,
  renderMode: MapOverlayRenderMode = 'grayscale'
): Promise<GeoTiffImage> => {
  const [geotiff, epsgModule, geoExtentModule] = await Promise.all([
    import('geotiff'),
    import('geotiff-epsg-code'),
    import('geo-extent'),
  ])
  const getEPSGCode = epsgModule.default
  const { GeoExtent } = geoExtentModule

  const tiff = await geotiff.fromBlob(blob)
  const imageCount = await tiff.getImageCount()
  const fullImage = await tiff.getImage(0)
  const overviewIndex = await pickOverviewIndex(tiff, imageCount)
  const image = overviewIndex === 0 ? fullImage : await tiff.getImage(overviewIndex)

  const sourceWidth = image.getWidth()
  const sourceHeight = image.getHeight()
  const noData = image.getGDALNoData()
  const scale = Math.min(1, MAX_OVERLAY_IMAGE_DIM / Math.max(sourceWidth, sourceHeight))
  const outWidth = Math.max(1, Math.round(sourceWidth * scale))
  const outHeight = Math.max(1, Math.round(sourceHeight * scale))

  const bands = (await image.readRasters({
    width: outWidth,
    height: outHeight,
    resampleMethod: 'nearest',
    interleave: false,
  })) as unknown as ArrayLike<number>[]

  const fileDirectory = image.fileDirectory as Record<string, unknown>
  const bitsPerSample = fileDirectory.BitsPerSample
  const is8bit = Array.isArray(bitsPerSample) && bitsPerSample.every((bits) => bits === 8)
  const alphaIndex = findAlphaBandIndex(fileDirectory, bands.length)
  const stats = is8bit ? undefined : computeBandStats(bands, noData)
  const colorFn = buildColorFn(renderMode, noData, stats?.mins, stats?.maxs, is8bit, alphaIndex)
  const dataUrl = renderBandsToDataUrl(bands, outWidth, outHeight, colorFn)

  const epsg = await getEPSGCode(tiff)
  if (epsg === undefined) {
    throw new Error('GeoTIFF has no recognizable CRS (EPSG code); cannot place it on the map.')
  }
  const [xmin, ymin, xmax, ymax] = fullImage.getBoundingBox()
  const bounds: MapOverlayBounds =
    epsg === 4326
      ? [
          [ymin, xmin],
          [ymax, xmax],
        ]
      : (new GeoExtent([xmin, ymin, xmax, ymax], { srs: epsg }).reproj(4326).leafletBounds as MapOverlayBounds)

  return { dataUrl, bounds }
}
