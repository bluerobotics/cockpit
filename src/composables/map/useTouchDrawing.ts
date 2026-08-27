import L, { type Map as LeafletMap } from 'leaflet'
import { type ShallowRef, computed, onBeforeUnmount, shallowRef, watch } from 'vue'

import { isOverSurveyHandle } from '@/libs/map/survey-polygon-edges'

/** Wiring {@link useTouchDrawing} needs from the view that draws on the map. */
export interface UseTouchDrawingOptions {
  /** Whether a finger on the map is drawing, which is what leaves panning to a second one. */
  drawsWithOneFinger: () => boolean
  /** Names what a drag is settling right now, as the checkmark reads it out and the log records it. */
  confirmLabel: () => string
  /** Whether the segment being drawn already has a point to start from. */
  hasAnchor: () => boolean
  /** Whether another handler already took the press, so the map is left to it. */
  isBlocked: () => boolean
  /** Lays a point down where the drawing is, which is how the first drag plants the segment's start. */
  placePoint: (latlng: L.LatLng) => void
  /** Aims the drawing at a coordinate, the way a moving cursor would. */
  aimAt: (latlng: L.LatLng, event: PointerEvent) => void
}

/** Return type of {@link useTouchDrawing}. */
export interface UseTouchDrawingReturn {
  /** Where a finger left the live line, waiting to be confirmed, or null when nothing is waiting. */
  pendingPoint: ShallowRef<L.LatLng | null>
  /** Forgets the point that was waiting, taking its checkmark off the map. */
  clearPendingPoint: () => void
  /** Whether the click the browser may raise out of the last drag has to be dropped instead of drawn with. */
  swallowsClick: () => boolean
  /** Binds the gestures to a Leaflet map. */
  initTouchDrawing: (map: LeafletMap) => void
  /** Unbinds everything and gives panning back. */
  destroyTouchDrawing: () => void
}

// A press has to travel this far before it aims instead of tapping, which is what the edge drag asks of one too.
const dragThresholdInPixels = 4
// The checkmark stands off the point's diagonal, clear of the line ending there and of the finger that dragged it.
const confirmOffsetInPixels = 26
// Controls and handles that own their own presses, which a drawing gesture must not take from them.
const ownPressSelector = '.leaflet-marker-icon, .leaflet-control, .live-measure-pill, .touch-draw-confirm'

const confirmMarkup = `
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
    <circle cx="10" cy="10" r="9" fill="white" stroke="#3B82F6" stroke-width="2"/>
    <path d="M5.5 10.5L8.5 13.5L14.5 7" stroke="#3B82F6" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round"/>
  </svg>
`

/**
 * Draws with a finger: while a segment is being laid down, one finger on the map aims the line's loose end
 * instead of panning, panning is left to two fingers, and where the finger lets go waits under a checkmark
 * until it is confirmed, so it can be dragged again as many times as it takes.
 * @param {UseTouchDrawingOptions} options - What counts as drawing right now, and how to draw it.
 * @returns {UseTouchDrawingReturn} The point awaiting confirmation plus the methods to bind and unbind the map.
 */
export const useTouchDrawing = (options: UseTouchDrawingOptions): UseTouchDrawingReturn => {
  const { drawsWithOneFinger, confirmLabel, hasAnchor, isBlocked, placePoint, aimAt } = options

  const pendingPoint = shallowRef<L.LatLng | null>(null)
  const drawsNow = computed(drawsWithOneFinger)

  let mapRef: LeafletMap | undefined
  let confirmEl: HTMLDivElement | null = null
  let pressedPointerId: number | null = null
  let pressOrigin: L.Point | null = null
  let isAiming = false
  let aimedWithoutClick = false
  let panningWasEnabled = false

  const positionConfirm = (): void => {
    if (!mapRef || !confirmEl || !pendingPoint.value) return

    const { x, y } = mapRef.latLngToContainerPoint(pendingPoint.value)
    confirmEl.style.left = `${x + confirmOffsetInPixels}px`
    confirmEl.style.top = `${y - confirmOffsetInPixels}px`
  }

  const clearPendingPoint = (): void => {
    pendingPoint.value = null
    if (confirmEl) confirmEl.style.display = 'none'
  }

  const confirmPendingPoint = (): void => {
    const point = pendingPoint.value
    if (!point) return

    logUserAction(`Confirmed the ${confirmLabel()} dragged out on the map`)
    clearPendingPoint()
    placePoint(point)
  }

  const ensureConfirm = (map: LeafletMap): HTMLDivElement => {
    if (confirmEl) return confirmEl

    const el = document.createElement('div')
    el.className = 'touch-draw-confirm'
    el.setAttribute('role', 'button')
    el.innerHTML = confirmMarkup
    el.style.position = 'absolute'
    el.style.zIndex = '641'
    el.style.transform = 'translate(-50%, -50%)'
    el.style.cursor = 'pointer'
    el.style.display = 'none'
    // The map is listening for a click on everything inside its container, and this one is not a place to draw.
    L.DomEvent.disableClickPropagation(el)
    el.addEventListener('click', confirmPendingPoint)
    map.getContainer().appendChild(el)

    confirmEl = el
    return el
  }

  const holdPointForConfirmation = (latlng: L.LatLng): void => {
    if (!mapRef) return

    pendingPoint.value = latlng
    const el = ensureConfirm(mapRef)
    const label = `Confirm the ${confirmLabel()}`
    el.setAttribute('aria-label', label)
    el.title = label
    el.style.display = 'block'
    positionConfirm()
  }

  const restorePanning = (): void => {
    if (!panningWasEnabled) return

    panningWasEnabled = false
    mapRef?.dragging.enable()
  }

  // With its own dragging switched off, leaflet leaves the container free to be panned as a page instead, which
  // ends the gesture the line is being aimed with. The browser is told to keep its hands off it while it lasts,
  // the same way leaflet does when it is panning the map itself.
  const applyTouchAction = (): void => {
    const container = mapRef?.getContainer()
    if (container) container.style.touchAction = drawsNow.value ? 'none' : ''
  }

  const stopPress = (): void => {
    const container = mapRef?.getContainer()
    if (pressedPointerId !== null && container?.hasPointerCapture(pressedPointerId)) {
      container.releasePointerCapture(pressedPointerId)
    }
    pressedPointerId = null
    pressOrigin = null
    isAiming = false
    restorePanning()
  }

  const onPointerDown = (event: PointerEvent): void => {
    aimedWithoutClick = false
    // A second finger means the map's own pinch and pan, so the first one stops aiming and leaves the line where
    // it got to. Panning is given back by that finger's own release, not by this one.
    if (!event.isPrimary) {
      pressOrigin = null
      isAiming = false
      return
    }
    // A first finger arriving while one is still held means the last gesture's release never came, so it is closed
    // out here rather than leaving panning switched off for good.
    if (pressedPointerId !== null) stopPress()

    const pressedOn = event.target as HTMLElement | null
    const ownedElsewhere = isBlocked() || isOverSurveyHandle(pressedOn) || !!pressedOn?.closest?.(ownPressSelector)
    if (!mapRef || event.pointerType === 'mouse' || !drawsNow.value || ownedElsewhere) return

    clearPendingPoint()
    pressedPointerId = event.pointerId
    pressOrigin = mapRef.mouseEventToContainerPoint(event)
    isAiming = false
    // The gesture has to be read to its end even when the finger wanders off the map, which is also what keeps
    // its release from going missing and leaving panning switched off.
    mapRef.getContainer().setPointerCapture(event.pointerId)
    panningWasEnabled = mapRef.dragging.enabled()
    if (panningWasEnabled) mapRef.dragging.disable()
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!mapRef || pressedPointerId !== event.pointerId || !pressOrigin) return

    const containerPoint = mapRef.mouseEventToContainerPoint(event)
    if (!isAiming) {
      if (containerPoint.distanceTo(pressOrigin) < dragThresholdInPixels) return
      isAiming = true
      // A segment has to start somewhere, so the spot the finger went down on becomes it.
      if (!hasAnchor()) placePoint(mapRef.containerPointToLatLng(pressOrigin))
      logUserAction('Dragged the live line out with a finger')
    }

    aimAt(mapRef.containerPointToLatLng(containerPoint), event)
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (pressedPointerId !== event.pointerId) return

    const aimedAt = isAiming && mapRef ? mapRef.containerPointToLatLng(mapRef.mouseEventToContainerPoint(event)) : null
    stopPress()
    if (!aimedAt) return

    aimedWithoutClick = true
    holdPointForConfirmation(aimedAt)
  }

  const initTouchDrawing = (map: LeafletMap): void => {
    mapRef = map
    applyTouchAction()
    const container = map.getContainer()
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointercancel', onPointerUp)
    map.on('move zoom', positionConfirm)
  }

  const destroyTouchDrawing = (): void => {
    const container = mapRef?.getContainer()
    stopPress()
    clearPendingPoint()
    if (container) {
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', onPointerUp)
      container.style.touchAction = ''
    }
    mapRef?.off('move zoom', positionConfirm)
    confirmEl?.remove()
    confirmEl = null
    mapRef = undefined
  }

  watch(drawsNow, (draws) => {
    applyTouchAction()
    // Nothing is being drawn any more, so a point still waiting to be confirmed has nothing left to belong to.
    if (!draws) clearPendingPoint()
  })
  onBeforeUnmount(destroyTouchDrawing)

  return {
    pendingPoint,
    clearPendingPoint,
    // Kept until the next press rather than for a while, since a drag the browser raises no click out of would
    // otherwise leave the tap after it to be swallowed.
    swallowsClick: () => aimedWithoutClick,
    initTouchDrawing,
    destroyTouchDrawing,
  }
}
