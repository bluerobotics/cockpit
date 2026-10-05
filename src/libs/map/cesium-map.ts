import {
  type ImageryProvider,
  CameraEventType,
  Cartesian2,
  Cartesian3,
  Cartographic,
  CesiumWidget,
  Color,
  Ellipsoid,
  EllipsoidTerrainProvider,
  ImageryLayer,
  MapMode2D,
  Math as CesiumMath,
  SceneMode,
  SceneTransforms,
  ScreenSpaceEventType,
  WebMercatorProjection,
} from 'cesium'

import { attributionControl } from '@/libs/map/cesium-controls'
import type { MapMarker } from '@/libs/map/cesium-marker'
import { type VectorFeature, VectorLayer } from '@/libs/map/cesium-vectors'
import { type MapLayerSlot, mapLayerSlots } from '@/libs/map/map-slots'
import type { ScreenPoint } from '@/libs/map/survey-polygon-edges'
import type { WaypointCoordinates } from '@/types/mission'

export { type MapLayerSlot, mapLayerSlots, slotHeight } from '@/libs/map/map-slots'

// Cesium fetches its workers, textures and third-party code from here; the build serves them at `cesium/`.
;(window as unknown as Record<string, string>).CESIUM_BASE_URL ??= new URL('cesium/', document.baseURI).href

const earthRadius = 6378137
const earthCircumference = 2 * Math.PI * earthRadius
const tileSize = 256
const projection = new WebMercatorProjection()

/**
 * Lowest and highest zooms on the tile scale, as Leaflet allowed them.
 */
export const mapZoomLimits = { min: 0, max: 23 } as const

/**
 * Projected meters a canvas width spans at a tile-scale zoom. Zoom levels keep their Leaflet meaning everywhere in
 * Cockpit (one level halves the scale, level 0 fits the world in one 256-pixel tile), and Cesium's 2D camera reasons in
 * frustum widths, so this is the one conversion between the two.
 * @param {number} zoom - Zoom on the 256-pixel tile scale.
 * @param {number} widthPixels - Canvas width, in CSS pixels.
 * @returns {number} The frustum width, in Web Mercator meters.
 */
export const frustumWidthForZoom = (zoom: number, widthPixels: number): number =>
  (widthPixels * earthCircumference) / (tileSize * 2 ** zoom)

/**
 * The tile-scale zoom at which a canvas width spans a frustum width, the inverse of {@link frustumWidthForZoom}.
 * @param {number} frustumWidth - The frustum width, in Web Mercator meters.
 * @param {number} widthPixels - Canvas width, in CSS pixels.
 * @returns {number} The zoom on the 256-pixel tile scale.
 */
export const zoomForFrustumWidth = (frustumWidth: number, widthPixels: number): number =>
  Math.log2((widthPixels * earthCircumference) / (tileSize * frustumWidth))

/**
 * Projects a coordinate to Web Mercator meters, the plane Cesium's 2D camera moves in.
 * @param {WaypointCoordinates} coordinates - The `[latitude, longitude]` to project.
 * @returns {Cartesian3} Easting in `x` and northing in `y`.
 */
export const toMercator = (coordinates: WaypointCoordinates): Cartesian3 =>
  projection.project(Cartographic.fromDegrees(coordinates[1], coordinates[0]))

/**
 * Unprojects Web Mercator meters to a coordinate, the inverse of {@link toMercator}.
 * @param {number} x - Easting, in meters.
 * @param {number} y - Northing, in meters.
 * @returns {WaypointCoordinates} The `[latitude, longitude]`.
 */
export const fromMercator = (x: number, y: number): WaypointCoordinates => {
  const cartographic = projection.unproject(new Cartesian3(x, y, 0))
  return [CesiumMath.toDegrees(cartographic.latitude), CesiumMath.toDegrees(cartographic.longitude)]
}

/**
 * Bounds covering every coordinate, as `[[south, west], [north, east]]`.
 * @param {WaypointCoordinates[]} coordinates - The `[latitude, longitude]` pairs to cover; must not be empty.
 * @returns {[WaypointCoordinates, WaypointCoordinates]} The covering bounds.
 */
export const boundsOf = (coordinates: WaypointCoordinates[]): [WaypointCoordinates, WaypointCoordinates] => {
  const lats = coordinates.map((c) => c[0])
  const lngs = coordinates.map((c) => c[1])
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ]
}

/** A map bounds in Cockpit's terms, also exposing its edges the way Leaflet's bounds did. */
export interface MapBounds {
  /** Northern edge, in degrees. */
  getNorth: () => number
  /** Southern edge, in degrees. */
  getSouth: () => number
  /** Eastern edge, in degrees. */
  getEast: () => number
  /** Western edge, in degrees. */
  getWest: () => number
  /** The bounds as `[[south, west], [north, east]]`. */
  toArray: () => [WaypointCoordinates, WaypointCoordinates]
}

/** Names of the pointer events the map raises. */
export type MapPointerEventType =
  | 'click'
  | 'dblclick'
  | 'contextmenu'
  | 'mousemove'
  | 'mousedown'
  | 'mouseup'
  | 'mouseout'

/** Names of the layer-scoped events the map raises. */
export type MapLayerEventType = 'click' | 'dblclick' | 'contextmenu' | 'mousedown' | 'mouseenter' | 'mouseleave'

/** Names of the view events the map raises. */
export type MapViewEventType =
  | 'load'
  | 'movestart'
  | 'move'
  | 'moveend'
  | 'zoomstart'
  | 'zoom'
  | 'zoomend'
  | 'dragstart'
  | 'drag'
  | 'dragend'
  | 'resize'
  | 'layers'
  | 'remove'

/** A feature of a vector layer, as a layer-scoped event reports it. */
export interface MapFeature {
  /** Id of the layer the feature belongs to. */
  layerId: string
  /** Properties the feature was drawn with. */
  properties: Record<string, unknown>
}

/**
 * A pointer event on the map, in Cockpit's terms. A handler that claims the event calls `preventDefault`, and later
 * handlers (the map's own double-click zoom included) check `defaultPrevented`.
 */
export class MapPointerEvent {
  defaultPrevented = false
  /** The feature under the pointer, for a layer-scoped event. */
  feature?: MapFeature

  /**
   * Describes a pointer event.
   * @param {string} type - The event name.
   * @param {WaypointCoordinates} latLng - The `[latitude, longitude]` under the pointer.
   * @param {ScreenPoint} point - The pointer position relative to the map container, in pixels.
   * @param {MouseEvent} originalEvent - The DOM event behind it.
   */
  constructor(
    readonly type: string,
    readonly latLng: WaypointCoordinates,
    readonly point: ScreenPoint,
    readonly originalEvent: MouseEvent
  ) {}

  /** Marks the event as handled. */
  preventDefault(): void {
    this.defaultPrevented = true
  }
}

/** A view event, carrying the DOM event behind it when there is one. */
export interface MapViewEvent {
  /** The event name. */
  type: MapViewEventType
  /** The DOM event that caused it, for gestures. */
  originalEvent?: Event
}

type PointerHandler = (event: MapPointerEvent) => void
type ViewHandler = (event: MapViewEvent) => void

/** An interaction the map can turn on and off, the way Leaflet exposed its handlers. */
export interface MapInteraction {
  /** Turns the interaction on. */
  enable: (options?: { /** What zooming keeps fixed. */ around?: 'center' }) => void
  /** Turns the interaction off. */
  disable: () => void
  /** Whether the interaction is on. */
  isEnabled: () => boolean
}

/** Options for {@link CockpitMap.easeTo}. */
export interface EaseToOptions {
  /** The `[latitude, longitude]` to center on. Defaults to keeping the center (or the `around` point) fixed. */
  center?: WaypointCoordinates
  /** The tile-scale zoom to end on. Defaults to the current zoom. */
  zoom?: number
  /** A coordinate kept at the same screen position while zooming. */
  around?: WaypointCoordinates
  /** Animation length, in milliseconds. Zero jumps. */
  duration?: number
}

/** Options for {@link CockpitMap.fitBounds}. */
export interface FitBoundsOptions {
  /** Space kept free around the bounds, in pixels. */
  padding?: number
  /** Highest tile-scale zoom to land on. */
  maxZoom?: number
  /** Whether to animate the move. */
  animate?: boolean
}

/** Options for {@link createMap}. */
export interface CreateMapOptions {
  /** Initial center, as `[latitude, longitude]`. */
  center: WaypointCoordinates
  /** Initial zoom, on the tile scale. */
  zoom: number
  /** Whether to show the attribution of the visible layers. */
  attribution?: boolean
  /** Whether the map can turn, for maps that follow a heading. Others stay north-up. */
  rotatable?: boolean
}

/** Options for {@link CockpitMap.addImagery}. */
export interface ImageryOptions {
  /** Whether the layer starts visible. */
  visible?: boolean
  /** Opacity, from 0 to 1. */
  opacity?: number
  /** Shallowest tile-scale zoom the layer shows at. */
  minZoom?: number
  /** Deepest tile-scale zoom the layer shows at. */
  maxZoom?: number
  /** Attribution shown while the layer is visible. */
  attribution?: string
}

/**
 * Scene settings Cesium reads but leaves out of its typings.
 */
interface SceneInternals {
  /** How long, in milliseconds, the camera has to stay still before `moveEnd` is raised. */
  cameraEventWaitTime: number
}

/**
 * Imagery drawn on the map, with what is needed to rebuild it with another provider.
 */
interface ImageryEntry {
  /** The Cesium layer drawing the imagery. */
  layer: ImageryLayer
  /** The slot it stacks in. */
  slot: MapLayerSlot
  /** How it was added, kept to rebuild it with another provider. */
  options: ImageryOptions
}

/** A corner of the map where controls stack. */
export type MapControlCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

// A press that moves farther than this is a drag, not a click, as in Leaflet.
const clickTolerancePixels = 3
// Leaflet's keyboard steps.
const keyboardPanPixels = 80
// How long the camera has to stay still for a move to count as finished.
const moveEndWaitSeconds = 0.05
// Trackpad scroll distance, in pixels, that zooms one level.
const wheelPixelsPerZoomLevel = 100
// Wheel events at least this large are mouse notches, which step one level, rather than a trackpad's trickle.
const wheelNotchPixels = 40

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

/**
 * A Cesium 2D map in Cockpit's terms: `[latitude, longitude]` coordinates, tile-scale zoom, container-pixel points, and
 * the events, interactions and controls the map views use. It keeps Cesium specifics in one place, so the composables
 * can stay map-library agnostic.
 */
export class CockpitMap {
  readonly widget: CesiumWidget
  /** Holds the canvas and the marker elements; pointer events on either reach the map. */
  readonly canvasContainer: HTMLElement
  /** Absolutely positioned elements drawn over the canvas, such as markers. */
  readonly markerPane: HTMLElement
  readonly dragPan: MapInteraction
  readonly scrollZoom: MapInteraction
  readonly touchZoom: MapInteraction
  readonly doubleClickZoom: MapInteraction
  readonly keyboard: MapInteraction
  readonly boxZoom: MapInteraction

  private readonly pointerHandlers = new Map<string, Set<PointerHandler>>()
  private readonly layerHandlers = new Map<string, Map<string, Set<PointerHandler>>>()
  private readonly viewHandlers = new Map<MapViewEventType, Set<ViewHandler>>()
  private readonly pickedFeatures = new WeakMap<object, MapFeature>()
  private readonly vectors = new Map<string, VectorLayer>()
  private readonly controlCorners = new Map<MapControlCorner, HTMLElement>()
  private readonly imagery = new Map<string, ImageryEntry>()
  private readonly markers = new Set<MapMarker>()
  private readonly cleanups: (() => void)[] = []
  private hoveredLayers = new Set<string>()
  private hoverFrame: number | undefined
  private pressPoint: ScreenPoint | undefined
  private pressButton = -1
  private dragging = false
  private moving = false
  private zooming = false
  private lastWidth: number
  private animationFrame: number | undefined
  private wheelAroundCenter = false
  private wheelTarget: number | undefined
  private wheelZoomEnabled = true
  private pinchZoomEnabled = true
  private doubleClickZoomEnabled = true
  private keyboardEnabled = true
  private boxZoomEnabled = true
  private removed = false

  /**
   * Creates the map in a container and moves it to its initial view.
   * @param {HTMLElement} container - The element to draw the map into.
   * @param {CreateMapOptions} options - Initial view and behavior.
   */
  constructor(readonly container: HTMLElement, options: CreateMapOptions) {
    container.classList.add('cockpit-map')
    container.tabIndex = 0
    const creditContainer = document.createElement('div')
    this.widget = new CesiumWidget(container, {
      sceneMode: SceneMode.SCENE2D,
      mapProjection: projection,
      mapMode2D: options.rotatable ? MapMode2D.ROTATE : MapMode2D.INFINITE_SCROLL,
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      skyBox: false,
      skyAtmosphere: false,
      // Translucent layers stack in slot order only when drawn back to front, not blended order-independently.
      orderIndependentTranslucency: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      creditContainer,
    })
    const scene = this.widget.scene
    scene.backgroundColor = Color.fromCssColorString('#dddddd')
    scene.globe.baseColor = Color.fromCssColorString('#dddddd')
    scene.globe.showGroundAtmosphere = false
    scene.fog.enabled = false
    // Not in Cesium's typings, but it is what decides how soon `moveEnd` follows the camera stopping.
    ;(scene as unknown as SceneInternals).cameraEventWaitTime = moveEndWaitSeconds * 1000

    this.canvasContainer = this.widget.container as HTMLElement
    this.canvasContainer.classList.add('cockpit-map-canvas-container')
    this.markerPane = document.createElement('div')
    this.markerPane.className = 'cockpit-map-marker-pane'
    this.canvasContainer.appendChild(this.markerPane)
    this.buildControlCorners()

    const controller = scene.screenSpaceCameraController
    controller.enableTilt = false
    controller.enableLook = false
    controller.translateEventTypes = CameraEventType.LEFT_DRAG
    controller.tiltEventTypes = []
    controller.lookEventTypes = []
    controller.rotateEventTypes = []
    // Zooming stops when the input stops, as it did with Leaflet; a glide after the wheel reads as a correction.
    controller.inertiaZoom = 0
    this.applyZoomEventTypes()

    // CesiumWidget zooms to entities on double-click and selects them on click; the map views own those gestures.
    this.widget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    this.widget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK)

    this.lastWidth = this.frustumWidth()
    this.dragPan = this.interaction(
      () => (controller.enableTranslate = true),
      () => (controller.enableTranslate = false),
      () => controller.enableTranslate
    )
    this.scrollZoom = this.interaction(
      (around) => {
        this.wheelZoomEnabled = true
        this.wheelAroundCenter = around === 'center'
      },
      () => {
        this.wheelZoomEnabled = false
      },
      () => this.wheelZoomEnabled
    )
    this.touchZoom = this.interaction(
      () => {
        this.pinchZoomEnabled = true
        this.applyZoomEventTypes()
      },
      () => {
        this.pinchZoomEnabled = false
        this.applyZoomEventTypes()
      },
      () => this.pinchZoomEnabled
    )
    this.doubleClickZoom = this.interaction(
      () => (this.doubleClickZoomEnabled = true),
      () => (this.doubleClickZoomEnabled = false),
      () => this.doubleClickZoomEnabled
    )
    this.keyboard = this.interaction(
      () => (this.keyboardEnabled = true),
      () => (this.keyboardEnabled = false),
      () => this.keyboardEnabled
    )
    this.boxZoom = this.interaction(
      () => (this.boxZoomEnabled = true),
      () => (this.boxZoomEnabled = false),
      () => this.boxZoomEnabled
    )

    if (options.attribution) {
      const attribution = attributionControl(this)
      this.addControl(attribution.element, 'bottom-right')
      this.cleanups.push(attribution.remove)
    }

    this.listenToPointer()
    this.listenToCamera()
    this.applyZoomLimits()
    this.jumpTo(options.center, options.zoom)
    requestAnimationFrame(() => this.fireView({ type: 'load' }))
  }

  /**
   * The element the map was created in.
   * @returns {HTMLElement} The container.
   */
  getContainer(): HTMLElement {
    return this.container
  }

  /**
   * The element holding the canvas and the markers, whose cursor is the map's cursor.
   * @returns {HTMLElement} The canvas container.
   */
  getCanvasContainer(): HTMLElement {
    return this.canvasContainer
  }

  /**
   * The map's WebGL canvas.
   * @returns {HTMLCanvasElement} The canvas.
   */
  getCanvas(): HTMLCanvasElement {
    return this.widget.canvas
  }

  /**
   * Whether the map can be drawn on, which is as soon as it exists and until it is removed.
   * @returns {boolean} True while the map is usable.
   */
  loaded(): boolean {
    return !this.removed
  }

  /**
   * Measures the container again and redraws. Cesium also checks the size every frame, so this only makes a resize
   * take effect at once.
   */
  resize(): void {
    if (this.removed) return
    this.widget.resize()
    this.requestRender()
  }

  /**
   * Asks Cesium to draw a frame, which it only does on request.
   */
  requestRender(): void {
    if (!this.removed) this.widget.scene.requestRender()
  }

  // ---- Camera ----

  /**
   * Width of the canvas in CSS pixels, never zero.
   * @returns {number} The width.
   */
  private canvasWidth(): number {
    return this.widget.canvas.clientWidth || 1
  }

  /**
   * Height of the canvas in CSS pixels, never zero.
   * @returns {number} The height.
   */
  private canvasHeight(): number {
    return this.widget.canvas.clientHeight || 1
  }

  /**
   * Width of the 2D camera's view, in Web Mercator meters.
   * @returns {number} The frustum width.
   */
  private frustumWidth(): number {
    const frustum = this.widget.camera.frustum as unknown as Record<'left' | 'right', number>
    return frustum.right - frustum.left
  }

  /**
   * The current zoom, on the tile scale. It is fractional between levels.
   * @returns {number} The zoom.
   */
  getZoom(): number {
    return zoomForFrustumWidth(this.frustumWidth(), this.canvasWidth())
  }

  /**
   * The lowest zoom the map allows.
   * @returns {number} The zoom, on the tile scale.
   */
  getMinZoom(): number {
    return mapZoomLimits.min
  }

  /**
   * The highest zoom the map allows.
   * @returns {number} The zoom, on the tile scale.
   */
  getMaxZoom(): number {
    return mapZoomLimits.max
  }

  /**
   * The coordinate at the center of the map.
   * @returns {WaypointCoordinates} The `[latitude, longitude]`.
   */
  getCenter(): WaypointCoordinates {
    const position = this.widget.camera.position
    return fromMercator(position.x, position.y)
  }

  /**
   * The map's heading, for maps created rotatable.
   * @returns {number} Degrees clockwise from north.
   */
  getBearing(): number {
    return CesiumMath.toDegrees(this.widget.camera.heading) % 360
  }

  /**
   * Turns a rotatable map to a heading, keeping its center and zoom.
   * @param {number} bearing - Degrees clockwise from north.
   */
  setBearing(bearing: number): void {
    const center = this.getCenter()
    this.widget.camera.setView({
      destination: Cartesian3.fromDegrees(center[1], center[0], this.frustumWidth()),
      orientation: { heading: CesiumMath.toRadians(bearing), pitch: -CesiumMath.PI_OVER_TWO, roll: 0 },
    })
    this.requestRender()
  }

  /**
   * The area the map shows.
   * @returns {MapBounds} Its bounds.
   */
  getBounds(): MapBounds {
    const width = this.canvasWidth()
    const height = this.canvasHeight()
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ].map((point) => this.unproject(point))
    const [[south, west], [north, east]] = boundsOf(corners)
    return {
      getNorth: () => north,
      getSouth: () => south,
      getEast: () => east,
      getWest: () => west,
      toArray: () => [
        [south, west],
        [north, east],
      ],
    }
  }

  /**
   * Projects a coordinate to the map container's pixel space.
   * @param {WaypointCoordinates} coordinates - The `[latitude, longitude]` to project.
   * @returns {ScreenPoint} The position relative to the container's top-left corner, in pixels.
   */
  project(coordinates: WaypointCoordinates): ScreenPoint {
    const position = SceneTransforms.worldToWindowCoordinates(
      this.widget.scene,
      Cartesian3.fromDegrees(coordinates[1], coordinates[0])
    )
    return position ? { x: position.x, y: position.y } : { x: Number.NaN, y: Number.NaN }
  }

  /**
   * The coordinate under a position in the map container's pixel space.
   * @param {ScreenPoint} point - The position relative to the container's top-left corner, in pixels.
   * @returns {WaypointCoordinates} The `[latitude, longitude]` at that position.
   */
  unproject(point: ScreenPoint): WaypointCoordinates {
    const cartesian = this.widget.camera.pickEllipsoid(new Cartesian2(point.x, point.y))
    if (!cartesian) return this.getCenter()
    const cartographic = Ellipsoid.WGS84.cartesianToCartographic(cartesian)
    return [CesiumMath.toDegrees(cartographic.latitude), CesiumMath.toDegrees(cartographic.longitude)]
  }

  /**
   * Position of a DOM pointer event relative to the map container's top-left corner.
   * @param {Pick<MouseEvent, 'clientX' | 'clientY'>} event - The DOM event, or anything carrying client coordinates.
   * @returns {ScreenPoint} The position in container pixels.
   */
  pointFromClient(event: Pick<MouseEvent, 'clientX' | 'clientY'>): ScreenPoint {
    const rect = this.widget.canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  /**
   * Keeps a zoom within the map's limits.
   * @param {number} zoom - The tile-scale zoom.
   * @returns {number} The clamped zoom.
   */
  private clampZoom(zoom: number): number {
    return Math.min(Math.max(zoom, mapZoomLimits.min), mapZoomLimits.max)
  }

  /**
   * Moves the map to a view at once.
   * @param {WaypointCoordinates} center - The `[latitude, longitude]` to center on.
   * @param {number} [zoom] - The tile-scale zoom, or undefined to keep the current one.
   */
  jumpTo(center: WaypointCoordinates, zoom?: number): void {
    this.stopAnimation()
    this.applyView(center, zoom ?? this.getZoom())
  }

  // The center that keeps `around` at the same screen position when the zoom changes to `zoom`.
  /**
   * The center that keeps a coordinate at the same screen position when the zoom changes.
   * @param {WaypointCoordinates} around - The coordinate to keep in place.
   * @param {number} zoom - The tile-scale zoom being changed to.
   * @returns {WaypointCoordinates} The new center.
   */
  private centerKeeping(around: WaypointCoordinates, zoom: number): WaypointCoordinates {
    const center = toMercator(this.getCenter())
    const fixed = toMercator(around)
    const scale = 2 ** (this.getZoom() - zoom)
    return fromMercator(fixed.x + (center.x - fixed.x) * scale, fixed.y + (center.y - fixed.y) * scale)
  }

  /**
   * Sets the camera to a view at once, without stopping a running animation.
   * @param {WaypointCoordinates} center - The `[latitude, longitude]` to center on.
   * @param {number} zoom - The tile-scale zoom.
   */
  private applyView(center: WaypointCoordinates, zoom: number): void {
    // In 2D, the destination height becomes the frustum width, which is how the zoom is set.
    const width = frustumWidthForZoom(this.clampZoom(zoom), this.canvasWidth())
    this.widget.camera.setView({ destination: Cartesian3.fromDegrees(center[1], center[0], width) })
    this.requestRender()
  }

  /**
   * Animates the map to a view, keeping `around` fixed on screen while zooming.
   * @param {EaseToOptions} options - Where to go and how.
   */
  easeTo(options: EaseToOptions): void {
    this.stopAnimation()
    const startZoom = this.getZoom()
    const startCenter = toMercator(this.getCenter())
    const endZoom = this.clampZoom(options.zoom ?? startZoom)
    const around = options.around ? toMercator(options.around) : undefined
    const endCenter = options.center ? toMercator(options.center) : undefined
    const duration = options.duration ?? 250

    const centerAt = (zoom: number, t: number): WaypointCoordinates => {
      if (endCenter) {
        return fromMercator(
          startCenter.x + (endCenter.x - startCenter.x) * t,
          startCenter.y + (endCenter.y - startCenter.y) * t
        )
      }
      if (!around) return fromMercator(startCenter.x, startCenter.y)
      // Keeping a point fixed while the scale changes moves the center along the line to that point.
      const scale = 2 ** (startZoom - zoom)
      return fromMercator(around.x + (startCenter.x - around.x) * scale, around.y + (startCenter.y - around.y) * scale)
    }

    if (duration <= 0) {
      this.applyView(centerAt(endZoom, 1), endZoom)
      return
    }
    const start = performance.now()
    const step = (now: number): void => {
      if (this.removed) return
      // A frame's timestamp is when the frame began, which can come before `start`, and a negative progress eases the wrong way.
      const t = Math.min(Math.max((now - start) / duration, 0), 1)
      const k = easeOutCubic(t)
      const zoom = startZoom + (endZoom - startZoom) * k
      this.applyView(centerAt(zoom, k), zoom)
      this.animationFrame = t < 1 ? requestAnimationFrame(step) : undefined
    }
    this.animationFrame = requestAnimationFrame(step)
  }

  /**
   * Stops a running {@link easeTo} where it is.
   */
  private stopAnimation(): void {
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame)
    this.animationFrame = undefined
  }

  /**
   * Zooms in one whole level about the center, as the zoom buttons do.
   */
  zoomIn(): void {
    this.easeTo({ zoom: Math.round(this.getZoom()) + 1 })
  }

  /**
   * Zooms out one whole level about the center, as the zoom buttons do.
   */
  zoomOut(): void {
    this.easeTo({ zoom: Math.round(this.getZoom()) - 1 })
  }

  /**
   * Fits the map to bounds, landing on a whole zoom level that still shows all of them.
   * @param {[WaypointCoordinates, WaypointCoordinates]} bounds - The bounds as `[[south, west], [north, east]]`.
   * @param {FitBoundsOptions} [options] - Padding, zoom limit and animation.
   */
  fitBounds(bounds: [WaypointCoordinates, WaypointCoordinates], options: FitBoundsOptions = {}): void {
    const padding = options.padding ?? 0
    const southWest = toMercator(bounds[0])
    const northEast = toMercator(bounds[1])
    const spanX = Math.max(Math.abs(northEast.x - southWest.x), 1e-6)
    const spanY = Math.max(Math.abs(northEast.y - southWest.y), 1e-6)
    const width = Math.max(this.canvasWidth() - 2 * padding, 1)
    const height = Math.max(this.canvasHeight() - 2 * padding, 1)
    const fitX = zoomForFrustumWidth(spanX, width)
    const fitY = zoomForFrustumWidth(spanY, width) - Math.log2(width / height)
    const zoom = Math.min(Math.floor(Math.min(fitX, fitY)), options.maxZoom ?? mapZoomLimits.max)
    const center = fromMercator((southWest.x + northEast.x) / 2, (southWest.y + northEast.y) / 2)
    this.easeTo({ center, zoom, duration: options.animate === false ? 0 : 250 })
  }

  /**
   * Whether the map is moving, whether by a gesture or an animation.
   * @returns {boolean} True while it moves.
   */
  isMoving(): boolean {
    return this.moving || this.animationFrame !== undefined
  }

  /**
   * Whether the map zoom is changing.
   * @returns {boolean} True while it zooms.
   */
  isZooming(): boolean {
    return this.zooming
  }

  // ---- Markers ----

  /**
   * Starts keeping a marker over its coordinate. {@link MapMarker.addTo} calls this.
   * @param {MapMarker} marker - The marker.
   */
  addMarker(marker: MapMarker): void {
    this.markers.add(marker)
  }

  /**
   * Stops keeping a marker over its coordinate. {@link MapMarker.remove} calls this.
   * @param {MapMarker} marker - The marker.
   */
  removeMarker(marker: MapMarker): void {
    this.markers.delete(marker)
  }

  // ---- Imagery ----

  /**
   * Draws raster imagery in a stacking slot, above the imagery of lower slots and of the same slot added earlier.
   * @param {string} id - An id unique within the map.
   * @param {MapLayerSlot} slot - The stacking slot.
   * @param {ImageryProvider} provider - Where the imagery comes from.
   * @param {ImageryOptions} [options] - Visibility, opacity, zoom range and attribution.
   */
  addImagery(id: string, slot: MapLayerSlot, provider: ImageryProvider, options: ImageryOptions = {}): void {
    if (this.imagery.has(id)) return
    const layer = new ImageryLayer(provider, {
      show: options.visible ?? true,
      alpha: options.opacity ?? 1,
      minimumTerrainLevel: options.minZoom,
      maximumTerrainLevel: options.maxZoom,
    })
    const slotIndex = mapLayerSlots.indexOf(slot)
    const below = [...this.imagery.values()].filter((entry) => mapLayerSlots.indexOf(entry.slot) <= slotIndex).length
    this.widget.imageryLayers.add(layer, below)
    this.imagery.set(id, { layer, slot, options })
    this.imageryChanged()
  }

  /**
   * Swaps the provider of imagery added with {@link addImagery}, keeping its place, visibility and opacity. This is
   * how its tiles are reloaded after their loading options changed.
   * @param {string} id - The imagery id.
   * @param {ImageryProvider} provider - The new provider.
   */
  setImageryProvider(id: string, provider: ImageryProvider): void {
    const entry = this.imagery.get(id)
    if (!entry) return
    const index = this.widget.imageryLayers.indexOf(entry.layer)
    const layer = new ImageryLayer(provider, {
      show: entry.layer.show,
      alpha: entry.layer.alpha,
      minimumTerrainLevel: entry.options.minZoom,
      maximumTerrainLevel: entry.options.maxZoom,
    })
    this.widget.imageryLayers.remove(entry.layer, true)
    this.widget.imageryLayers.add(layer, index)
    entry.layer = layer
    this.imageryChanged()
  }

  /**
   * Shows or hides imagery added with {@link addImagery}.
   * @param {string} id - The imagery id.
   * @param {boolean} visible - Whether to show it.
   */
  setImageryVisible(id: string, visible: boolean): void {
    const entry = this.imagery.get(id)
    if (!entry || entry.layer.show === visible) return
    entry.layer.show = visible
    this.imageryChanged()
  }

  /**
   * Whether imagery added with {@link addImagery} is shown.
   * @param {string} id - The imagery id.
   * @returns {boolean} True when it exists and is visible.
   */
  isImageryVisible(id: string): boolean {
    return this.imagery.get(id)?.layer.show ?? false
  }

  /**
   * Changes the opacity of imagery added with {@link addImagery}.
   * @param {string} id - The imagery id.
   * @param {number} opacity - Opacity, from 0 to 1.
   */
  setImageryOpacity(id: string, opacity: number): void {
    const entry = this.imagery.get(id)
    if (!entry) return
    entry.layer.alpha = opacity
    this.requestRender()
  }

  /**
   * Whether imagery with an id is on the map.
   * @param {string} id - The imagery id.
   * @returns {boolean} True when it was added and not removed.
   */
  hasImagery(id: string): boolean {
    return this.imagery.has(id)
  }

  /**
   * Removes imagery added with {@link addImagery}, if it is still there.
   * @param {string} id - The imagery id.
   */
  removeImagery(id: string): void {
    const entry = this.imagery.get(id)
    if (!entry) return
    this.imagery.delete(id)
    if (!this.removed) this.widget.imageryLayers.remove(entry.layer, true)
    this.imageryChanged()
  }

  /**
   * Attributions of the imagery currently shown, in stacking order from the bottom.
   * @returns {string[]} The attribution strings, without repeats.
   */
  visibleAttributions(): string[] {
    const attributions = [...this.imagery.values()]
      .filter((entry) => entry.layer.show && entry.options.attribution)
      .sort((a, b) => this.widget.imageryLayers.indexOf(a.layer) - this.widget.imageryLayers.indexOf(b.layer))
      .map((entry) => entry.options.attribution as string)
    return [...new Set(attributions)]
  }

  /**
   * Redraws after the imagery changed and tells listeners, such as the attribution control.
   */
  private imageryChanged(): void {
    this.requestRender()
    this.fireView({ type: 'layers' })
  }

  // ---- Vectors ----

  /**
   * Ground meters one pixel spans at the map center.
   * @returns {number} Meters per pixel.
   */
  metersPerPixel(): number {
    const center = this.getCenter()
    return (this.frustumWidth() / this.canvasWidth()) * Math.cos((center[0] * Math.PI) / 180)
  }

  /**
   * Draws vector features in a stacking slot, replacing whatever the layer drew before.
   * @param {string} id - An id unique within the map, which layer-scoped events refer to.
   * @param {MapLayerSlot} slot - The stacking slot.
   * @param {VectorFeature[]} features - The lines, areas and dots to draw.
   */
  setVectors(id: string, slot: MapLayerSlot, features: VectorFeature[]): void {
    if (this.removed) return
    let layer = this.vectors.get(id)
    if (!layer) {
      // A new layer goes just above the highest one already in its slot, which keeps creation order within the slot
      // and stays well below the next slot (ten meters up) for any realistic number of layers.
      const lifts = [...this.vectors.values()].filter((other) => other.slot === slot).map((other) => other.lift)
      layer = new VectorLayer(
        this.widget.scene,
        id,
        slot,
        lifts.length ? Math.max(...lifts) + 0.1 : 0,
        (key, feature) => this.registerFeature(key, feature),
        () => this.getZoom(),
        () => this.metersPerPixel()
      )
      this.vectors.set(id, layer)
    }
    layer.set(features)
  }

  /**
   * Whether a vector layer exists.
   * @param {string} id - The layer id.
   * @returns {boolean} True when it was drawn and not removed.
   */
  hasVectors(id: string): boolean {
    return this.vectors.has(id)
  }

  /**
   * Shows or hides a vector layer.
   * @param {string} id - The layer id.
   * @param {boolean} visible - Whether to show it.
   */
  setVectorsVisible(id: string, visible: boolean): void {
    this.vectors.get(id)?.setVisible(visible)
    this.requestRender()
  }

  /**
   * Fades a vector layer, for dimming it behind something being edited.
   * @param {string} id - The layer id.
   * @param {number} factor - Opacity multiplier, from 0 to 1.
   */
  setVectorsOpacityFactor(id: string, factor: number): void {
    this.vectors.get(id)?.setOpacityFactor(factor)
  }

  /**
   * Marches the dashes of a vector layer's dashed lines, which is how a line shows its direction of travel.
   * @param {string} id - The layer id.
   * @param {number} travelled - How far the dashes have moved along their lines, in pixels.
   */
  marchVectorDashes(id: string, travelled: number): void {
    this.vectors.get(id)?.marchDashes(travelled)
    this.requestRender()
  }

  /**
   * The vector layers drawn, with the slot each stacks in.
   * @returns {{ id: string, slot: MapLayerSlot }[]} The layers.
   */
  vectorLayers(): { /** The layer id. */ id: string; /** Its stacking slot. */ slot: MapLayerSlot }[] {
    return [...this.vectors.values()].map((layer) => ({ id: layer.id, slot: layer.slot }))
  }

  /**
   * Removes a vector layer, if it is still there.
   * @param {string} id - The layer id.
   */
  removeVectors(id: string): void {
    const layer = this.vectors.get(id)
    if (!layer) return
    this.vectors.delete(id)
    if (!this.removed) layer.destroy()
    this.requestRender()
  }

  // ---- Features, for layer-scoped events ----

  /**
   * Records what a picked primitive id belongs to, so layer-scoped events can report it.
   * @param {object} key - The id the primitive was drawn with.
   * @param {MapFeature} feature - Its layer and properties.
   */
  registerFeature(key: object, feature: MapFeature): void {
    this.pickedFeatures.set(key, feature)
  }

  /**
   * The registered features under a container point.
   * @param {ScreenPoint} point - The container position.
   * @param {boolean} all - Whether to report every feature under it, or only the topmost one.
   * @returns {MapFeature[]} The features, topmost first.
   */
  private featuresAt(point: ScreenPoint, all: boolean): MapFeature[] {
    const position = new Cartesian2(point.x, point.y)
    const picked = all ? this.widget.scene.drillPick(position, 8) : [this.widget.scene.pick(position)]
    return picked
      .map((object) => (object?.id && typeof object.id === 'object' ? this.pickedFeatures.get(object.id) : undefined))
      .filter((feature): feature is MapFeature => feature !== undefined)
  }

  // ---- Events ----

  /**
   * Listens to a map event.
   * @param {MapPointerEventType | MapViewEventType} type - The event name.
   * @param {PointerHandler | ViewHandler} handler - The handler.
   */
  on(type: MapPointerEventType | MapViewEventType, handler: PointerHandler | ViewHandler): void {
    const handlers = this.isViewEvent(type) ? this.viewHandlers : this.pointerHandlers
    const set = handlers.get(type as never) ?? new Set()
    set.add(handler as never)
    handlers.set(type as never, set as never)
  }

  /**
   * Stops listening to a map event registered with {@link on}.
   * @param {MapPointerEventType | MapViewEventType} type - The event name.
   * @param {PointerHandler | ViewHandler} handler - The handler.
   */
  off(type: MapPointerEventType | MapViewEventType, handler: PointerHandler | ViewHandler): void {
    this.viewHandlers.get(type as MapViewEventType)?.delete(handler as ViewHandler)
    this.pointerHandlers.get(type)?.delete(handler as PointerHandler)
  }

  /**
   * Listens to a pointer event on the features of one or more vector layers.
   * @param {MapLayerEventType} type - The event name.
   * @param {string | string[]} layerIds - The layer ids.
   * @param {PointerHandler} handler - The handler, called with the event's `feature` set.
   */
  onLayer(type: MapLayerEventType, layerIds: string | string[], handler: PointerHandler): void {
    const byLayer = this.layerHandlers.get(type) ?? new Map<string, Set<PointerHandler>>()
    ;(Array.isArray(layerIds) ? layerIds : [layerIds]).forEach((layerId) => {
      const set = byLayer.get(layerId) ?? new Set<PointerHandler>()
      set.add(handler)
      byLayer.set(layerId, set)
    })
    this.layerHandlers.set(type, byLayer)
  }

  /**
   * Stops listening to a layer event registered with {@link onLayer}.
   * @param {MapLayerEventType} type - The event name.
   * @param {string | string[]} layerIds - The layer ids.
   * @param {PointerHandler} handler - The handler.
   */
  offLayer(type: MapLayerEventType, layerIds: string | string[], handler: PointerHandler): void {
    ;(Array.isArray(layerIds) ? layerIds : [layerIds]).forEach((layerId) =>
      this.layerHandlers.get(type)?.get(layerId)?.delete(handler)
    )
  }

  /**
   * Listens to the next occurrence of a view event only.
   * @param {MapViewEventType} type - The event name.
   * @param {ViewHandler} handler - The handler.
   */
  once(type: MapViewEventType, handler: ViewHandler): void {
    const wrapped: ViewHandler = (event) => {
      this.off(type, wrapped)
      handler(event)
    }
    this.on(type, wrapped)
  }

  /**
   * Raises a pointer event as if the map had seen it, for gestures the map views recognize themselves.
   * @param {MapPointerEventType} type - The event name.
   * @param {MouseEvent} originalEvent - The DOM event behind it.
   * @returns {MapPointerEvent} The event raised.
   */
  firePointer(type: MapPointerEventType, originalEvent: MouseEvent): MapPointerEvent {
    const point = this.pointFromClient(originalEvent)
    const event = new MapPointerEvent(type, this.unproject(point), point, originalEvent)
    this.pointerHandlers.get(type)?.forEach((handler) => handler(event))
    return event
  }

  /**
   * Whether an event name is one of the view events.
   * @param {string} type - The event name.
   * @returns {boolean} True for a view event.
   */
  private isViewEvent(type: string): type is MapViewEventType {
    return [
      'load',
      'movestart',
      'move',
      'moveend',
      'zoomstart',
      'zoom',
      'zoomend',
      'dragstart',
      'drag',
      'dragend',
      'resize',
      'layers',
      'remove',
    ].includes(type)
  }

  /**
   * Calls the handlers of a view event.
   * @param {MapViewEvent} event - The event to raise.
   */
  private fireView(event: MapViewEvent): void {
    if (this.removed && event.type !== 'remove') return
    this.viewHandlers.get(event.type)?.forEach((handler) => handler(event))
  }

  /**
   * Raises a pointer event, to the features' layer handlers first and then to the map's handlers.
   * @param {MapPointerEventType} type - The event name.
   * @param {MouseEvent} originalEvent - The DOM event behind it.
   * @returns {MapPointerEvent} The event raised, which handlers may have claimed.
   */
  private dispatchPointer(type: MapPointerEventType, originalEvent: MouseEvent): MapPointerEvent {
    const point = this.pointFromClient(originalEvent)
    const event = new MapPointerEvent(type, this.unproject(point), point, originalEvent)
    const byLayer = this.layerHandlers.get(type)
    if (byLayer && [...byLayer.values()].some((handlers) => handlers.size > 0)) {
      // Every feature under the pointer answers, not just the topmost one.
      const seen = new Set<string>()
      this.featuresAt(point, true).forEach((feature) => {
        if (seen.has(feature.layerId)) return
        seen.add(feature.layerId)
        event.feature = feature
        byLayer.get(feature.layerId)?.forEach((handler) => handler(event))
      })
      event.feature = undefined
    }
    this.pointerHandlers.get(type)?.forEach((handler) => handler(event))
    return event
  }

  /**
   * Raises `mouseenter` and `mouseleave` on the layers the pointer moved onto or off, once per frame.
   * @param {MouseEvent} originalEvent - The pointer move.
   */
  private updateHover(originalEvent: MouseEvent): void {
    const enter = this.layerHandlers.get('mouseenter')
    const leave = this.layerHandlers.get('mouseleave')
    if (!enter?.size && !leave?.size) return
    if (this.hoverFrame !== undefined) return
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = undefined
      if (this.removed) return
      const point = this.pointFromClient(originalEvent)
      const hovered = new Set(this.featuresAt(point, false).map((feature) => feature.layerId))
      const event = new MapPointerEvent('mouseenter', this.unproject(point), point, originalEvent)
      hovered.forEach((layerId) => {
        if (!this.hoveredLayers.has(layerId)) enter?.get(layerId)?.forEach((handler) => handler(event))
      })
      this.hoveredLayers.forEach((layerId) => {
        if (!hovered.has(layerId)) leave?.get(layerId)?.forEach((handler) => handler(event))
      })
      this.hoveredLayers = hovered
    })
  }

  /**
   * Adds a DOM listener that {@link remove} takes off again.
   * @param {HTMLElement | Window} target - The element or window to listen on.
   * @param {K} type - The DOM event name.
   * @param {Function} handler - The listener.
   * @param {AddEventListenerOptions} [options] - Listener options.
   */
  private listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, handler as EventListener, options)
    this.cleanups.push(() => target.removeEventListener(type, handler as EventListener, options))
  }

  /**
   * Turns DOM pointer, wheel and keyboard input into map events and gestures.
   */
  private listenToPointer(): void {
    const element = this.canvasContainer
    // Cesium cancels `pointerdown` on its canvas, which stops the browser from raising the mouse events that follow it,
    // so presses, moves and releases are read from pointer events. Touches are left to the touch gestures.
    this.listen(element, 'pointerdown', (event) => {
      if (event.pointerType === 'touch') return
      this.stopAnimation()
      this.pressPoint = this.pointFromClient(event)
      this.pressButton = event.button
      this.dispatchPointer('mousedown', event)
      if (event.button === 0 && event.shiftKey && this.boxZoomEnabled) this.startBoxZoom(event)
    })
    this.listen(element, 'pointermove', (event) => {
      if (event.pointerType === 'touch') return
      this.dispatchPointer('mousemove', event)
      this.updateHover(event)
      if (
        this.pressButton !== 0 ||
        !this.pressPoint ||
        !this.widget.scene.screenSpaceCameraController.enableTranslate
      ) {
        return
      }
      const point = this.pointFromClient(event)
      const moved = Math.hypot(point.x - this.pressPoint.x, point.y - this.pressPoint.y)
      if (!this.dragging && moved > clickTolerancePixels && !event.shiftKey) {
        this.dragging = true
        this.fireView({ type: 'dragstart', originalEvent: event })
      }
      if (this.dragging) this.fireView({ type: 'drag', originalEvent: event })
    })
    this.listen(window, 'pointerup', (event) => {
      if (event.pointerType === 'touch') return
      const wasPressed = this.pressPoint !== undefined
      if (wasPressed && element.contains(event.target as Node)) this.dispatchPointer('mouseup', event)
      if (this.dragging) {
        this.dragging = false
        this.fireView({ type: 'dragend', originalEvent: event })
      }
      this.pressButton = -1
    })
    this.listen(element, 'click', (event) => {
      const point = this.pointFromClient(event)
      const press = this.pressPoint
      this.pressPoint = undefined
      if (press && Math.hypot(point.x - press.x, point.y - press.y) > clickTolerancePixels) return
      this.dispatchPointer('click', event)
    })
    this.listen(element, 'dblclick', (event) => {
      const dispatched = this.dispatchPointer('dblclick', event)
      if (dispatched.defaultPrevented || !this.doubleClickZoomEnabled) return
      const zoom = Math.round(this.getZoom()) + (event.shiftKey ? -1 : 1)
      this.easeTo({ zoom, around: dispatched.latLng })
    })
    this.listen(element, 'contextmenu', (event) => {
      event.preventDefault()
      this.dispatchPointer('contextmenu', event)
    })
    this.listen(element, 'mouseleave', (event) => {
      this.dispatchPointer('mouseout', event)
      this.hoveredLayers.forEach((layerId) => {
        const leave = this.layerHandlers.get('mouseleave')?.get(layerId)
        const point = this.pointFromClient(event)
        leave?.forEach((handler) => handler(new MapPointerEvent('mouseleave', this.unproject(point), point, event)))
      })
      this.hoveredLayers.clear()
    })
    this.listen(element, 'wheel', (event) => this.zoomByWheel(event), { passive: false })
    this.listen(this.container, 'keydown', (event) => {
      if (!this.keyboardEnabled || event.target !== this.container) return
      const pan: Record<string, [number, number]> = {
        ArrowLeft: [-keyboardPanPixels, 0],
        ArrowRight: [keyboardPanPixels, 0],
        ArrowUp: [0, -keyboardPanPixels],
        ArrowDown: [0, keyboardPanPixels],
      }
      const step = event.shiftKey ? 3 : 1
      if (pan[event.key]) {
        const [dx, dy] = pan[event.key]
        const center = this.project(this.getCenter())
        this.easeTo({ center: this.unproject({ x: center.x + dx * step, y: center.y + dy * step }) })
      } else if (event.key === '+' || event.key === '=') {
        this.easeTo({ zoom: Math.round(this.getZoom()) + step })
      } else if (event.key === '-' || event.key === '_') {
        this.easeTo({ zoom: Math.round(this.getZoom()) - step })
      } else {
        return
      }
      event.preventDefault()
    })
  }

  // Cesium's wheel zoom scales with the canvas height and glides on after the wheel stops, so the wheel is handled here:
  // a trackpad zooms continuously and stops with the input, and a mouse notch eases one level, leaving zoom fractional.
  /**
   * Zooms for a wheel event.
   * @param {WheelEvent} event - The wheel event.
   */
  private zoomByWheel(event: WheelEvent): void {
    if (!this.wheelZoomEnabled) return
    event.preventDefault()
    const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 40 : event.deltaY
    if (pixels === 0) return
    const around = this.wheelAroundCenter ? undefined : this.unproject(this.pointFromClient(event))
    if (Math.abs(pixels) >= wheelNotchPixels) {
      // Notches arriving mid-animation continue from where it is heading, so fast scrolling still steps level by level.
      const from =
        this.animationFrame !== undefined && this.wheelTarget !== undefined ? this.wheelTarget : this.getZoom()
      const target = this.clampZoom(from - Math.sign(pixels))
      this.wheelTarget = target
      this.easeTo({ zoom: target, around, duration: 200 })
      return
    }
    this.stopAnimation()
    const zoom = this.clampZoom(this.getZoom() - pixels / wheelPixelsPerZoomLevel)
    this.applyView(around ? this.centerKeeping(around, zoom) : this.getCenter(), zoom)
  }

  /**
   * Draws a zoom box from a Shift press and zooms to it on release.
   * @param {MouseEvent} start - The press that started the box.
   */
  private startBoxZoom(start: MouseEvent): void {
    const origin = this.pointFromClient(start)
    const box = document.createElement('div')
    box.className = 'cockpit-map-zoom-box'
    this.canvasContainer.appendChild(box)
    const controller = this.widget.scene.screenSpaceCameraController
    const translateWasEnabled = controller.enableTranslate
    controller.enableTranslate = false
    const draw = (event: PointerEvent): void => {
      const point = this.pointFromClient(event)
      Object.assign(box.style, {
        left: `${Math.min(origin.x, point.x)}px`,
        top: `${Math.min(origin.y, point.y)}px`,
        width: `${Math.abs(point.x - origin.x)}px`,
        height: `${Math.abs(point.y - origin.y)}px`,
      })
    }
    const finish = (event: PointerEvent): void => {
      window.removeEventListener('pointermove', draw)
      window.removeEventListener('pointerup', finish)
      controller.enableTranslate = translateWasEnabled
      box.remove()
      const point = this.pointFromClient(event)
      if (Math.abs(point.x - origin.x) < clickTolerancePixels || Math.abs(point.y - origin.y) < clickTolerancePixels) {
        return
      }
      this.fitBounds(boundsOf([this.unproject(origin), this.unproject(point)]))
    }
    window.addEventListener('pointermove', draw)
    window.addEventListener('pointerup', finish)
  }

  /**
   * Turns camera changes into move and zoom events, and keeps the zoom limits matched to the canvas size.
   */
  private listenToCamera(): void {
    const camera = this.widget.camera
    camera.percentageChanged = 0
    const onChanged = (): void => {
      const width = this.frustumWidth()
      const zoomChanged = Math.abs(width - this.lastWidth) > width * 1e-9
      this.lastWidth = width
      if (!this.moving) {
        this.moving = true
        this.fireView({ type: 'movestart' })
      }
      if (zoomChanged && !this.zooming) {
        this.zooming = true
        this.fireView({ type: 'zoomstart' })
      }
      if (zoomChanged) this.fireView({ type: 'zoom' })
      this.fireView({ type: 'move' })
    }
    const onMoveEnd = (): void => {
      // A drag that pauses keeps going, so its move only ends when the press does.
      if (this.dragging || this.animationFrame !== undefined) return
      if (this.zooming) {
        this.zooming = false
        this.vectors.forEach((layer) => layer.refreshForZoom())
        this.fireView({ type: 'zoomend' })
      }
      if (this.moving) {
        this.moving = false
        this.fireView({ type: 'moveend' })
      }
    }
    this.cleanups.push(camera.changed.addEventListener(onChanged), camera.moveEnd.addEventListener(onMoveEnd))
    let lastCanvasWidth = this.canvasWidth()
    this.cleanups.push(
      this.widget.scene.postRender.addEventListener(() => {
        this.markers.forEach((marker) => marker.updatePosition())
        const canvasWidth = this.canvasWidth()
        if (canvasWidth === lastCanvasWidth) return
        lastCanvasWidth = canvasWidth
        this.applyZoomLimits()
        this.fireView({ type: 'resize' })
      })
    )
  }

  /**
   * Tells Cesium's camera controller which gestures zoom.
   */
  private applyZoomEventTypes(): void {
    const controller = this.widget.scene.screenSpaceCameraController
    // The wheel is handled by `zoomByWheel`, so Cesium only zooms on a pinch.
    const types: CameraEventType[] = []
    if (this.pinchZoomEnabled) types.push(CameraEventType.PINCH)
    controller.zoomEventTypes = types
    controller.enableZoom = types.length > 0
  }

  /**
   * Sets Cesium's zoom limits from the map's tile-scale ones for the current canvas size.
   */
  private applyZoomLimits(): void {
    // Cesium bounds 2D zooming by the frustum's larger side, which depends on the canvas size.
    const controller = this.widget.scene.screenSpaceCameraController
    const longestSide = Math.max(this.canvasWidth(), this.canvasHeight())
    controller.minimumZoomDistance = frustumWidthForZoom(mapZoomLimits.max, longestSide)
    controller.maximumZoomDistance = frustumWidthForZoom(mapZoomLimits.min, longestSide)
  }

  /**
   * Bundles the switches of one interaction.
   * @param {Function} enable - Turns it on, taking the `around` option.
   * @param {Function} disable - Turns it off.
   * @param {Function} isEnabled - Reports whether it is on.
   * @returns {MapInteraction} The interaction.
   */
  private interaction(
    enable: (around?: 'center') => void,
    disable: () => void,
    isEnabled: () => boolean
  ): MapInteraction {
    return {
      enable: (options) => enable(options?.around),
      disable,
      isEnabled,
    }
  }

  // ---- Controls ----

  /**
   * Creates the four corners controls are stacked in.
   */
  private buildControlCorners(): void {
    const controlContainer = document.createElement('div')
    controlContainer.className = 'cockpit-map-control-container'
    ;(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as MapControlCorner[]).forEach((corner) => {
      const element = document.createElement('div')
      element.className = `cockpit-map-ctrl-${corner}`
      controlContainer.appendChild(element)
      this.controlCorners.set(corner, element)
    })
    this.container.appendChild(controlContainer)
  }

  /**
   * Puts a control element in a corner of the map. Controls stack downward in the top corners and upward in the
   * bottom ones, the most recent closest to the corner, as Leaflet stacked them.
   * @param {HTMLElement} element - The control element.
   * @param {MapControlCorner} corner - Where to put it.
   */
  addControl(element: HTMLElement, corner: MapControlCorner): void {
    element.classList.add('cockpit-map-ctrl')
    const container = this.controlCorners.get(corner)
    if (!container) return
    if (corner.startsWith('bottom')) container.insertBefore(element, container.firstChild)
    else container.appendChild(element)
  }

  /**
   * Takes a control out of the map.
   * @param {HTMLElement} element - The control element.
   */
  removeControl(element: HTMLElement): void {
    element.remove()
  }

  // ---- Teardown ----

  /**
   * Destroys the map, its listeners and its WebGL context.
   */
  remove(): void {
    if (this.removed) return
    this.stopAnimation()
    if (this.hoverFrame !== undefined) cancelAnimationFrame(this.hoverFrame)
    this.fireView({ type: 'remove' })
    this.removed = true
    this.cleanups.splice(0).forEach((cleanup) => cleanup())
    this.widget.destroy()
    this.container.querySelector('.cockpit-map-control-container')?.remove()
    this.container.classList.remove('cockpit-map')
  }
}

/**
 * Creates a flat Cesium map in Cockpit's terms, north-up unless asked to turn.
 * @param {HTMLElement} container - The element to draw the map into.
 * @param {CreateMapOptions} options - Initial view and behavior.
 * @returns {CockpitMap} The created map.
 */
export const createMap = (container: HTMLElement, options: CreateMapOptions): CockpitMap =>
  new CockpitMap(container, options)
