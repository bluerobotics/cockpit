import { onBeforeUnmount } from 'vue'

import { type CockpitMap, boundsOf } from '@/libs/map/cesium-map'
import type { ScreenPoint } from '@/libs/map/survey-polygon-edges'

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
  /** Binds the extra box-zoom triggers to this map. */
  initMapBoxZoom: (map: CockpitMap) => void
  /** Unbinds the extra triggers. */
  destroyMapBoxZoom: () => void
}

// Above the 500ms context-menu long-press, so a half-second look then pan is still a pan.
const TOUCH_BOX_ARM_MS = 700
// Matches `longPressDuration` in `src/directives/contextMenu.ts`.
const CONTEXT_MENU_LONG_PRESS_MS = 500
// A pan starts at about 3px; a looser radius would arm after a pan had already begun.
const ARM_MOVE_CANCEL_PX = 3
const BOX_COMMIT_MIN_PX = 16
const CONTEXT_MENU_GRACE_MS = 200
const SWALLOW_CLICK_MS = 500
const IGNORE_TOUCH_PRESS = '.cockpit-map-marker, .cockpit-map-ctrl, .v-btn, button, .bottom-button'
const IGNORE_MIDDLE_PRESS = '.cockpit-map-ctrl, .v-btn, button, .bottom-button'

type BoxPhase = 'idle' | 'arming' | 'armed' | 'live'

const pointerClientInit = (event: PointerEvent): MouseEventInit => ({
  bubbles: true,
  cancelable: true,
  view: window,
  clientX: event.clientX,
  clientY: event.clientY,
  screenX: event.screenX,
  screenY: event.screenY,
})

const distanceBetween = (a: ScreenPoint, b: ScreenPoint): number => Math.hypot(a.x - b.x, a.y - b.y)

// Drawn the way Leaflet drew its zoom rectangle.
const createBoxElement = (): HTMLDivElement => {
  const box = document.createElement('div')
  box.className = 'cockpit-zoom-box'
  Object.assign(box.style, {
    position: 'absolute',
    zIndex: '800',
    boxSizing: 'border-box',
    border: '2px dotted #38f',
    background: 'rgba(255, 255, 255, 0.5)',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  return box
}

const contextMenuFromPointer = (event: PointerEvent): MouseEvent =>
  new MouseEvent('contextmenu', { ...pointerClientInit(event), button: 2, buttons: 0 })

const ignoredTarget = (event: Event, selector: string): boolean => {
  const target = event.target as HTMLElement | null
  return !!target?.closest?.(selector)
}

/**
 * Zooms the map to a rectangle drawn with a middle-click drag, or with a one-finger hold then drag, alongside the
 * map's own Shift-drag box zoom. A still release held past the context-menu delay opens the menu; a drag before the
 * arm delay pans.
 * @param {UseMapBoxZoomOptions} options Unfollow / block hooks from the view that owns the map.
 * @returns {UseMapBoxZoomReturn} Bind and unbind methods for the map instance.
 */
export const useMapBoxZoom = (options: UseMapBoxZoomOptions = {}): UseMapBoxZoomReturn => {
  let mapRef: CockpitMap | undefined
  const pointers = new Set<number>()
  let armTimer: ReturnType<typeof setTimeout> | undefined
  let pendingStart: ScreenPoint | undefined
  let pendingEvent: PointerEvent | undefined
  let gesturePointerId: number | undefined
  let weDisabledDragging = false
  let phase: BoxPhase = 'idle'
  let boxOrigin: ScreenPoint | undefined
  let boxElement: HTMLDivElement | undefined
  let boxEnd: ScreenPoint | undefined
  let suppressNextAuxClick = false
  let menuGraceTimer: ReturnType<typeof setTimeout> | undefined
  let pressStartedAt: number | undefined
  let swallowClickTimer: ReturnType<typeof setTimeout> | undefined
  let swallowClickTarget: HTMLElement | undefined
  let swallowClickHandler: ((clickEvent: Event) => void) | undefined

  const suppressContextMenu = (event: Event): void => {
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  const containerPoint = (event: PointerEvent): ScreenPoint | undefined =>
    mapRef ? mapRef.pointFromClient(event) : undefined

  const drawBox = (): void => {
    if (!boxElement || !boxOrigin || !boxEnd) return
    Object.assign(boxElement.style, {
      left: `${Math.min(boxOrigin.x, boxEnd.x)}px`,
      top: `${Math.min(boxOrigin.y, boxEnd.y)}px`,
      width: `${Math.abs(boxEnd.x - boxOrigin.x)}px`,
      height: `${Math.abs(boxEnd.y - boxOrigin.y)}px`,
    })
  }

  const startDrawnBox = (): void => {
    if (!mapRef) return
    boxElement = createBoxElement()
    mapRef.getContainer().appendChild(boxElement)
    mapRef.getCanvasContainer().style.cursor = 'crosshair'
    mapRef.getContainer().addEventListener('contextmenu', suppressContextMenu, true)
  }

  const removeDrawnBox = (): void => {
    boxElement?.remove()
    boxElement = undefined
    boxEnd = undefined
    if (mapRef) mapRef.getCanvasContainer().style.cursor = ''
  }

  const restoreDragging = (): void => {
    if (!weDisabledDragging || !mapRef) return
    weDisabledDragging = false
    mapRef.dragPan.enable()
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

  const boxClear = (): void => {
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
      removeDrawnBox()
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
    if (!weDisabledDragging && mapRef.dragPan.isEnabled()) {
      weDisabledDragging = true
      mapRef.dragPan.disable()
    }
    gesturePointerId = event.pointerId
    boxOrigin = containerPoint(event)
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
    startDrawnBox()
    phase = 'live'
    pendingStart = undefined
    pendingEvent = undefined
    options.onBoxStart?.()
  }

  const movedAtLeast = (event: PointerEvent, minPx: number): boolean => {
    const point = containerPoint(event)
    return !!pendingStart && !!point && distanceBetween(point, pendingStart) >= minPx
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
    pendingStart = containerPoint(event)
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
        boxEnd = containerPoint(event)
        drawBox()
      }
      return
    }
    if (phase !== 'live') return
    boxEnd = containerPoint(event)
    drawBox()
  }

  const finishLiveBox = (event: PointerEvent): void => {
    const end = containerPoint(event)
    const origin = boxOrigin
    const tooSmall =
      !origin ||
      !end ||
      (Math.abs(end.x - origin.x) < BOX_COMMIT_MIN_PX && Math.abs(end.y - origin.y) < BOX_COMMIT_MIN_PX)
    if (tooSmall || !mapRef) {
      boxClear()
      return
    }
    options.onBoxCommit?.()
    logUserAction('Zoomed the map to the drawn area')
    mapRef.fitBounds(boundsOf([mapRef.unproject(origin), mapRef.unproject(end)]))
    boxClear()
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

  const initMapBoxZoom = (map: CockpitMap): void => {
    destroyMapBoxZoom()
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
