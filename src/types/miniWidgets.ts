/**
 * Available components to be used in the Mini Widget system
 * The enum value is equal to the component's filename, without the '.vue' extension
 */
export enum MiniWidgetType {
  ArmerButton = 'ArmerButton',
  BaseCommIndicator = 'BaseCommIndicator',
  DepthIndicator = 'DepthIndicator',
  ModeSelector = 'ModeSelector',
}

export type MiniWidget = {
  /**
   * Component type of the widget
   */
  component: MiniWidgetType
  /**
   * Internal options of the widget
   */
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  /**
   * External variables used by the widget manager
   */
}

export type MiniWidgetContainer = {
  /**
   * Array of widgets that are stored in the container
   */
  widgets: MiniWidget[]
  /**
   * Editable name for the container
   */
  name: string
}

export type MiniWidgetProfile = {
  /**
   * Array of layers that are stored in the profile
   */
  containers: MiniWidgetContainer[]
  /**
   * Editable name for the profile
   */
  name: string
}
