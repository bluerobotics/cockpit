import type { Point2D, SizeRect2D } from './general'

/**
 * Available components to be used in the Widget system
 * The enum value is equal to the component's filename, without the '.vue' extension
 */
export enum WidgetType {
  Attitude = 'Attitude',
  Compass = 'Compass',
  DepthHUD = 'DepthHUD',
  HudCompass = 'HudCompass',
  Indicators = 'Indicators',
  Joystick = 'Joystick',
  Map = 'Map',
  MissionInfo = 'MissionInfo',
  PowerBar = 'PowerBar',
  PowerSupply = 'PowerSupply',
  VideoPlayer = 'VideoPlayer',
  VideoRecorder = 'VideoRecorder',
  ImageViewer = 'ImageViewer',
}

export type Widget = {
  /**
   * Unique identifier for the widget
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
  /**
   * Editable name for the widget
   */
  name: string
  /**
   * Internal options of the widget
   */
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  /**
   * External variables used by the widget manager
   */
  managerVars: {
    /**
     * Number of times the widget was mounted
     */
    timesMounted: number
  }
}

export type Layer = {
  /**
   * Unique identifier for the layer
   */
  hash: string
  /**
   * Array of widgets that are stored in the layer
   */
  widgets: Widget[]
  /**
   * Editable name for the layer
   */
  name: string
}

export type Profile = {
  /**
   * Array of layers that are stored in the profile
   */
  layers: Layer[]
  /**
   * Editable name for the profile
   */
  name: string
}
