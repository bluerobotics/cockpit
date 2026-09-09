import L, { type Map as LeafletMap } from 'leaflet'
import { onBeforeUnmount } from 'vue'

/** Wiring {@link useMapBoxZoom} needs from the view that owns the map. */
export interface UseMapBoxZoomOptions {
  /** Called when the rubber-band starts, so the map can claim the press (e.g. block the context menu). */
  onBoxStart?: () => void
  /** Called after a started box is cleared, so the press claim can be released. */
  onBoxEnd?: () => void
  /** Called just before the view zooms, so follow is dropped only when a zoom actually happens. */
  onBoxCommit?: () => void
  /** When true, a one-finger long-press is left to another handler. Middle-click is never blocked. */
  isBlocked?: () => boolean
}

/** Return type of {@link useMapBoxZoom}. */
export interface UseMapBoxZoomReturn {
  /** Hands the extra triggers to Leaflet's box-zoom handler on this map. */
  initMapBoxZoom: (map: LeafletMap) => void
  /** Unbinds the extra triggers. */
  destroyMapBoxZoom: () => void
}

const TOUCH_BOX_ARM_MS = 450
const ARM_MOVE_CANCEL_PX = 8
const IGNORE_PRESS = '.leaflet-marker-icon, .leaflet-control, .leaflet-interactive, .v-btn, button, .bottom-button'
// ponytail: Leaflet 1.9.3 BoxZoom has no public start API (pinned in package.json); if a bump drops these private handlers, init leaves the gesture unbound.
const LEAFLET_BOX_METHODS = [
  '_onMouseDown',
  '_onMouseMove',
  '_onMouseUp',
  '_onKeyDown',
  '_finish',
  '_clearDeferredResetState',
  '_resetState',
  'moved',
] as const

const canDriveLeafletBox = (map: LeafletMap): boolean => {
  const handler = map.boxZoom as Record<string, unknown> | undefined
  return !!handler && LEAFLET_BOX_METHODS.every((name) => typeof handler[name] === 'function')
}

const mouseFromPointer = (type: string, event: PointerEvent): MouseEvent =>
  new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    shiftKey: true,
    // button 1 (middle) is what Leaflet's BoxZoom guard accepts even when `which` is unset on a constructed event.
    button: 1,
    buttons: type === 'mouseup' ? 0 : 4,
  })

/**
 * Hands a middle-click drag, or a one-finger long-press then drag, to Leaflet's existing box-zoom handler.
 * @param {UseMapBoxZoomOptions} options Unfollow / block hooks from the view that owns the map.
 * @returns {UseMapBoxZoomReturn} Bind and unbind methods for the map instance.
 */
export const useMapBoxZoom = (options: UseMapBoxZoomOptions = {}): UseMapBoxZoomReturn => {
  let mapRef: LeafletMap | undefined
  const pointers = new Set<number>()
  let armTimer: ReturnType<typeof setTimeout> | undefined
  let pendingStart: L.Point | undefined
  let boxPointerId: number | undefined
  let weDisabledDragging = false
  let boxLive = false
  let boxOrigin: L.Point | undefined

  const leafletBox = (): any => mapRef?.boxZoom

  const ignoredTarget = (event: Event): boolean => {
    const target = event.target as HTMLElement | null
    return !!target?.closest?.(IGNORE_PRESS)
  }

  const suppressContextMenu = (event: Event): void => {
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  const startLeafletBox = (event: PointerEvent): void => {
    const handler = leafletBox()
    if (!handler || !mapRef) return
    handler._onMouseDown(mouseFromPointer('mousedown', event))
    // Drop the document listeners _onMouseDown just attached — we drive the rest from
    // pointers so a compatibility mouseup cannot fitBounds twice.
    L.DomEvent.off(
      document as unknown as HTMLElement,
      {
        contextmenu: L.DomEvent.stop,
        mousemove: handler._onMouseMove,
        mouseup: handler._onMouseUp,
        keydown: handler._onKeyDown,
      },
      handler
    )
    mapRef.getContainer().addEventListener('contextmenu', suppressContextMenu, true)
  }

  const abortLeafletBox = (): void => {
    const handler = leafletBox()
    if (!handler) return
    handler._finish()
    handler._clearDeferredResetState()
    handler._resetState()
  }

  const restoreDragging = (): void => {
    if (!weDisabledDragging || !mapRef) return
    weDisabledDragging = false
    mapRef.dragging.enable()
  }

  const boxClear = (): void => {
    if (armTimer !== undefined) {
      clearTimeout(armTimer)
      armTimer = undefined
    }
    pendingStart = undefined
    boxPointerId = undefined
    boxOrigin = undefined
    mapRef?.getContainer().removeEventListener('contextmenu', suppressContextMenu, true)
    if (boxLive) abortLeafletBox()
    restoreDragging()
    if (boxLive) {
      boxLive = false
      options.onBoxEnd?.()
    }
  }

  const startBox = (event: PointerEvent, liveEvent: boolean): void => {
    boxClear()
    if (!mapRef) return
    if (liveEvent) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    weDisabledDragging = mapRef.dragging.enabled()
    if (weDisabledDragging) mapRef.dragging.disable()
    boxPointerId = event.pointerId
    boxOrigin = mapRef.mouseEventToContainerPoint(event)
    try {
      mapRef.getContainer().setPointerCapture(event.pointerId)
    } catch {
      // Capture is best-effort; window listeners still finish the gesture.
    }
    startLeafletBox(event)
    boxLive = true
    options.onBoxStart?.()
  }

  const onPointerDown = (event: PointerEvent): void => {
    // A primary pointer arriving while another is still held means that one's release never came, so it is dropped
    // here rather than leaving the gesture switched off for good.
    if (event.isPrimary) pointers.clear()
    pointers.add(event.pointerId)
    if (pointers.size > 1) {
      boxClear()
      return
    }
    if (event.button === 1) {
      startBox(event, true)
      return
    }
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    // Only the long-press arm can steal a press that belongs to a control, a marker or a drawn shape; no control
    // in the tree acts on the middle button.
    if (ignoredTarget(event) || options.isBlocked?.()) return
    pendingStart = mapRef?.mouseEventToContainerPoint(event)
    armTimer = setTimeout(() => {
      armTimer = undefined
      if (!pendingStart || pointers.size !== 1) return
      startBox(event, false)
    }, TOUCH_BOX_ARM_MS)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (armTimer !== undefined && pendingStart && event.pointerId === [...pointers][0]) {
      const point = mapRef?.mouseEventToContainerPoint(event)
      if (point && point.distanceTo(pendingStart) >= ARM_MOVE_CANCEL_PX) boxClear()
      return
    }
    if (!boxLive || event.pointerId !== boxPointerId) return
    leafletBox()?._onMouseMove(mouseFromPointer('mousemove', event))
  }

  const onPointerUp = (event: PointerEvent): void => {
    pointers.delete(event.pointerId)
    if (armTimer !== undefined) {
      boxClear()
      return
    }
    if (!boxLive || event.pointerId !== boxPointerId) return
    const end = mapRef?.mouseEventToContainerPoint(event)
    const tooSmall =
      !boxOrigin ||
      !end ||
      (Math.abs(end.x - boxOrigin.x) < ARM_MOVE_CANCEL_PX && Math.abs(end.y - boxOrigin.y) < ARM_MOVE_CANCEL_PX)
    if (tooSmall) {
      boxClear()
      return
    }
    const handler = leafletBox()
    if (handler?.moved()) {
      options.onBoxCommit?.()
      logUserAction('Zoomed the map to the drawn area')
    }
    handler?._onMouseUp(mouseFromPointer('mouseup', event))
    mapRef?.getContainer().removeEventListener('contextmenu', suppressContextMenu, true)
    boxLive = false
    boxPointerId = undefined
    boxOrigin = undefined
    restoreDragging()
    options.onBoxEnd?.()
  }

  const onPointerCancel = (event: PointerEvent): void => {
    pointers.delete(event.pointerId)
    if (event.pointerId === boxPointerId || armTimer !== undefined) boxClear()
  }

  const onAuxClick = (event: MouseEvent): void => {
    if (event.button === 1) event.preventDefault()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || (!boxLive && armTimer === undefined)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (boxLive) logUserAction('Cancelled the map area zoom')
    boxClear()
  }

  // What a finger is allowed to do is settled when it goes down, so a `touch-action` written 450 ms later cannot
  // claim it back from the browser. Cancelling the moves themselves is what still works once the press is running.
  const onTouchMove = (event: TouchEvent): void => {
    if (boxLive && event.cancelable) event.preventDefault()
  }

  const initMapBoxZoom = (map: LeafletMap): void => {
    destroyMapBoxZoom()
    if (!canDriveLeafletBox(map)) return
    mapRef = map
    const mapEl = map.getContainer()
    mapEl.addEventListener('pointerdown', onPointerDown, true)
    mapEl.addEventListener('auxclick', onAuxClick, true)
    mapEl.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeyDown, true)
  }

  const destroyMapBoxZoom = (): void => {
    const mapEl = mapRef?.getContainer()
    boxClear()
    if (mapEl) {
      mapEl.removeEventListener('pointerdown', onPointerDown, true)
      mapEl.removeEventListener('auxclick', onAuxClick, true)
      mapEl.removeEventListener('touchmove', onTouchMove)
    }
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('keydown', onKeyDown, true)
    mapRef = undefined
  }

  onBeforeUnmount(destroyMapBoxZoom)

  return { initMapBoxZoom, destroyMapBoxZoom }
}
