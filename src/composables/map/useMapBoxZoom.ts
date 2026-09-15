import L, { type Map as LeafletMap } from 'leaflet'
import { onBeforeUnmount } from 'vue'

/** Wiring {@link useMapBoxZoom} needs from the view that owns the map. */
export interface UseMapBoxZoomOptions {
  /** Called when the rectangle starts, so the map can close the context menu and treat the press as a drag. */
  onBoxStart?: () => void
  /** Called after a claimed press ends, so the press claim can be released. */
  onBoxEnd?: () => void
  /** Called just before a box zooms, so follow is dropped. */
  onBoxCommit?: () => void
  /** When true, a one-finger long-press is left to another handler. Middle-click still respects the ignore-list. */
  isBlocked?: () => boolean
}

/** Return type of {@link useMapBoxZoom}. */
export interface UseMapBoxZoomReturn {
  /** Hands the extra triggers to Leaflet's box-zoom handler on this map. */
  initMapBoxZoom: (map: LeafletMap) => void
  /** Unbinds the extra triggers. */
  destroyMapBoxZoom: () => void
}

// Above the 500ms context-menu long-press, so a half-second look then pan is still a pan.
const TOUCH_BOX_ARM_MS = 700
// Matches `longPressDuration` in `src/directives/contextMenu.ts`.
const CONTEXT_MENU_LONG_PRESS_MS = 500
// Leaflet starts a pan at 3px; a looser radius would arm after a pan had already begun.
const ARM_MOVE_CANCEL_PX = 3
const BOX_COMMIT_MIN_PX = 16
const CONTEXT_MENU_GRACE_MS = 200
const SWALLOW_CLICK_MS = 500
const IGNORE_TOUCH_PRESS =
  '.leaflet-marker-icon, .leaflet-control, .leaflet-interactive, .v-btn, button, .bottom-button'
const IGNORE_MIDDLE_PRESS = '.leaflet-control, .v-btn, button, .bottom-button'
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

type BoxPhase = 'idle' | 'arming' | 'armed' | 'live'

const canDriveLeafletBox = (map: LeafletMap): boolean => {
  const handler = map.boxZoom as Record<string, unknown> | undefined
  return !!handler && LEAFLET_BOX_METHODS.every((name) => typeof handler[name] === 'function')
}

const pointerClientInit = (event: PointerEvent): MouseEventInit => ({
  bubbles: true,
  cancelable: true,
  view: window,
  clientX: event.clientX,
  clientY: event.clientY,
  screenX: event.screenX,
  screenY: event.screenY,
})

const mouseFromPointer = (type: string, event: PointerEvent): MouseEvent =>
  new MouseEvent(type, {
    ...pointerClientInit(event),
    shiftKey: true,
    // button 1 (middle) is what Leaflet's BoxZoom guard accepts even when `which` is unset on a constructed event.
    button: 1,
    buttons: type === 'mouseup' ? 0 : 4,
  })

const contextMenuFromPointer = (event: PointerEvent): MouseEvent =>
  new MouseEvent('contextmenu', { ...pointerClientInit(event), button: 2, buttons: 0 })

const ignoredTarget = (event: Event, selector: string): boolean => {
  const target = event.target as HTMLElement | null
  return !!target?.closest?.(selector)
}

/**
 * Hands a middle-click drag, or a one-finger hold then drag, to Leaflet's existing box-zoom handler.
 * A still release held past the context-menu delay opens the menu; a drag before the arm delay pans.
 * @param {UseMapBoxZoomOptions} options Unfollow / block hooks from the view that owns the map.
 * @returns {UseMapBoxZoomReturn} Bind and unbind methods for the map instance.
 */
export const useMapBoxZoom = (options: UseMapBoxZoomOptions = {}): UseMapBoxZoomReturn => {
  let mapRef: LeafletMap | undefined
  const pointers = new Set<number>()
  let armTimer: ReturnType<typeof setTimeout> | undefined
  let pendingStart: L.Point | undefined
  let pendingEvent: PointerEvent | undefined
  let gesturePointerId: number | undefined
  let weDisabledDragging = false
  let phase: BoxPhase = 'idle'
  let boxOrigin: L.Point | undefined
  let suppressNextAuxClick = false
  let menuGraceTimer: ReturnType<typeof setTimeout> | undefined
  let pressStartedAt: number | undefined
  let swallowClickTimer: ReturnType<typeof setTimeout> | undefined
  let swallowClickTarget: HTMLElement | undefined
  let swallowClickHandler: ((clickEvent: Event) => void) | undefined

  const leafletBox = (): any => mapRef?.boxZoom

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

  const dropContextMenuSuppress = (): void => {
    if (menuGraceTimer !== undefined) {
      clearTimeout(menuGraceTimer)
      menuGraceTimer = undefined
    }
    mapRef?.getContainer().removeEventListener('contextmenu', suppressContextMenu, true)
  }

  const keepContextMenuSuppress = (): void => {
    if (menuGraceTimer !== undefined) clearTimeout(menuGraceTimer)
    menuGraceTimer = setTimeout(() => {
      menuGraceTimer = undefined
      mapRef?.getContainer().removeEventListener('contextmenu', suppressContextMenu, true)
    }, CONTEXT_MENU_GRACE_MS)
  }

  const dropSwallowClick = (): void => {
    if (swallowClickTimer !== undefined) {
      clearTimeout(swallowClickTimer)
      swallowClickTimer = undefined
    }
    if (swallowClickTarget && swallowClickHandler) {
      swallowClickTarget.removeEventListener('click', swallowClickHandler, true)
    }
    swallowClickTarget = undefined
    swallowClickHandler = undefined
  }

  const openContextMenuFromPress = (mapEl: HTMLElement, event: PointerEvent): void => {
    dropSwallowClick()
    const swallow = (clickEvent: Event): void => {
      clickEvent.preventDefault()
      clickEvent.stopImmediatePropagation()
    }
    swallowClickHandler = swallow
    swallowClickTarget = mapEl
    mapEl.addEventListener('click', swallow, { capture: true, once: true })
    swallowClickTimer = setTimeout(() => {
      swallowClickTimer = undefined
      mapEl.removeEventListener('click', swallow, true)
      if (swallowClickHandler === swallow) {
        swallowClickTarget = undefined
        swallowClickHandler = undefined
      }
    }, SWALLOW_CLICK_MS)
    if (event.cancelable) event.preventDefault()
    mapEl.dispatchEvent(contextMenuFromPointer(event))
  }

  const boxClear = (committed = false): void => {
    if (armTimer !== undefined) {
      clearTimeout(armTimer)
      armTimer = undefined
    }
    const wasLive = phase === 'live'
    const wasOwned = phase !== 'idle'
    pendingStart = undefined
    pendingEvent = undefined
    gesturePointerId = undefined
    boxOrigin = undefined
    pressStartedAt = undefined
    phase = 'idle'
    if (wasLive) {
      if (!committed) abortLeafletBox()
      keepContextMenuSuppress()
    } else {
      dropContextMenuSuppress()
    }
    restoreDragging()
    if (wasOwned) options.onBoxEnd?.()
  }

  const claimPress = (event: PointerEvent, liveEvent: boolean): void => {
    if (!mapRef) return
    if (liveEvent) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    if (!weDisabledDragging && mapRef.dragging.enabled()) {
      weDisabledDragging = true
      mapRef.dragging.disable()
    }
    gesturePointerId = event.pointerId
    boxOrigin = mapRef.mouseEventToContainerPoint(event)
    try {
      mapRef.getContainer().setPointerCapture(event.pointerId)
    } catch {
      // Capture is best-effort; window listeners still finish the gesture.
    }
  }

  const startBox = (event: PointerEvent, liveEvent: boolean): void => {
    if (phase === 'armed' && options.isBlocked?.()) {
      boxClear()
      return
    }
    if (phase !== 'armed') boxClear()
    claimPress(event, liveEvent)
    if (!mapRef) return
    startLeafletBox(event)
    phase = 'live'
    pendingStart = undefined
    pendingEvent = undefined
    options.onBoxStart?.()
  }

  const movedAtLeast = (event: PointerEvent, minPx: number): boolean => {
    const point = mapRef?.mouseEventToContainerPoint(event)
    return !!pendingStart && !!point && point.distanceTo(pendingStart) >= minPx
  }

  const onPointerDown = (event: PointerEvent): void => {
    // A primary pointer arriving while another is still held means that one's release never came, so it is
    // cleared here — including the press claim — rather than leaving panning switched off for good.
    if (event.isPrimary && phase !== 'idle') boxClear()
    if (event.isPrimary) pointers.clear()
    pointers.add(event.pointerId)
    if (pointers.size > 1) {
      boxClear()
      return
    }
    if (event.button === 1) {
      if (ignoredTarget(event, IGNORE_MIDDLE_PRESS)) return
      suppressNextAuxClick = true
      startBox(event, true)
      return
    }
    suppressNextAuxClick = false
    if (ignoredTarget(event, IGNORE_TOUCH_PRESS)) return
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    if (options.isBlocked?.()) return
    pendingStart = mapRef?.mouseEventToContainerPoint(event)
    pendingEvent = event
    gesturePointerId = event.pointerId
    pressStartedAt = event.timeStamp
    phase = 'arming'
    mapRef?.getContainer().addEventListener('contextmenu', suppressContextMenu, true)
    options.onBoxStart?.()
    armTimer = setTimeout(() => {
      armTimer = undefined
      if (phase !== 'arming' || pointers.size !== 1 || !pendingEvent) return
      // A still hold that already opened the context menu belongs to the menu; the next slide is a pan.
      if (options.isBlocked?.()) {
        boxClear()
        return
      }
      claimPress(pendingEvent, false)
      phase = 'armed'
    }, TOUCH_BOX_ARM_MS)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== gesturePointerId) return
    if (phase === 'arming') {
      if (movedAtLeast(event, ARM_MOVE_CANCEL_PX)) boxClear()
      return
    }
    if (phase === 'armed') {
      if (movedAtLeast(event, BOX_COMMIT_MIN_PX)) {
        startBox(pendingEvent ?? event, false)
        if (event.cancelable) event.preventDefault()
        leafletBox()?._onMouseMove(mouseFromPointer('mousemove', event))
      }
      return
    }
    if (phase !== 'live') return
    leafletBox()?._onMouseMove(mouseFromPointer('mousemove', event))
  }

  const finishLiveBox = (event: PointerEvent): void => {
    const end = mapRef?.mouseEventToContainerPoint(event)
    const tooSmall =
      !boxOrigin ||
      !end ||
      (Math.abs(end.x - boxOrigin.x) < BOX_COMMIT_MIN_PX && Math.abs(end.y - boxOrigin.y) < BOX_COMMIT_MIN_PX)
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
    boxClear(true)
  }

  const onPointerUp = (event: PointerEvent): void => {
    pointers.delete(event.pointerId)
    if (event.pointerId !== gesturePointerId) return
    if (phase === 'arming' || phase === 'armed') {
      const mapEl = mapRef?.getContainer()
      const heldMs = event.timeStamp - (pressStartedAt ?? 0)
      boxClear()
      if (!mapEl || heldMs < CONTEXT_MENU_LONG_PRESS_MS) return
      openContextMenuFromPress(mapEl, event)
      return
    }
    if (phase === 'live') finishLiveBox(event)
  }

  const onPointerCancel = (event: PointerEvent): void => {
    pointers.delete(event.pointerId)
    if (event.pointerId !== gesturePointerId) return
    boxClear()
  }

  const onAuxClick = (event: MouseEvent): void => {
    if (event.button !== 1 || !suppressNextAuxClick) return
    event.preventDefault()
    suppressNextAuxClick = false
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || phase === 'idle') return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (phase === 'live') logUserAction('Cancelled the map area zoom')
    boxClear()
  }

  // What a finger is allowed to do is settled when it goes down, so a `touch-action` written after the arm delay
  // cannot claim it back from the browser. Cancelling the moves themselves is what still works once the press is running.
  const onTouchMove = (event: TouchEvent): void => {
    if ((phase === 'live' || phase === 'armed') && event.cancelable) event.preventDefault()
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
    dropContextMenuSuppress()
    dropSwallowClick()
    suppressNextAuxClick = false
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
