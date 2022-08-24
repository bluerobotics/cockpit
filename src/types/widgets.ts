import type { Point2D, SizeRect2D } from './general'

/**
 * Available components to be used in the Widget system
 * The enum value is equal to the component's filename, without the '.vue' extension
 */
export enum WidgetType {
  Compass = 'Compass',
  Indicators = 'Indicators',
}

export type Widget = {
  /**
   * Unique identification of the widget
   */
  hash: string
  /**
   * Component type of the widget
   */
  component: WidgetType
  /**
   * 2D position of the widget (top-left corner)
   */
  position: Point2D
  /**
   * Size of the widget box
   */
  size: SizeRect2D
}

export type Layer = {
  /**
   *
   */
  hash: string
  /**
   *
   */
  widgets: Widget[]
}
