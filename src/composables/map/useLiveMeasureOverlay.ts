import L, { type Map as LeafletMap } from 'leaflet'
import { onBeforeUnmount } from 'vue'

import { formatBearing, formatMetersShort } from '@/libs/mission/general-estimates'

/** The segment the live measure draws, as the view resolved it for the pointer's current position. */
export interface LiveMeasureSegment {
  /** Where the segment starts. */
  from: L.LatLng
  /** Where the segment ends, which is where the next point would land. */
  to: L.LatLng
  /** Length of the segment, in meters. */
  distanceInMeters: number
  /** Bearing of the segment, in degrees clockwise from north. */
  bearingInDegrees: number
  /** Whether the tag is kept off the map, which is what leaves what it would cover readable. */
  hidesTag: boolean
  /** Whether the length was typed away, so the tag reads blank instead of the measure it was showing. */
  clearsLength: boolean
  /** Whether the tag takes presses, which it may only do when it is not sitting under the drawing pointer. */
  tagTakesPresses: boolean
}

/** Wiring {@link useLiveMeasureOverlay} needs from the view that draws the segment. */
export interface UseLiveMeasureOverlayOptions {
  /** Draws the segment again for a coordinate the map moving has put the pointer over. */
  redraw: (latlng: L.LatLng, containerPoint: L.Point) => void
  /** Where the cursor is on the page, in client coordinates. */
  cursorPosition: () => L.Point
  /** Where a point dragged out with a finger is waiting, so the measure ends there instead of at the cursor. */
  heldPoint: () => L.LatLng | null
  /** Reads back a press on the tag, which is how the extent field is asked for without a keyboard. */
  onTagPressed: () => void
  /** Reads back the tap that follows it, which is what a mobile browser raises its keyboard for. */
  onTagTapped: () => void
}

/** Return type of {@link useLiveMeasureOverlay}. */
export interface UseLiveMeasureOverlayReturn {
  /** Binds the overlay to a Leaflet map. */
  initLiveMeasure: (map: LeafletMap) => void
  /** Draws the segment, its loose end and the tag reading it back, creating the overlay on first use. */
  renderLiveMeasure: (segment: LiveMeasureSegment) => void
  /** Takes the whole overlay off the map. */
  clearLiveMeasure: () => void
  /** Moves the segment's start, saying whether there was an overlay on the map to move it on. */
  setLiveMeasureAnchor: (latlng: L.LatLng) => boolean
  /** Marks the tag as being typed into, which is what puts a caret in it. */
  setLiveMeasureTyping: (typing: boolean) => void
  /** Keeps the measure pinned to the pointer while the map moves under it, at most once a frame. */
  refreshLiveMeasureOnMapMove: () => void
  /** Clears the overlay and unbinds the map. */
  destroyLiveMeasure: () => void
}

/** The overlay's own nodes, held together so a render never has to check each one for itself. */
interface LiveMeasureElements {
  /** Container holding everything the overlay draws. */
  root: HTMLDivElement
  /** The dashed line running from the anchor to the segment's loose end. */
  line: SVGLineElement
  /** The dot marking that loose end, which is where a finger dragging the line is aiming. */
  endDot: SVGCircleElement
  /** The tag reading the measure back, which is also what a tap asks the extent field from. */
  tag: HTMLDivElement
  /** The length inside the tag, kept its own node so the caret can stand right after the digits. */
  length: HTMLSpanElement
  /** The unit and bearing trailing the length. */
  rest: HTMLSpanElement
}

const createSvgElement = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS('http://www.w3.org/2000/svg', tag)

const tagLabel = 'Type the distance'

/**
 * Draws the measure of the segment being drawn on a Leaflet map: a dashed line from the last point to where the
 * next one would land, a dot on that loose end, and a tag reading the length and bearing back. The tag doubles as
 * the way to ask for the extent field where there is no keyboard to press a shortcut on.
 * @param {UseLiveMeasureOverlayOptions} options - Where the pointer is, and what a press on the tag means.
 * @returns {UseLiveMeasureOverlayReturn} Methods to initialize, render, clear and tear down the overlay.
 */
export const useLiveMeasureOverlay = (options: UseLiveMeasureOverlayOptions): UseLiveMeasureOverlayReturn => {
  const { redraw, cursorPosition, heldPoint, onTagPressed, onTagTapped } = options

  let mapRef: LeafletMap | undefined
  let elements: LiveMeasureElements | null = null
  let refreshRafId: number | null = null
  let isTyping = false

  const initLiveMeasure = (map: LeafletMap): void => {
    mapRef = map
  }

  const buildOverlay = (map: LeafletMap): LiveMeasureElements => {
    const root = document.createElement('div')
    root.className = 'measure-overlay'
    root.style.pointerEvents = 'none'
    root.style.position = 'absolute'
    root.style.top = '0'
    root.style.left = '0'
    root.style.width = '100%'
    root.style.height = '100%'
    root.style.zIndex = '640'

    const svg = createSvgElement('svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.style.position = 'absolute'
    svg.style.top = '0'
    svg.style.left = '0'

    const line = createSvgElement('line')
    line.setAttribute('stroke-width', '2')
    line.setAttribute('stroke-dasharray', '10,10')
    line.setAttribute('opacity', '0.9')
    line.setAttribute('stroke', '#2563eb')

    // The loose end of the line is where the next point lands, and a finger dragging it needs to see where that is.
    const endDot = createSvgElement('circle')
    endDot.setAttribute('r', '5')
    endDot.setAttribute('fill', '#2563eb')
    endDot.setAttribute('stroke', '#FFFFFF')
    endDot.setAttribute('stroke-width', '2')

    svg.append(line, endDot)

    const tag = document.createElement('div')
    tag.className = 'live-measure-pill'
    tag.setAttribute('role', 'button')
    tag.setAttribute('aria-label', tagLabel)
    tag.title = tagLabel
    tag.style.position = 'absolute'
    tag.style.transform = 'translate(-50%, -50%)'
    tag.style.cursor = 'pointer'
    // Tapping the tag is how the field is asked for without a keyboard, so the tag owns its presses the way the
    // map's own controls do: the map is listening inside its container, and the tag is not a place to draw.
    L.DomEvent.disableClickPropagation(tag)
    // Taken on the press rather than on the click, which the browser aims wherever the tag has moved to by the
    // time a finger is lifted.
    tag.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      onTagPressed()
    })
    // Mobile browsers only raise their keyboard for a focus asked from the tap itself, which lands here.
    tag.addEventListener('click', onTagTapped)
    tag.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onTagPressed()
      onTagTapped()
    })

    // The caret stands right after the digits being typed, so the length and everything trailing it are their own
    // spans, written on each move instead of rebuilt.
    const length = document.createElement('span')
    length.className = 'measure-length'
    const rest = document.createElement('span')
    const caret = document.createElement('span')
    caret.className = 'measure-caret'
    tag.append(length, caret, rest)

    root.append(svg, tag)
    map.getContainer().appendChild(root)

    return { root, line, endDot, tag, length, rest }
  }

  const ensureOverlay = (map: LeafletMap): LiveMeasureElements => {
    elements ??= buildOverlay(map)
    return elements
  }

  const renderLiveMeasure = (segment: LiveMeasureSegment): void => {
    const map = mapRef
    if (!map) return

    const { line, endDot, tag, length, rest } = ensureOverlay(map)
    const from = map.latLngToContainerPoint(segment.from)
    const to = map.latLngToContainerPoint(segment.to)

    line.setAttribute('x1', String(from.x))
    line.setAttribute('y1', String(from.y))
    line.setAttribute('x2', String(to.x))
    line.setAttribute('y2', String(to.y))
    endDot.setAttribute('cx', String(to.x))
    endDot.setAttribute('cy', String(to.y))

    const [meters, unit] = formatMetersShort(segment.distanceInMeters).split(' ')
    length.textContent = segment.clearsLength ? '' : meters
    rest.textContent = `${unit ? ` ${unit}` : ''} · ${formatBearing(segment.bearingInDegrees)}`

    tag.style.left = `${(from.x + to.x) / 2}px`
    tag.style.top = `${(from.y + to.y) / 2}px`
    tag.style.display = segment.hidesTag ? 'none' : 'block'
    // The tag rides the segment's midpoint, so on a short segment it sits under the pointer drawing it, where an
    // interactive tag would take the presses and moves the map is owed.
    tag.style.pointerEvents = segment.tagTakesPresses ? 'auto' : 'none'
    tag.tabIndex = segment.tagTakesPresses ? 0 : -1
    tag.classList.toggle('typing', isTyping)
  }

  const clearLiveMeasure = (): void => {
    elements?.root.remove()
    elements = null
  }

  const setLiveMeasureAnchor = (latlng: L.LatLng): boolean => {
    const map = mapRef
    if (!map || !elements) return false

    const point = map.latLngToContainerPoint(latlng)
    elements.line.setAttribute('x1', String(point.x))
    elements.line.setAttribute('y1', String(point.y))
    return true
  }

  // Held here rather than only on the node, which a point placed from a typed distance takes off the map while
  // the field it was typed into stays open.
  const setLiveMeasureTyping = (typing: boolean): void => {
    isTyping = typing
    elements?.tag.classList.toggle('typing', isTyping)
  }

  // Guarded on the map rather than on the overlay's nodes, which a point placed from a typed distance takes off
  // the map and which the redraw is what puts back.
  const refreshLiveMeasureOnMapMove = (): void => {
    if (!mapRef || refreshRafId !== null) return

    refreshRafId = requestAnimationFrame(() => {
      refreshRafId = null
      const map = mapRef
      if (!map) return

      const rect = map.getContainer().getBoundingClientRect()
      const cursor = cursorPosition()
      // A finger leaves no cursor behind, so a point it dragged out and left waiting is where the measure ends.
      const held = heldPoint()
      const containerPoint = held
        ? map.latLngToContainerPoint(held)
        : L.point(cursor.x - rect.left, cursor.y - rect.top)
      redraw(held ?? map.containerPointToLatLng(containerPoint), containerPoint)
    })
  }

  const destroyLiveMeasure = (): void => {
    if (refreshRafId !== null) cancelAnimationFrame(refreshRafId)
    refreshRafId = null
    clearLiveMeasure()
    mapRef = undefined
  }

  onBeforeUnmount(destroyLiveMeasure)

  return {
    initLiveMeasure,
    renderLiveMeasure,
    clearLiveMeasure,
    setLiveMeasureAnchor,
    setLiveMeasureTyping,
    refreshLiveMeasureOnMapMove,
    destroyLiveMeasure,
  }
}
