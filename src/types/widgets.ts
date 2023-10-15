import type { Point2D, SizeRect2D } from './general'
import type { MiniWidgetContainer } from './miniWidgets'

/**
 * Available components to be used in the Widget system
 * The enum value is equal to the component's filename, without the '.vue' extension
 */
export enum WidgetType {
  Attitude = 'Attitude',
  Compass = 'Compass',
  DepthHUD = 'DepthHUD',
  CompassHUD = 'CompassHUD',
  IFrame = 'IFrame',
  ImageViewer = 'ImageViewer',
  Indicators = 'Indicators',
  Map = 'Map',
  MiniWidgetsBar = 'MiniWidgetsBar',
  VideoPlayer = 'VideoPlayer',
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
    /**
     * If the configuration menu is open or not
     */
    configMenuOpen: boolean
    /**
     * If the widget should be allowed to move
     */
    allowMoving: boolean
    /**
     * Last widget X position when it wasn't maximized
     */
    lastNonMaximizedX: number
    /**
     * Last widget Y position when it wasn't maximized
     */
    lastNonMaximizedY: number
    /**
     * Last widget width when it wasn't maximized
     */
    lastNonMaximizedWidth: number
    /**
     * Last widget height when it wasn't maximized
     */
    lastNonMaximizedHeight: number
  }
}

export type View = {
  /**
   * Unique identifier for the view
   */
  hash: string
  /**
   * Array of widgets that are stored in the view
   */
  widgets: Widget[]
  /**
   * Array of mini-widget containers associated with this view.
   * Mainly used for storing the configuration of the mini-widgets in the bottom bar.
   */
  miniWidgetContainers: MiniWidgetContainer[]
  /**
   * Editable name for the view
   */
  name: string
}

export type Profile = {
  /**
   * Unique identifier for the profile
   */
  hash: string
  /**
   * Array of views that are stored in the profile
   */
  views: View[]
  /**
   * Editable name for the profile
   */
  name: string
}

export const isWidget = (maybeWidget: Widget): maybeWidget is Widget => {
  const widgetProps = ['hash', 'component', 'position', 'size', 'name', 'options', 'managerVars']
  const managetVarsProps = ['timesMounted']
  let realWidget = true
  widgetProps.forEach((p) => {
    // @ts-ignore
    if (maybeWidget[p] !== undefined) return
    realWidget = false
  })
  if (maybeWidget['managerVars'] === undefined) {
    return false
  }
  managetVarsProps.forEach((p) => {
    // @ts-ignore
    if (maybeWidget['managerVars'][p] !== undefined) return
    realWidget = false
  })
  return realWidget
}

export const isView = (maybeView: View): maybeView is View => {
  let widgetsAreReal = true
  if (!Array.isArray(maybeView.widgets)) {
    return false
  }
  maybeView.widgets.forEach((w) => {
    if (isWidget(w)) return
    widgetsAreReal = false
  })
  return maybeView.name !== undefined && maybeView.hash !== undefined && widgetsAreReal
}

export const isProfile = (maybeProfile: Profile): maybeProfile is Profile => {
  let viewsAreReal = true
  if (!Array.isArray(maybeProfile.views)) {
    return false
  }
  maybeProfile.views.forEach((l) => {
    if (isView(l)) return
    viewsAreReal = false
  })
  return maybeProfile.name !== undefined && viewsAreReal
}
