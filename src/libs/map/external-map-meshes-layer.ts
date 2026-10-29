import L from 'leaflet'

import { earthRadius } from '@/libs/map/external-map-mesh-layout'
import {
  type MapMesh,
  type MapMeshChange,
  type MapMeshStore,
  type MercatorBounds,
} from '@/libs/map/external-map-meshes'
import type { MapMeshGlRenderer } from '@/libs/map/external-map-meshes-gl'

// Drawn past the view by this fraction of its size on every side, so pans within it move the canvas, not redraw it.
const viewPadding = 0.25

// Highest device pixel ratio meshes are drawn at: sensor data is rarely finer than a CSS pixel, and a padded canvas
// at a ratio of 2 holds four times the pixels.
const maxMeshPixelRatio = 1

const earthCircumference = 2 * Math.PI * earthRadius

/**
 * What an {@link ExternalMapMeshesLayer} draws, and with what
 */
export interface ExternalMapMeshesLayerOptions {
  /**
   * The meshes
   */
  store: MapMeshStore
  /**
   * The shared renderer, or undefined where it cannot be created
   */
  renderer: () => MapMeshGlRenderer | undefined
  /**
   * Called for each mesh that cannot be drawn, every time the map tries to
   */
  onUnsupported: (mesh: MapMesh) => void
  /**
   * Pane holding the canvas
   */
  pane: string
}

const intersects = (a: MercatorBounds, b: MercatorBounds): boolean =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY

/**
 * Transparency range [hideBelow, opaqueAbove] every map starts with. With a sonar palette whose alpha is its index
 * over 255, it hides blue (about 0.25) and draws copper (0.5), yellow (0.75) and white solid.
 */
export const defaultMeshAlphaCurve: readonly [number, number] = [0.25, 0.5]

/**
 * A map's transparency range as the renderer takes it
 * @param {unknown} curve - [hideBelow, opaqueAbove]; each is clamped to 0..1
 * @returns {[number, number]} A new range, or a copy of {@link defaultMeshAlphaCurve} when `curve` is not a pair of
 * finite numbers
 */
export const normalizeMeshAlphaCurve = (curve: unknown): [number, number] => {
  if (!Array.isArray(curve) || curve.length !== 2 || !curve.every(Number.isFinite)) return [...defaultMeshAlphaCurve]
  const [hideBelow, opaqueAbove] = curve.map((value: number) => Math.min(Math.max(value, 0), 1))
  return [hideBelow, opaqueAbove]
}

/**
 * Leaflet layer drawing the map meshes of a {@link MapMeshStore} on one canvas, padded past the view. Every draw
 * is a full redraw, made when the meshes change in view (once per frame), when a pan leaves the padding, when the
 * zoom or size changes, when the map's transparency range changes, and when the map becomes shown. Zooms scale the
 * last drawing until they end.
 */
export class ExternalMapMeshesLayer extends L.Layer {
  private canvas?: HTMLCanvasElement
  private leafletMap?: L.Map
  private stopListening?: () => void
  private frame?: number
  private shown = false
  private zooming = false
  private drawnTopLeft?: L.Point
  private drawnPadding = L.point(0, 0)
  private drawnOrigin?: L.LatLng
  private drawnZoom = 0
  private drawnBounds?: MercatorBounds
  private alphaCurve = defaultMeshAlphaCurve

  /**
   * @param {ExternalMapMeshesLayerOptions} config - What to draw, and with what
   */
  constructor(private readonly config: ExternalMapMeshesLayerOptions) {
    super()
  }

  /* eslint-disable jsdoc/require-jsdoc -- Leaflet layer lifecycle methods. */
  onAdd(map: L.Map): this {
    this.leafletMap = map
    this.canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated')
    this.canvas.style.pointerEvents = 'none'
    map.getPane(this.config.pane)?.appendChild(this.canvas)
    this.stopListening = this.config.store.subscribe((change) => this.onChange(change))
    this.redraw()
    return this
  }

  onRemove(): this {
    this.stopListening?.()
    if (this.frame !== undefined) cancelAnimationFrame(this.frame)
    this.frame = undefined
    this.canvas?.remove()
    this.canvas = undefined
    this.leafletMap = undefined
    // When added again, it starts on a blank canvas, and it will never see the end of a zoom that was in progress when
    // it was removed.
    this.zooming = false
    return this
  }

  getEvents(): Record<string, L.LeafletEventHandlerFn> {
    return {
      moveend: this.onMoveEnd,
      viewreset: this.redraw,
      resize: this.redraw,
      zoomstart: this.onZoomStart,
      zoomend: this.onZoomEnd,
      zoom: this.onZoom,
      zoomanim: this.onZoomAnimation as L.LeafletEventHandlerFn,
    }
  }
  /* eslint-enable jsdoc/require-jsdoc */

  /**
   * Redraws the meshes on the next frame, once, however many times it is called before then
   */
  redraw(): void {
    if (this.frame !== undefined || !this.leafletMap || !this.shown) return
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined
      // A zoom in progress scales the last drawing instead, and its end draws again.
      if (!this.zooming && this.shown) this.draw()
    })
  }

  /**
   * Sets this map's transparency range, which the renderer applies before each mesh's own opacity, and redraws on the
   * next frame if it changed
   * @param {[number, number]} curve - [hideBelow, opaqueAbove], as {@link normalizeMeshAlphaCurve} takes it
   */
  setMapAlphaCurve(curve: readonly [number, number]): void {
    const [hideBelow, opaqueAbove] = normalizeMeshAlphaCurve(curve)
    if (hideBelow === this.alphaCurve[0] && opaqueAbove === this.alphaCurve[1]) return
    this.alphaCurve = [hideBelow, opaqueAbove]
    this.redraw()
  }

  /**
   * Sets whether the map is shown, as a map hidden behind another view draws nothing and releases its canvas. Kept
   * while the layer is removed, so it draws when added again.
   * @param {boolean} shown - Whether the map is shown
   */
  setShown(shown: boolean): void {
    if (shown === this.shown) return
    this.shown = shown
    if (shown) {
      this.redraw()
      return
    }
    if (this.frame !== undefined) cancelAnimationFrame(this.frame)
    this.frame = undefined
    this.releaseCanvas()
  }

  /* eslint-disable jsdoc/require-jsdoc -- private helpers, commented where they need it. */
  private releaseCanvas(): void {
    if (!this.canvas) return
    this.canvas.width = 0
    this.canvas.height = 0
    this.drawnTopLeft = undefined
    this.drawnBounds = undefined
  }

  private onChange(change: MapMeshChange): void {
    if (change.bounds && this.drawnBounds && !intersects(change.bounds, this.drawnBounds)) return
    this.redraw()
  }

  // Redraws once the view drifts half its padding from where it was drawn, before a pan can show an undrawn edge.
  private onMoveEnd(): void {
    const map = this.leafletMap
    if (!map || !this.drawnTopLeft) return this.redraw()
    const drift = map.containerPointToLayerPoint([0, 0]).subtract(this.drawnTopLeft).subtract(this.drawnPadding)
    if (Math.abs(drift.x) > this.drawnPadding.x / 2 || Math.abs(drift.y) > this.drawnPadding.y / 2) this.redraw()
  }

  private onZoomStart(): void {
    this.zooming = true
  }

  private onZoomEnd(): void {
    this.zooming = false
    this.redraw()
  }

  // Pinch zooms move the map without a zoom animation, so the last drawing follows them here.
  private onZoom(): void {
    if (this.leafletMap) this.scaleTo(this.leafletMap.getCenter(), this.leafletMap.getZoom())
  }

  private onZoomAnimation(event: L.ZoomAnimEvent): void {
    this.scaleTo(event.center, event.zoom)
  }

  // Scales and moves the last drawing to where a view at that center and zoom shows it, as Leaflet does with its
  // own image overlays, until the zoom ends and the meshes are drawn again.
  private scaleTo(center: L.LatLng, zoom: number): void {
    const map = this.leafletMap
    if (!map || !this.canvas || !this.drawnOrigin) return
    const mapPanePosition = L.DomUtil.getPosition(map.getPane('mapPane') as HTMLElement)
    const pixelOrigin = map.project(center, zoom).subtract(map.getSize().divideBy(2)).add(mapPanePosition).round()
    const offset = map.project(this.drawnOrigin, zoom).subtract(pixelOrigin)
    L.DomUtil.setTransform(this.canvas, offset, map.getZoomScale(zoom, this.drawnZoom))
  }

  private draw(): void {
    const map = this.leafletMap
    const canvas = this.canvas
    const context = canvas?.getContext('2d')
    if (!map || !canvas || !context) return

    const size = map.getSize()
    const padding = size.multiplyBy(viewPadding).round()
    const topLeft = map.containerPointToLayerPoint(padding.multiplyBy(-1)).round()
    const cssSize = size.add(padding.multiplyBy(2))
    L.DomUtil.setPosition(canvas, topLeft)
    this.drawnTopLeft = topLeft
    this.drawnPadding = padding
    this.drawnOrigin = map.layerPointToLatLng(topLeft)
    this.drawnZoom = map.getZoom()

    // The canvas' top-left corner in EPSG:3857 meters, from the map's own pixel origin rather than through a LatLng.
    const worldPixels = (map.options.crs ?? L.CRS.EPSG3857).scale(this.drawnZoom)
    const metresPerCssPixel = earthCircumference / worldPixels
    const absoluteTopLeft = map.getPixelOrigin().add(topLeft)
    const originX = (absoluteTopLeft.x / worldPixels - 0.5) * earthCircumference
    const originY = (0.5 - absoluteTopLeft.y / worldPixels) * earthCircumference
    this.drawnBounds = {
      minX: originX,
      minY: originY - cssSize.y * metresPerCssPixel,
      maxX: originX + cssSize.x * metresPerCssPixel,
      maxY: originY,
    }

    // ponytail: every draw walks all meshes and renders and composites each drawn one over the whole view, even when
    // only one changed, so it grows with the mesh count; skipping off-screen meshes and bounding composites is the fix.
    const meshes = [...this.config.store.meshes.values()].filter((mesh) => mesh.highWater > 0 && mesh.opacity > 0)
    const renderer = meshes.length > 0 ? this.config.renderer() : undefined
    if (!renderer) {
      meshes.forEach((mesh) => this.config.onUnsupported(mesh))
      // Nothing to draw, so the canvas holds no memory until there is.
      canvas.width = 0
      canvas.height = 0
      return
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxMeshPixelRatio)
    const width = Math.round(cssSize.x * pixelRatio)
    const height = Math.round(cssSize.y * pixelRatio)
    canvas.style.width = `${cssSize.x}px`
    canvas.style.height = `${cssSize.y}px`
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    context.clearRect(0, 0, width, height)
    const view = { width, height, originX, originY, metresPerPixel: metresPerCssPixel / pixelRatio }
    for (const mesh of meshes) {
      if (!renderer.render(mesh, view, this.alphaCurve)) continue
      context.globalAlpha = mesh.opacity
      const source = renderer.canvas
      context.drawImage(source, 0, source.height - height, width, height, 0, 0, width, height)
    }
    context.globalAlpha = 1
  }
  /* eslint-enable jsdoc/require-jsdoc */
}
