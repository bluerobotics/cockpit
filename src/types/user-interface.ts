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
 * Axis-aligned bounding box in screen-space pixels
 */
export type ScreenBounds = {
  /** Left edge of the bounding box in pixels */
  minX: number
  /** Top edge of the bounding box in pixels */
  minY: number
  /** Right edge of the bounding box in pixels */
  maxX: number
  /** Bottom edge of the bounding box in pixels */
  maxY: number
}
