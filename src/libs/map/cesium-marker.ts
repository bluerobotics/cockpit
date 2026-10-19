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
  /** Whether the element turns with the map's north and lies on the map when it leans, rather than facing the screen. */
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
    const pitch = this.rotatesWithMap ? this.map.getPitch() : 0
    const [offsetX, offsetY] = this.offset
    this.element.style.transform =
      `translate(${point.x + offsetX}px, ${point.y + offsetY}px) translate(-50%, -50%)` +
      (pitch ? ` rotateX(${pitch}deg)` : '') +
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

/**
 * Options for {@link divIconMarker}, mirroring Leaflet's `divIcon`.
 */
export interface DivIconMarkerOptions {
  /** Inner HTML of the marker element. */
  html?: string
  /** Class names of the marker element, which carry its styling. */
  className?: string
  /** Element size, in pixels. */
  size: [number, number]
  /** Point of the element placed on the coordinate, in pixels from its top-left corner. Defaults to its center. */
  anchor?: [number, number]
  /** Whether the user can drag the marker. */
  draggable?: boolean
  /** Whether the element turns with a rotated map rather than staying upright. */
  rotatesWithMap?: boolean
}

const anchorOffset = (size: [number, number], anchor?: [number, number]): [number, number] => {
  const [width, height] = size
  const [anchorX, anchorY] = anchor ?? [width / 2, height / 2]
  return [width / 2 - anchorX, height / 2 - anchorY]
}

/**
 * A marker drawn as an HTML element of a given size, the way Leaflet's `divIcon` markers were.
 * @param {DivIconMarkerOptions} options - Element content, styling, size and anchor.
 * @returns {MapMarker} The marker, not yet on a map.
 */
export const divIconMarker = (options: DivIconMarkerOptions): MapMarker => {
  const element = document.createElement('div')
  if (options.className) element.classList.add(...options.className.split(/\s+/).filter(Boolean))
  if (options.html) element.innerHTML = options.html
  element.style.width = `${options.size[0]}px`
  element.style.height = `${options.size[1]}px`
  return new MapMarker({
    element,
    offset: anchorOffset(options.size, options.anchor),
    draggable: options.draggable ?? false,
    rotatesWithMap: options.rotatesWithMap,
  })
}

/**
 * Replaces the content and size of a marker created by {@link divIconMarker}, as Leaflet's `setIcon` did, while
 * keeping the element (and the listeners attached to it).
 * @param {MapMarker} marker - The marker to restyle.
 * @param {Omit<DivIconMarkerOptions, 'draggable' | 'className' | 'rotatesWithMap'>} options - The new content, size and
 *   anchor.
 */
export const setDivIcon = (
  marker: MapMarker,
  options: Omit<DivIconMarkerOptions, 'draggable' | 'className' | 'rotatesWithMap'>
): void => {
  const element = marker.getElement()
  element.innerHTML = options.html ?? ''
  element.style.width = `${options.size[0]}px`
  element.style.height = `${options.size[1]}px`
  marker.setOffset(anchorOffset(options.size, options.anchor))
}

/**
 * Where a tooltip opens relative to its marker. `auto` picks right or left, whichever side of the map center the
 * marker is not on, as Leaflet did.
 */
export type TooltipDirection = 'top' | 'right' | 'bottom' | 'left' | 'center' | 'auto'

const tooltipDirections = ['top', 'right', 'bottom', 'left', 'center'] as const

/**
 * Options for {@link bindTooltip}.
 */
export interface TooltipOptions {
  /** Extra class names for the tooltip element, which carry its styling. */
  className?: string
  /** Offset from the marker, in pixels. */
  offset?: [number, number]
  /** Side of the marker the tooltip opens on. Defaults to `auto`. */
  direction?: TooltipDirection
  /** Whether the tooltip is always shown, rather than only while the pointer is over the marker. */
  permanent?: boolean
  /** Initial opacity. */
  opacity?: number
}

/**
 * A tooltip attached to a marker, with ways to change it and to detach it.
 */
export interface MarkerTooltip {
  /** Replaces the tooltip content, whether or not it is shown. */
  setContent: (html: string) => void
  /** Changes the tooltip opacity. */
  setOpacity: (opacity: number) => void
  /** The tooltip element, which exists whether or not it is shown. */
  getElement: () => HTMLElement
  /** Removes the tooltip and its listeners. */
  remove: () => void
}

/**
 * Attaches a Leaflet-style tooltip to a marker: a plain element carrying the given class names, styled by the global
 * `.cockpit-tooltip` rules, drawn above the markers and never taking the pointer.
 * @param {CockpitMap} map - The map the marker is on.
 * @param {MapMarker} marker - The marker to attach to.
 * @param {string} html - The tooltip content.
 * @param {TooltipOptions} [options] - Styling, placement and permanence.
 * @returns {MarkerTooltip} Handle to update or detach the tooltip.
 */
export const bindTooltip = (
  map: CockpitMap,
  marker: MapMarker,
  html: string,
  options: TooltipOptions = {}
): MarkerTooltip => {
  const element = document.createElement('div')
  element.innerHTML = html
  element.classList.add('cockpit-tooltip', ...(options.className?.split(/\s+/).filter(Boolean) ?? []))
  const tooltip = new MapMarker({ element, opacity: options.opacity ?? 1 })
  let shown = false

  // Leaflet's Tooltip._setPosition: the offset is added on every side except an automatic flip to the left, which
  // mirrors it so the tooltip keeps the same distance from the marker. The arithmetic places the tooltip's corner,
  // and the marker it rides on is centered, hence the half sizes.
  const place = (): void => {
    let direction = options.direction ?? 'auto'
    let mirrored = false
    if (direction === 'auto') {
      const markerX = map.project(marker.getLatLng()).x
      direction = markerX < map.getContainer().clientWidth / 2 ? 'right' : 'left'
      mirrored = direction === 'left'
    }
    tooltipDirections.forEach((side) => element.classList.toggle(`cockpit-tooltip-${side}`, side === direction))
    const width = element.offsetWidth
    const height = element.offsetHeight
    const [offsetX, offsetY] = options.offset ?? [0, 0]
    const corner: Record<Exclude<TooltipDirection, 'auto'>, [number, number]> = {
      top: [-width / 2, -height],
      bottom: [-width / 2, 0],
      center: [-width / 2, -height / 2],
      right: [0, -height / 2],
      left: [mirrored ? -width - 2 * offsetX : -width, -height / 2],
    }
    const [x, y] = corner[direction]
    tooltip.setLatLng(marker.getLatLng()).setOffset([x + offsetX + width / 2, y + offsetY + height / 2])
  }
  const show = (): void => {
    if (!shown) tooltip.setLatLng(marker.getLatLng()).addTo(map)
    shown = true
    // Placement measures the element, which only has a size once it is on the map.
    place()
  }
  const hide = (): void => {
    tooltip.remove()
    shown = false
  }
  const follow = (): void => {
    if (shown) tooltip.setLatLng(marker.getLatLng())
  }

  const markerElement = marker.getElement()
  if (options.permanent) {
    show()
  } else {
    markerElement.addEventListener('mouseenter', show)
    markerElement.addEventListener('mouseleave', hide)
  }
  marker.on('drag', follow)
  // Keeps the tooltip on the marker when its owner moves it with setLatLng.
  const originalSetLatLng = marker.setLatLng.bind(marker)
  marker.setLatLng = (latLng) => {
    originalSetLatLng(latLng)
    follow()
    return marker
  }

  return {
    setContent: (newHtml) => {
      element.innerHTML = newHtml
      if (shown) place()
    },
    setOpacity: (opacity) => {
      tooltip.setOpacity(opacity)
    },
    getElement: () => element,
    remove: () => {
      markerElement.removeEventListener('mouseenter', show)
      markerElement.removeEventListener('mouseleave', hide)
      marker.off('drag', follow)
      marker.setLatLng = originalSetLatLng
      hide()
    },
  }
}
