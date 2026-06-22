import L from 'leaflet'

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
export type CellIdHeatLayerInstance = L.Layer
/* eslint-enable jsdoc/require-jsdoc */

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

const metersPerPixelAt = (mapInstance: L.Map, lat: number): number => {
  const pixelsAcrossEquator = TILE_SIZE_PX * 2 ** mapInstance.getZoom()
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / pixelsAcrossEquator
}

/* eslint-disable jsdoc/require-jsdoc -- internal layer fields, kept private to this module. */
type CellIdHeatLayerInternal = L.Layer & {
  _map?: L.Map
  _canvas?: HTMLCanvasElement
  _heatOptions: CellIdHeatLayerOptions
  _reset: () => void
  _redraw: () => void
}
/* eslint-enable jsdoc/require-jsdoc */

// Custom Leaflet layer that renders the OpenCellID heatmap on a single canvas, with cumulative
// alpha → cool-to-warm color mapping. Built to replace the (uninstalled) `leaflet.heat` plugin
// so we can keep per-cell radius, eliminate canvas-edge clipping, and apply layer opacity once
// without it bleeding into the color ramp.
const CellIdHeatLayer = L.Layer.extend({
  /* eslint-disable jsdoc/require-jsdoc -- Leaflet layer prototype methods, not exported API. */
  initialize(this: CellIdHeatLayerInternal, options: CellIdHeatLayerOptions) {
    this._heatOptions = { ...options }
  },
  onAdd(this: CellIdHeatLayerInternal, mapInstance: L.Map) {
    this._map = mapInstance
    const canvas = L.DomUtil.create('canvas', 'leaflet-cellid-heat-layer leaflet-zoom-hide')
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.opacity = String(this._heatOptions.opacity)
    this._canvas = canvas
    mapInstance.getPanes().overlayPane.appendChild(canvas)
    mapInstance.on('moveend resize viewreset zoomend', this._reset, this)
    this._reset()
    return this
  },
  onRemove(this: CellIdHeatLayerInternal, mapInstance: L.Map) {
    mapInstance.getPanes().overlayPane.removeChild(this._canvas!)
    mapInstance.off('moveend resize viewreset zoomend', this._reset, this)
    this._canvas = undefined
    this._map = undefined
    return this
  },
  _reset(this: CellIdHeatLayerInternal) {
    if (!this._map || !this._canvas) return
    const topLeft = this._map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this._canvas, topLeft)
    const size = this._map.getSize()
    if (this._canvas.width !== size.x) this._canvas.width = size.x
    if (this._canvas.height !== size.y) this._canvas.height = size.y
    this._redraw()
  },
  _redraw(this: CellIdHeatLayerInternal) {
    if (!this._map || !this._canvas) return
    const ctx = this._canvas.getContext('2d')
    if (!ctx) return
    const size = this._map.getSize()
    ctx.clearRect(0, 0, size.x, size.y)
    if (this._heatOptions.sites.length === 0) return
    // Stage 1: accumulate per-cell radial gradients on the alpha channel. Using `lighter`
    // makes overlapping cells brighten cumulatively → density per pixel.
    ctx.globalCompositeOperation = 'lighter'
    const mpp = metersPerPixelAt(this._map, this._map.getCenter().lat)
    this._heatOptions.sites.forEach((site) => {
      const center = this._map!.latLngToContainerPoint([site.lat, site.lon])
      const radiusPx = Math.max(2, (site.rangeMeters * this._heatOptions.radiusFraction) / mpp)
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
    })
    // Stage 2: remap each pixel's alpha through the cool→warm gradient LUT so density turns
    // into color. The LUT also dictates the final pixel alpha so the natural radial fade is
    // preserved while hotspots get punchier.
    const lut = heatmapGradientLut()
    const img = ctx.getImageData(0, 0, size.x, size.y)
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
    ctx.putImageData(img, 0, 0)
  },
  /* eslint-enable jsdoc/require-jsdoc */
})

/**
 * Instantiate a {@link CellIdHeatLayer}.
 * @param {CellIdHeatLayerOptions} options Layer options.
 * @returns {CellIdHeatLayerInstance} Leaflet layer instance.
 */
export const createCellIdHeatLayer = (options: CellIdHeatLayerOptions): CellIdHeatLayerInstance => {
  const Ctor = CellIdHeatLayer as unknown as new (opts: CellIdHeatLayerOptions) => CellIdHeatLayerInstance
  return new Ctor(options)
}

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
