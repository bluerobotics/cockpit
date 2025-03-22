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
