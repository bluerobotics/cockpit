import { DirectiveBinding } from 'vue'

import type { Point2D } from '@/types/general'

/**
 * Context menu opener type
 */
export interface ContextMenu {
  /**
   * Open the context menu
   */
  open: (event: MouseEvent | TouchEvent) => void
  /**
   * Close the context menu
   */
  close: () => void
}

// Global reference to the currently open context menu opener
let currentContextMenu: {
  /**
   * Open/closes the context menu
   */
  close: () => void
} | null = null

const longPressDuration = 500
// How far a finger may wander and still count as held in place, in pixels.
const longPressMoveTolerance = 10
let touchTimer: ReturnType<typeof setTimeout> | null = null
let touchStartPoint: Point2D | null = null

const cancelLongPress = (): void => {
  if (touchTimer) {
    clearTimeout(touchTimer)
    touchTimer = null
  }
}

export const contextMenu = {
  mounted(el: HTMLElement, binding: DirectiveBinding<ContextMenu>) {
    const { value: opener } = binding

    if (typeof opener.open !== 'function' || typeof opener.close !== 'function') {
      console.warn('v-contextmenu-opener binding value must be an object with open and close functions')
      return
    }

    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      // If there is another open context menu (from a different element), close it.
      if (currentContextMenu && currentContextMenu !== opener) {
        currentContextMenu.close()
      }
      opener.open(event)
      currentContextMenu = opener
    }

    // A long press is one finger held still: a second finger (a pinch) or a moving one (a drag, a slider) cancels it.
    const onTouchStart = (event: TouchEvent): void => {
      cancelLongPress()
      if (event.touches.length > 1) return
      touchStartPoint = { x: event.touches[0].clientX, y: event.touches[0].clientY }
      touchTimer = setTimeout(() => {
        if (currentContextMenu && currentContextMenu !== opener) {
          currentContextMenu.close()
        }
        opener.open(event)
        currentContextMenu = opener
      }, longPressDuration)
    }

    const onTouchMove = (event: TouchEvent): void => {
      if (!touchTimer || !touchStartPoint) return
      const { clientX, clientY } = event.touches[0]
      const moved = Math.hypot(clientX - touchStartPoint.x, clientY - touchStartPoint.y)
      if (moved > longPressMoveTolerance) cancelLongPress()
    }

    const onTouchEnd = (): void => {
      cancelLongPress()
    }

    el.addEventListener('contextmenu', onContextMenu)
    // Passive, since neither cancels the touch: a blocking listener makes the browser wait on it before scrolling.
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    // Store the event listeners for cleanup.
    ;(el as any).__contextMenuHandlers = { onContextMenu, onTouchStart, onTouchMove, onTouchEnd }
  },

  unmounted(el: HTMLElement) {
    const handlers = (el as any).__contextMenuHandlers
    if (handlers) {
      el.removeEventListener('contextmenu', handlers.onContextMenu)
      el.removeEventListener('touchstart', handlers.onTouchStart)
      el.removeEventListener('touchmove', handlers.onTouchMove)
      el.removeEventListener('touchend', handlers.onTouchEnd)
      el.removeEventListener('touchcancel', handlers.onTouchEnd)
      delete (el as any).__contextMenuHandlers
    }
  },
}
