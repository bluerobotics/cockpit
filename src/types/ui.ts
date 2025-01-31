export type DialogOnQueue = {
  /**
   * Dialog Id
   */
  id: string
  /**
   * Component to be rendered
   */
  component: any
  /**
   * Props to be passed to the component
   */
  props?: Record<string, any>
}
