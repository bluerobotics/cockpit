import { DirectiveBinding } from 'vue'

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
let touchTimer: ReturnType<typeof setTimeout> | null = null

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

    const onTouchStart = (event: TouchEvent): void => {
      touchTimer = setTimeout(() => {
        if (currentContextMenu && currentContextMenu !== opener) {
          currentContextMenu.close()
        }
        opener.open(event)
        currentContextMenu = opener
      }, longPressDuration)
    }

    const onTouchEnd = (): void => {
      if (touchTimer) {
        clearTimeout(touchTimer)
        touchTimer = null
      }
    }

    el.addEventListener('contextmenu', onContextMenu)
    el.addEventListener('touchstart', onTouchStart)
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    // Store the event listeners for cleanup.
    ;(el as any).__contextMenuHandlers = { onContextMenu, onTouchStart, onTouchEnd }
  },

  unmounted(el: HTMLElement) {
    const handlers = (el as any).__contextMenuHandlers
    if (handlers) {
      el.removeEventListener('contextmenu', handlers.onContextMenu)
      el.removeEventListener('touchstart', handlers.onTouchStart)
      el.removeEventListener('touchend', handlers.onTouchEnd)
      el.removeEventListener('touchcancel', handlers.onTouchEnd)
      delete (el as any).__contextMenuHandlers
    }
  },
}
