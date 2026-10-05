import type { CockpitMap } from '@/libs/map/cesium-map'
import type { WaypointCoordinates } from '@/types/mission'

/** Options for {@link MapMarker}. */
export interface MapMarkerOptions {
  /** The element drawn at the marker's coordinate. Defaults to an empty `div`. */
  element?: HTMLElement
  /** Offset of the element's center from the coordinate, in pixels. */
  offset?: [number, number]
  /** Whether the user can drag the marker. */
  draggable?: boolean
  /** Rotation of the element, in degrees clockwise. */
  rotation?: number
  /** Whether the rotation is relative to the map's north rather than the screen's top. */
  rotatesWithMap?: boolean
  /** Opacity of the element. */
  opacity?: number
}

/** Names of the events a marker raises. */
export type MapMarkerEventType = 'dragstart' | 'drag' | 'dragend'

// A press that moves farther than this is a drag, as on the map itself.
const dragTolerancePixels = 3

/**
 * An HTML element pinned to a coordinate of a {@link CockpitMap}, centered on it.
 * Cesium draws no HTML, so the map repositions its markers after every frame it renders.
 */
export class MapMarker {
  private readonly element: HTMLElement
  private latLng: WaypointCoordinates = [0, 0]
  private offset: [number, number]
  private rotation: number
  private readonly rotatesWithMap: boolean
  private draggable: boolean
  private map: CockpitMap | undefined
  private readonly handlers = new Map<MapMarkerEventType, Set<() => void>>()
  private dragging = false

  /**
   * Creates a marker, not yet on a map.
   * @param {MapMarkerOptions} [options] - Element, offset, rotation, opacity and dragging.
   */
  constructor(options: MapMarkerOptions = {}) {
    this.element = options.element ?? document.createElement('div')
    this.offset = options.offset ?? [0, 0]
    this.rotation = options.rotation ?? 0
    this.rotatesWithMap = options.rotatesWithMap ?? false
    this.draggable = options.draggable ?? false
    this.element.classList.add('cockpit-map-marker')
    if (options.opacity !== undefined) this.element.style.opacity = String(options.opacity)
    this.element.addEventListener('mousedown', this.onPress)
  }

  /**
   * The marker's element.
   * @returns {HTMLElement} The element.
   */
  getElement(): HTMLElement {
    return this.element
  }

  /**
   * The coordinate the marker is pinned to.
   * @returns {WaypointCoordinates} The `[latitude, longitude]`.
   */
  getLatLng(): WaypointCoordinates {
    return this.latLng
  }

  /**
   * Pins the marker to a coordinate.
   * @param {WaypointCoordinates} latLng - The `[latitude, longitude]`.
   * @returns {MapMarker} The marker.
   */
  setLatLng(latLng: WaypointCoordinates): this {
    this.latLng = [latLng[0], latLng[1]]
    this.updatePosition()
    return this
  }

  /**
   * Moves the element relative to its coordinate.
   * @param {[number, number]} offset - Offset of the element's center, in pixels.
   * @returns {MapMarker} The marker.
   */
  setOffset(offset: [number, number]): this {
    this.offset = offset
    this.updatePosition()
    return this
  }

  /**
   * Turns the element.
   * @param {number} rotation - Degrees clockwise.
   * @returns {MapMarker} The marker.
   */
  setRotation(rotation: number): this {
    this.rotation = rotation
    this.updatePosition()
    return this
  }

  /**
   * Changes the element's opacity.
   * @param {number | string} opacity - The CSS opacity.
   * @returns {MapMarker} The marker.
   */
  setOpacity(opacity: number | string): this {
    this.element.style.opacity = String(opacity)
    return this
  }

  /**
   * Lets the user drag the marker, or stops letting them.
   * @param {boolean} draggable - Whether it can be dragged.
   * @returns {MapMarker} The marker.
   */
  setDraggable(draggable: boolean): this {
    this.draggable = draggable
    return this
  }

  /**
   * Whether the user can drag the marker.
   * @returns {boolean} True when it can be dragged.
   */
  isDraggable(): boolean {
    return this.draggable
  }

  /**
   * Shows the marker on a map.
   * @param {CockpitMap} map - The map to show it on.
   * @returns {MapMarker} The marker.
   */
  addTo(map: CockpitMap): this {
    if (this.map === map) return this
    this.remove()
    this.map = map
    map.markerPane.appendChild(this.element)
    map.addMarker(this)
    this.updatePosition()
    return this
  }

  /**
   * Takes the marker off its map.
   * @returns {MapMarker} The marker.
   */
  remove(): this {
    this.map?.removeMarker(this)
    this.map = undefined
    this.element.remove()
    return this
  }

  /**
   * Listens to a marker event.
   * @param {MapMarkerEventType} type - The event name.
   * @param {() => void} handler - The handler.
   * @returns {MapMarker} The marker.
   */
  on(type: MapMarkerEventType, handler: () => void): this {
    const set = this.handlers.get(type) ?? new Set()
    set.add(handler)
    this.handlers.set(type, set)
    return this
  }

  /**
   * Stops listening to a marker event.
   * @param {MapMarkerEventType} type - The event name.
   * @param {() => void} handler - The handler.
   * @returns {MapMarker} The marker.
   */
  off(type: MapMarkerEventType, handler: () => void): this {
    this.handlers.get(type)?.delete(handler)
    return this
  }

  /**
   * Places the element over its coordinate. The map calls this after each frame it renders.
   */
  updatePosition(): void {
    if (!this.map) return
    const point = this.map.project(this.latLng)
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      this.element.style.visibility = 'hidden'
      return
    }
    this.element.style.visibility = ''
    const rotation = this.rotatesWithMap ? this.rotation - this.map.getBearing() : this.rotation
    const [offsetX, offsetY] = this.offset
    this.element.style.transform =
      `translate(${point.x + offsetX}px, ${point.y + offsetY}px) translate(-50%, -50%)` +
      (rotation ? ` rotate(${rotation}deg)` : '')
  }

  /**
   * Calls the handlers of a marker event.
   * @param {MapMarkerEventType} type - The event name.
   */
  private fire(type: MapMarkerEventType): void {
    this.handlers.get(type)?.forEach((handler) => handler())
  }

  // Dragging follows the primary button only and ends on a release anywhere, as Leaflet's markers did.
  private readonly onPress = (press: MouseEvent): void => {
    if (!this.draggable || !this.map || press.button !== 0) return
    const map = this.map
    const start = map.pointFromClient(press)
    const anchor = map.project(this.latLng)
    const grab = { x: start.x - anchor.x, y: start.y - anchor.y }
    const panWasEnabled = map.dragPan.isEnabled()
    map.dragPan.disable()

    const move = (event: MouseEvent): void => {
      const point = map.pointFromClient(event)
      if (!this.dragging) {
        if (Math.hypot(point.x - start.x, point.y - start.y) <= dragTolerancePixels) return
        this.dragging = true
        this.fire('dragstart')
      }
      this.setLatLng(map.unproject({ x: point.x - grab.x, y: point.y - grab.y }))
      this.fire('drag')
    }
    const release = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', release)
      if (panWasEnabled) map.dragPan.enable()
      if (!this.dragging) return
      this.dragging = false
      this.fire('dragend')
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', release)
  }
}
