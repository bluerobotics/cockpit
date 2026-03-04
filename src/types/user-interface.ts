/**
 * Context menu
 */
export interface IContextMenu {
  /**
   * Close the context menu
   */
  handleClose: () => void
  /**
   * The position of the context menu
   */
  openAt: (event: MouseEvent | TouchEvent) => void
}

/**
 * Context Menu Item
 */
export interface ContextMenuItem {
  /**
   * The item name to display
   */
  item: string
  /**
   * The icon to display
   */
  icon?: string
  /**
   * The action to perform
   */
  action: () => void
}

/**
 * RGBA color object
 */
export interface RgbaColor extends Record<string, unknown> {
  /**
   * Red component (0-255)
   */
  r: number
  /**
   * Green component (0-255)
   */
  g: number
  /**
   * Blue component (0-255)
   */
  b: number
  /**
   * Alpha component (0-1)
   */
  a: number
}
