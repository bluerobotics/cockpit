// A right press that moves farther than this is a drag, which turns a tiltable map, rather than a click.
const dragTolerancePixels = 3

/**
 * Tells right clicks from right drags on one element.
 */
export interface RightClickGate {
  /**
   * Runs `open` once a context menu request turns out to come from a click, and drops it when it came from a drag.
   * @param {MouseEvent | TouchEvent} event - The `contextmenu` event, or the touch that long-pressed.
   * @param {() => void} open - Opens the menu.
   */
  whenClick: (event: MouseEvent | TouchEvent, open: () => void) => void
  /** Stops watching the element. */
  dispose: () => void
}

/**
 * Tells a right click, which opens a context menu, from a right drag, which turns a tiltable map. Browsers raise
 * `contextmenu` on the press (macOS) or on the release (Windows, Linux), so a request made while the button is still
 * down waits for the release.
 * @param {HTMLElement} element - The element the right presses happen on.
 * @returns {RightClickGate} The gate.
 */
export const rightClickGate = (element: HTMLElement): RightClickGate => {
  let press: { /** Client x. */ x: number; /** Client y. */ y: number } | undefined
  // Ctrl+click is a right click on macOS, and Ctrl+drag turns the maps too.
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2 || event.ctrlKey) press = { x: event.clientX, y: event.clientY }
  }
  // Captured, as the maps cancel the presses on their canvas.
  element.addEventListener('pointerdown', onPointerDown, true)

  const wasClick = (event: MouseEvent): boolean => {
    const moved = press ? Math.hypot(event.clientX - press.x, event.clientY - press.y) : 0
    press = undefined
    return moved <= dragTolerancePixels
  }

  return {
    whenClick: (event, open) => {
      if (!(event instanceof MouseEvent)) return open()
      if (event.buttons === 0) {
        if (wasClick(event)) open()
        return
      }
      const onPointerUp = (release: PointerEvent): void => {
        window.removeEventListener('pointerup', onPointerUp)
        if (wasClick(release)) open()
      }
      window.addEventListener('pointerup', onPointerUp)
    },
    dispose: () => element.removeEventListener('pointerdown', onPointerDown, true),
  }
}
