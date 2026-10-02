import type { LngLat, Map as MapLibreMap } from 'maplibre-gl'

import { fromMapLibreZoom } from '@/libs/map/maplibre'
import type { ScreenPoint } from '@/libs/map/survey-polygon-edges'
import type { BaseStationConfig } from '@/types/baseStation'

// Slider 0% → blob radius is 5% of the cell range, slider 100% → full range. Linear blend
// between the two so the slider has visible effect at every zoom level.
const OPENCELLID_HEATMAP_MIN_RADIUS_FRACTION = 0.05
// Per-cell peak alpha contributed at the gradient center. Two cells overlapping at full alpha
// reach 1.0 thanks to the `lighter` compositing — this is what surfaces the warm hotspot tail
// of the gradient when several towers cover the same patch.
const OPENCELLID_HEATMAP_PEAK_ALPHA = 0.55
// Cool-to-warm gradient stops mapped from per-pixel density (0..1). A single cell tops out
// around mid-gradient (cyan/green); two cells overlapping bleed into yellow; three or more
// reach the red hotspot range.
const OPENCELLID_HEATMAP_GRADIENT_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0.0, 'rgba(0, 0, 255, 0)'],
  [0.05, 'rgba(0, 80, 255, 0.4)'],
  [0.2, 'rgba(0, 140, 255, 0.65)'],
  [0.4, 'rgba(0, 230, 220, 0.8)'],
  [0.6, 'rgba(60, 220, 80, 0.85)'],
  [0.8, 'rgba(255, 220, 0, 0.9)'],
  [1.0, 'rgba(255, 40, 0, 0.95)'],
]
const EARTH_CIRCUMFERENCE_M = 40075016.686
const TILE_SIZE_PX = 256

/* eslint-disable jsdoc/require-jsdoc -- helper return shapes; their property names are self-describing. */
export type HeatmapSite = { lat: number; lon: number; rangeMeters: number }
export type CellIdHeatLayerOptions = { sites: HeatmapSite[]; radiusFraction: number; opacity: number }
/* eslint-enable jsdoc/require-jsdoc */

/**
 * A heatmap drawn over a map, and the way to take it off.
 */
export interface CellIdHeatLayerInstance {
  /** Draws the heatmap over the map and keeps it aligned with the view. */
  addTo: (map: MapLibreMap) => CellIdHeatLayerInstance
  /** Removes the heatmap and its listeners. */
  remove: () => void
}

let cachedHeatGradientLut: Uint8ClampedArray | null = null
const heatmapGradientLut = (): Uint8ClampedArray => {
  if (cachedHeatGradientLut) return cachedHeatGradientLut
  const lutCanvas = document.createElement('canvas')
  lutCanvas.width = 1
  lutCanvas.height = 256
  const ctx = lutCanvas.getContext('2d')
  if (!ctx) throw new Error('Heatmap LUT: 2D canvas context unavailable')
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  OPENCELLID_HEATMAP_GRADIENT_STOPS.forEach(([stop, color]) => grad.addColorStop(stop, color))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 1, 256)
  cachedHeatGradientLut = ctx.getImageData(0, 0, 1, 256).data
  return cachedHeatGradientLut
}

const metersPerPixelAt = (mapInstance: MapLibreMap, lat: number): number => {
  const pixelsAcrossEquator = TILE_SIZE_PX * 2 ** fromMapLibreZoom(mapInstance.getZoom())
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / pixelsAcrossEquator
}

/** A coordinate and the container point it was drawn at. */
interface PanOrigin {
  /** The coordinate. */
  lngLat: LngLat
  /** Where it was drawn, in container pixels. */
  point: ScreenPoint
}

/**
 * Renders the OpenCellID heatmap on a single canvas laid over the map, with cumulative alpha mapped to a
 * cool-to-warm color ramp. Built to replace the (uninstalled) `leaflet.heat` plugin so we can keep per-cell radius,
 * eliminate canvas-edge clipping, and apply layer opacity once without it bleeding into the color ramp.
 */
class CellIdHeatLayer implements CellIdHeatLayerInstance {
  private map?: MapLibreMap
  private canvas?: HTMLCanvasElement
  private frame?: number
  // Where the view center was drawn when the current move started, so a pan can slide the canvas along.
  private panOrigin?: PanOrigin
  private zooming = false
  private resizeTimer?: ReturnType<typeof setTimeout>
  private resizePending = false
  private readonly onMoveStart = (): void => {
    if (!this.map) return
    const lngLat = this.map.getCenter()
    this.panOrigin = { lngLat, point: this.map.project(lngLat) }
  }
  // A pan slides the drawn heatmap along instead of redrawing it, which waits for the end of the move.
  private readonly onMove = (): void => {
    if (!this.map || !this.canvas || !this.panOrigin || this.zooming) return
    const point = this.map.project(this.panOrigin.lngLat)
    this.canvas.style.transform = `translate(${point.x - this.panOrigin.point.x}px, ${
      point.y - this.panOrigin.point.y
    }px)`
  }
  // A zoom rescales every blob, so no translation keeps it aligned; it stays hidden until the move ends.
  private readonly onZoomStart = (): void => {
    this.zooming = true
    if (this.canvas) this.canvas.style.visibility = 'hidden'
  }
  private readonly onMoveEnd = (): void => this.reset()
  // Resets at once, then at most once per 200ms while resizes keep coming, finishing on the last one.
  private readonly onResize = (): void => {
    if (this.resizeTimer !== undefined) {
      this.resizePending = true
      return
    }
    this.reset()
    const settle = (): void => {
      this.resizeTimer = undefined
      if (!this.resizePending) return
      this.resizePending = false
      this.onResize()
    }
    this.resizeTimer = setTimeout(settle, 200)
  }

  /**
   * Prepares a heatmap for the given sites, drawn once it is added to a map.
   * @param {CellIdHeatLayerOptions} options - The sites, blob size and opacity.
   */
  constructor(private readonly options: CellIdHeatLayerOptions) {}

  /**
   * Draws the heatmap over the map and keeps it aligned with the view.
   * @param {MapLibreMap} mapInstance - The map to draw over.
   * @returns {this} The heatmap.
   */
  addTo(mapInstance: MapLibreMap): this {
    this.map = mapInstance
    const canvas = document.createElement('canvas')
    canvas.className = 'cockpit-cellid-heat-layer'
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.opacity = String(this.options.opacity)
    this.canvas = canvas
    // Right above the map drawing and below the markers, which share its container.
    const container = mapInstance.getCanvasContainer()
    container.insertBefore(canvas, mapInstance.getCanvas().nextSibling)
    mapInstance.on('movestart', this.onMoveStart)
    mapInstance.on('move', this.onMove)
    mapInstance.on('zoomstart', this.onZoomStart)
    mapInstance.on('moveend', this.onMoveEnd)
    // A container resize arrives once per frame while the map widget is being dragged to a new size,
    // so that one event is throttled instead of sweeping the whole canvas on every frame.
    mapInstance.on('resize', this.onResize)
    this.reset()
    return this
  }

  /**
   * Removes the heatmap and its listeners.
   */
  remove(): void {
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame)
      this.frame = undefined
    }
    if (this.resizeTimer !== undefined) clearTimeout(this.resizeTimer)
    this.resizeTimer = undefined
    this.resizePending = false
    this.canvas?.remove()
    this.canvas = undefined
    if (this.map) {
      this.map.off('movestart', this.onMoveStart)
      this.map.off('move', this.onMove)
      this.map.off('zoomstart', this.onZoomStart)
      this.map.off('moveend', this.onMoveEnd)
      this.map.off('resize', this.onResize)
    }
    this.map = undefined
  }

  /**
   * Re-fits the canvas to the map container and redraws it for the current view.
   */
  private reset(): void {
    if (!this.map || !this.canvas) return
    this.panOrigin = undefined
    this.zooming = false
    this.canvas.style.transform = ''
    this.canvas.style.visibility = ''
    const container = this.map.getContainer()
    if (this.canvas.width !== container.clientWidth) this.canvas.width = container.clientWidth
    if (this.canvas.height !== container.clientHeight) this.canvas.height = container.clientHeight
    this.scheduleRedraw()
  }

  /**
   * Queues one redraw for the next frame.
   */
  private scheduleRedraw(): void {
    // Coalesce the costly full-canvas getImageData/putImageData sweep to one run per frame so a
    // burst of pan/zoom events doesn't repaint every pixel multiple times in the same frame.
    if (this.frame !== undefined) cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined
      this.redraw()
    })
  }

  /**
   * Draws the heatmap for the current view.
   */
  private redraw(): void {
    if (!this.map || !this.canvas) return
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    const size = { x: this.canvas.width, y: this.canvas.height }
    ctx.clearRect(0, 0, size.x, size.y)
    if (this.options.sites.length === 0) return
    // Stage 1: accumulate per-cell radial gradients on the alpha channel. Using `lighter`
    // makes overlapping cells brighten cumulatively → density per pixel.
    ctx.globalCompositeOperation = 'lighter'
    const mpp = metersPerPixelAt(this.map, this.map.getCenter().lat)
    // Union of the rects the gradients cover, so stage 2 walks only those pixels: cells usually
    // occupy a fraction of the viewport, and the rest of it is transparent either way.
    let dirtyLeft = size.x
    let dirtyTop = size.y
    let dirtyRight = 0
    let dirtyBottom = 0
    this.options.sites.forEach((site) => {
      const center = this.map!.project([site.lon, site.lat])
      const radiusPx = Math.max(2, (site.rangeMeters * this.options.radiusFraction) / mpp)
      if (
        center.x + radiusPx < 0 ||
        center.x - radiusPx > size.x ||
        center.y + radiusPx < 0 ||
        center.y - radiusPx > size.y
      ) {
        return
      }
      const radial = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radiusPx)
      radial.addColorStop(0, `rgba(255,255,255,${OPENCELLID_HEATMAP_PEAK_ALPHA})`)
      radial.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = radial
      ctx.fillRect(center.x - radiusPx, center.y - radiusPx, 2 * radiusPx, 2 * radiusPx)
      dirtyLeft = Math.min(dirtyLeft, Math.max(0, Math.floor(center.x - radiusPx)))
      dirtyTop = Math.min(dirtyTop, Math.max(0, Math.floor(center.y - radiusPx)))
      dirtyRight = Math.max(dirtyRight, Math.min(size.x, Math.ceil(center.x + radiusPx)))
      dirtyBottom = Math.max(dirtyBottom, Math.min(size.y, Math.ceil(center.y + radiusPx)))
    })
    if (dirtyRight <= dirtyLeft || dirtyBottom <= dirtyTop) return
    // Stage 2: remap each pixel's alpha through the cool→warm gradient LUT so density turns
    // into color. The LUT also dictates the final pixel alpha so the natural radial fade is
    // preserved while hotspots get punchier.
    const lut = heatmapGradientLut()
    const img = ctx.getImageData(dirtyLeft, dirtyTop, dirtyRight - dirtyLeft, dirtyBottom - dirtyTop)
    const data = img.data
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      if (a === 0) continue
      const lutIdx = a * 4
      data[i] = lut[lutIdx]
      data[i + 1] = lut[lutIdx + 1]
      data[i + 2] = lut[lutIdx + 2]
      data[i + 3] = lut[lutIdx + 3]
    }
    ctx.putImageData(img, dirtyLeft, dirtyTop)
  }
}

/**
 * Instantiate a {@link CellIdHeatLayer}.
 * @param {CellIdHeatLayerOptions} options Layer options.
 * @returns {CellIdHeatLayerInstance} The heatmap, ready to add to a map.
 */
export const createCellIdHeatLayer = (options: CellIdHeatLayerOptions): CellIdHeatLayerInstance =>
  new CellIdHeatLayer(options)

/**
 * Resolve the heatmap radius fraction for the active config + intensity boost.
 * @param {BaseStationConfig} config Base station configuration.
 * @param {number} intensityBoost Multiplier applied to `heatmapIntensity` before blending.
 * @returns {number} Radius fraction in [{@link OPENCELLID_HEATMAP_MIN_RADIUS_FRACTION}, 1].
 */
export const mobileHeatmapRadiusFraction = (config: BaseStationConfig, intensityBoost = 1): number =>
  OPENCELLID_HEATMAP_MIN_RADIUS_FRACTION +
  Math.max(0, Math.min(1, config.mobileCoverage.heatmapIntensity * intensityBoost)) *
    (1 - OPENCELLID_HEATMAP_MIN_RADIUS_FRACTION)
