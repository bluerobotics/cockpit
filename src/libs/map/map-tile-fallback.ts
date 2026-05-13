import L from 'leaflet'

const TILE_SIZE = 256

// Mid-high zoom: keeps the pattern geographically stable across zoom levels.
const REFERENCE_ZOOM = 16
const BASE_WAVELENGTH_PX = 48
const NOISE_OCTAVES = 4
const MAX_CACHE_SIZE = 512

const WATERMARK_FONT_PX = 14
const WATERMARK_HALO_PX = 3

/** Rendering options for a single noise fallback tile. */
export interface NoiseTileOptions {
  /** CSS hex color used as the base tint (e.g. '#3b3f44'). */
  baseColor: string
  /** Same seed at the same lat/lon always yields the same pattern. */
  seed: number
  /** Noise modulation in [0, 1]; 0 means flat color. */
  intensity?: number
}

export type NoiseFallbackOptionsGetter = () => NoiseTileOptions

const hashLattice = (ix: number, iy: number, seed: number): number => {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263)
  h = (h ^ seed) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t)

const valueNoise2D = (x: number, y: number, seed: number): number => {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy

  const v00 = hashLattice(ix, iy, seed)
  const v10 = hashLattice(ix + 1, iy, seed)
  const v01 = hashLattice(ix, iy + 1, seed)
  const v11 = hashLattice(ix + 1, iy + 1, seed)

  const sx = smoothstep(fx)
  const sy = smoothstep(fy)

  const top = v00 + sx * (v10 - v00)
  const bottom = v01 + sx * (v11 - v01)
  return top + sy * (bottom - top)
}

// Fractal Brownian motion: weighted sum of value-noise octaves at increasing
// frequency and decreasing amplitude.
const fbm = (x: number, y: number, seed: number): number => {
  let amplitude = 1
  let frequency = 1
  let sum = 0
  let normalization = 0
  for (let octave = 0; octave < NOISE_OCTAVES; octave++) {
    sum += amplitude * valueNoise2D(x * frequency, y * frequency, seed + octave * 131)
    normalization += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return sum / normalization
}

const parseHexColor = (hex: string): [number, number, number] => {
  // Neutral grey on malformed input.
  const fallback: [number, number, number] = [59, 63, 68]
  if (!hex) return fallback
  let h = hex.trim().replace('#', '')
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return fallback
  const n = parseInt(h, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

const PLACEHOLDER_SAMPLE_SIZE = 32

const tileCache = new Map<string, string>()

const buildCacheKey = (coords: L.Coords, options: NoiseTileOptions): string => {
  const intensity = options.intensity ?? 0.3
  return `${coords.z}/${coords.x}/${coords.y}|${options.baseColor}|${options.seed}|${intensity}`
}

/**
 * Generates a noise tile as a PNG data URL. The pattern is geographically stable:
 * adjacent tiles seam continuously and the same lat/lon yields the same noise
 * across zoom levels.
 * @param {L.Coords} coords - Tile coordinates (x, y, z).
 * @param {NoiseTileOptions} options - Tile rendering options.
 * @returns {string} A `data:image/png;base64,...` URL.
 */
export const generateNoiseTileDataUrl = (coords: L.Coords, options: NoiseTileOptions): string => {
  const cacheKey = buildCacheKey(coords, options)
  const cached = tileCache.get(cacheKey)
  if (cached !== undefined) {
    tileCache.delete(cacheKey)
    tileCache.set(cacheKey, cached)
    return cached
  }

  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d')
  if (ctx === null) return ''

  const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE)
  const buffer = imageData.data

  const [br, bg, bb] = parseHexColor(options.baseColor)
  const intensity = Math.max(0, Math.min(1, options.intensity ?? 0.3))

  // Sample in world-pixel space at REFERENCE_ZOOM so the pattern stays
  // geographically stable across zoom levels.
  const zoomDelta = REFERENCE_ZOOM - coords.z
  const refPixelsPerTilePixel = Math.pow(2, zoomDelta)
  const tileOriginX = coords.x * TILE_SIZE * refPixelsPerTilePixel
  const tileOriginY = coords.y * TILE_SIZE * refPixelsPerTilePixel
  const noiseStep = refPixelsPerTilePixel / BASE_WAVELENGTH_PX
  const startNoiseX = tileOriginX / BASE_WAVELENGTH_PX
  const startNoiseY = tileOriginY / BASE_WAVELENGTH_PX

  let row = startNoiseY
  let bufferIndex = 0
  for (let py = 0; py < TILE_SIZE; py++) {
    let col = startNoiseX
    for (let px = 0; px < TILE_SIZE; px++) {
      const n = fbm(col, row, options.seed)
      const modulation = (n - 0.5) * 2 * intensity * 255
      const r = br + modulation
      const g = bg + modulation
      const b = bb + modulation
      buffer[bufferIndex] = r < 0 ? 0 : r > 255 ? 255 : r
      buffer[bufferIndex + 1] = g < 0 ? 0 : g > 255 ? 255 : g
      buffer[bufferIndex + 2] = b < 0 ? 0 : b > 255 ? 255 : b
      buffer[bufferIndex + 3] = 255
      bufferIndex += 4
      col += noiseStep
    }
    row += noiseStep
  }

  ctx.putImageData(imageData, 0, 0)

  // Watermark so operators never mistake the procedural backdrop for real imagery.
  const luminance = (br * 0.299 + bg * 0.587 + bb * 0.114) / 255
  const isDarkBase = luminance < 0.5
  const fillCh = isDarkBase ? 235 : 25
  const haloCh = isDarkBase ? 0 : 255
  const cx = TILE_SIZE / 2
  const cy = TILE_SIZE / 2
  ctx.save()
  ctx.font = `bold ${WATERMARK_FONT_PX}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = WATERMARK_HALO_PX
  ctx.strokeStyle = `rgba(${haloCh}, ${haloCh}, ${haloCh}, 0.45)`
  ctx.strokeText('MAP DATA UNAVAILABLE', cx, cy)
  ctx.fillStyle = `rgba(${fillCh}, ${fillCh}, ${fillCh}, 0.65)`
  ctx.fillText('MAP DATA UNAVAILABLE', cx, cy)
  ctx.restore()

  const url = canvas.toDataURL('image/png')

  if (tileCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = tileCache.keys().next().value
    if (oldestKey !== undefined) tileCache.delete(oldestKey)
  }
  tileCache.set(cacheKey, url)
  return url
}

// Safety net for providers/caches that serve a "no data" image with HTTP 200
// instead of a 404 (the `?blankTile=false` URL flag handles the common case).
const looksLikeProviderPlaceholder = (img: HTMLImageElement): boolean => {
  if (!img.complete || !img.naturalWidth || !img.naturalHeight) return false

  let ctx: CanvasRenderingContext2D | null
  let data: Uint8ClampedArray
  try {
    const canvas = document.createElement('canvas')
    canvas.width = PLACEHOLDER_SAMPLE_SIZE
    canvas.height = PLACEHOLDER_SAMPLE_SIZE
    ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(img, 0, 0, PLACEHOLDER_SAMPLE_SIZE, PLACEHOLDER_SAMPLE_SIZE)
    data = ctx.getImageData(0, 0, PLACEHOLDER_SAMPLE_SIZE, PLACEHOLDER_SAMPLE_SIZE).data
  } catch {
    // Tainted canvas (provider missing CORS) — never risk flagging a real tile.
    return false
  }

  const total = PLACEHOLDER_SAMPLE_SIZE * PLACEHOLDER_SAMPLE_SIZE
  const uniqueColors = new Set<number>()
  let lightPixels = 0
  let monochromePixels = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // Quantize to 4 bits per channel so compression noise doesn't inflate the count.
    uniqueColors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4))
    const max = r > g ? (r > b ? r : b) : g > b ? g : b
    const min = r < g ? (r < b ? r : b) : g < b ? g : b
    if (max - min < 16) monochromePixels++
    if ((r + g + b) / 3 > 180) lightPixels++
  }

  const lightRatio = lightPixels / total
  const monoRatio = monochromePixels / total
  return uniqueColors.size <= 10 && lightRatio > 0.7 && monoRatio > 0.85
}

const replaceWithNoise = (tile: HTMLImageElement, coords: L.Coords, options: NoiseTileOptions): void => {
  const dataUrl = generateNoiseTileDataUrl(coords, options)
  if (!dataUrl || tile.src === dataUrl) return
  tile.dataset.cockpitFallback = '1'
  tile.src = dataUrl
  // Leaflet hides tiles without `leaflet-tile-loaded`; failed tiles never get it.
  L.DomUtil.addClass(tile, 'leaflet-tile-loaded')
}

/**
 * Attaches a procedural-noise fallback to a Leaflet tile layer. Whenever a tile
 * fails to load (or arrives as a provider-side placeholder), the broken image is
 * replaced with a generated noise tile so the operator keeps a usable,
 * motion-trackable background.
 * @param {L.TileLayer} layer - The Leaflet tile layer to augment.
 * @param {NoiseFallbackOptionsGetter} getOptions - Returns the current options;
 *   invoked per failed tile so live changes apply immediately.
 * @returns {() => void} A teardown function that removes the listeners.
 */
export const attachTileNoiseFallback = (layer: L.TileLayer, getOptions: NoiseFallbackOptionsGetter): (() => void) => {
  const onError = (event: L.TileErrorEvent): void => {
    if (!event.tile) return
    replaceWithNoise(event.tile, event.coords, getOptions())
  }
  const onLoad = (event: L.TileEvent): void => {
    const tile = event.tile
    if (!tile || tile.dataset.cockpitFallback === '1') return
    if (!looksLikeProviderPlaceholder(tile)) return
    replaceWithNoise(tile, event.coords, getOptions())
  }
  layer.on('tileerror', onError)
  layer.on('tileload', onLoad)
  return () => {
    layer.off('tileerror', onError)
    layer.off('tileload', onLoad)
  }
}

type LeafletInternalTiles = Record<
  string,
  {
    /** Tile `<img>` element on the map. */
    el: HTMLImageElement
    /** Tile grid coordinates (x, y, z). */
    coords: L.Coords
  }
>

/**
 * Re-renders the already-displayed noise-fallback tiles on a layer with the
 * latest options, so user tweaks apply without waiting for a pan/zoom refetch.
 * @param {L.TileLayer} layer - The tile layer to refresh.
 * @param {NoiseTileOptions} options - The new options to apply.
 * @returns {void}
 */
export const refreshNoiseFallbackTiles = (layer: L.TileLayer, options: NoiseTileOptions): void => {
  const internalLayer = layer as unknown as {
    /** Leaflet's private cache of currently-managed tiles. */
    _tiles?: LeafletInternalTiles
  }
  const tiles = internalLayer._tiles
  if (!tiles) return
  for (const entry of Object.values(tiles)) {
    if (entry.el?.dataset?.cockpitFallback !== '1') continue
    entry.el.src = generateNoiseTileDataUrl(entry.coords, options)
  }
}

/**
 * Builds a per-session seed so each app launch shows a different noise pattern
 * (avoids users mistaking a stable pattern for real data).
 * @returns {number} A 32-bit unsigned integer seed.
 */
export const generateSessionSeed = (): number => {
  const monotonic = typeof performance !== 'undefined' ? performance.now() : 0
  return (Date.now() ^ Math.floor(monotonic * 1000)) >>> 0 || 1
}
