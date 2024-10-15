import { CockpitAction } from '@/libs/joystick/protocols/cockpit-actions'

import type { Point2D, SizeRect2D } from './general'

/**
 * Available components to be used in the Widget system
 * The enum value is equal to the component's filename, without the '.vue' extension
 */
export enum WidgetType {
  Attitude = 'Attitude',
  Compass = 'Compass',
  CompassHUD = 'CompassHUD',
  CustomWidgetBase = 'CustomWidgetBase',
  DepthHUD = 'DepthHUD',
  IFrame = 'IFrame',
  ImageView = 'ImageView',
  Map = 'Map',
  MiniWidgetsBar = 'MiniWidgetsBar',
  URLVideoPlayer = 'URLVideoPlayer',
  VideoPlayer = 'VideoPlayer',
  VirtualHorizon = 'VirtualHorizon',
}

/**
 * Available components to be used in the Mini Widget system
 * The enum value is equal to the component's filename, without the '.vue' extension
 */
export enum MiniWidgetType {
  Alerter = 'Alerter',
  ArmerButton = 'ArmerButton',
  BaseCommIndicator = 'BaseCommIndicator',
  BatteryIndicator = 'BatteryIndicator',
  ChangeAltitudeCommander = 'ChangeAltitudeCommander',
  Clock = 'Clock',
  DepthIndicator = 'DepthIndicator',
  MissionIdentifier = 'MissionIdentifier',
  RelativeAltitudeIndicator = 'RelativeAltitudeIndicator',
  TakeoffLandCommander = 'TakeoffLandCommander',
  VeryGenericIndicator = 'VeryGenericIndicator',
  JoystickCommIndicator = 'JoystickCommIndicator',
  MiniVideoRecorder = 'MiniVideoRecorder',
  ModeSelector = 'ModeSelector',
  SatelliteIndicator = 'SatelliteIndicator',
  ViewSelector = 'ViewSelector',
}

/**
 * Available elements to be used in the Custom Widget creator.
 * The enum value is equal to the component's filename, without the '.vue' extension
 */
export enum CustomWidgetElementType {
  Button = 'Button',
  Checkbox = 'Checkbox',
  Dial = 'Dial',
  Dropdown = 'Dropdown',
  Label = 'Label',
  Slider = 'Slider',
  Switch = 'Switch',
}

/**
 *
 */
export enum CustomWidgetVarsType {
  Button = 'boolean',
  Checkbox = 'boolean',
  Dial = 'number',
  Dropdown = 'string',
  Label = 'string',
  Slider = 'number',
  Switch = 'boolean',
}

/**
 *
 */
export enum CustomWidgetElementContainers {
  Left0 = '0-left',
  Left1 = '1-left',
  Left2 = '2-left',
  Left3 = '3-left',
  Left4 = '4-left',
  Left5 = '5-left',
  Left6 = '6-left',
  Left7 = '7-left',
  Left8 = '8-left',
  Left9 = '9-left',
  Right0 = '0-right',
  Right1 = '1-right',
  Right2 = '2-right',
  Right3 = '3-right',
  Right4 = '4-right',
  Right5 = '5-right',
  Right6 = '6-right',
  Right7 = '7-right',
  Right8 = '8-right',
  Right9 = '9-right',
}

/**
 * Options for the Custom Widgets inner elements
 */
export type CustomWidgetElementOptions = {
  /**
   *
   */
  [CustomWidgetElementType.Label]: {
    /**
     * Element hash
     */
    hash: string
    /**
     *
     */
    name: string
    /**
     *
     */
    options: {
      /**
       *
       */
      cockpitAction: CockpitAction
      /**
       * The label text
       */
      text: string
      /**
       * The size of the label's font (in pixels)
       */
      textSize: number
      /**
       * Alignment of the element
       */
      align: 'start' | 'center' | 'end'
      /**
       * The weight of the label's font
       */
      weight: 'normal' | 'bold' | 'bolder' | 'lighter'
      /**
       * The decoration for the label's text
       */
      decoration: 'none' | 'underline' | 'line-through' | 'overline'
      /**
       * The color of the label's text
       */
      color: string
    }
  }
  /**
   *
   */
  [CustomWidgetElementType.Button]: {
    /**
     * Element hash
     */
    hash: string
    /**
     *
     */
    name: string
    /**
     *
     */
    options: {
      /**
       *
       */
      cockpitAction: CockpitAction
      /**
       * Alignment of the element
       */
      align: 'start' | 'center' | 'end'
      /**
       *
       */
      label: string
      /**
       *
       */
      buttonSize: 'small' | 'default' | 'large'
      /**
       *
       */
      backgroundColor: string
      /**
       *
       */
      textColor: string
      /**
       *
       */
      variant: 'text' | 'outlined' | 'flat' | 'elevated' | 'tonal' | 'plain'
    }
  }
  /**
   *
   */
  [CustomWidgetElementType.Checkbox]: {
    /**
     * Element hash
     */
    hash: string
    /**
     *
     */
    name: string
    /**
     *
     */
    options: {
      /**
       *
       */
      cockpitAction: CockpitAction
      /**
       * Alignment of the element
       */
      align: 'start' | 'center' | 'end'
      /**
       *
       */
      checked: boolean
      /**
       *
       */
      color: string
      /**
       *
       */
      label: string
    }
  }
  /**
   *
   */
  [CustomWidgetElementType.Dial]: {
    /**
     * Element hash
     */
    hash: string
    /**
     *
     */
    name: string
    /**
     *
     */
    options: {
      /**
       *
       */
      cockpitAction: CockpitAction
      /**
       * Alignment of the element
       */
      align: 'start' | 'center' | 'end'
      /**
       *
       */
      size: 'small' | 'medium' | 'large'
      /**
       *
       */
      color: string
      /**
       *
       */
      minValue: number
      /**
       *
       */
      maxValue: number
      /**
       *
       */
      showValue: boolean
    }
  }
  /**
   *
   */
  [CustomWidgetElementType.Dropdown]: {
    /**
     * Element hash
     */
    hash: string
    /**
     *
     */
    name: string
    /**
     *
     */
    options: {
      /**
       *
       */
      cockpitAction: CockpitAction
      /**
       * Alignment of the element
       */
      align: 'start' | 'center' | 'end'
      /**
       *
       */
      options: string[]
    }
  }
  /**
   *
   */
  [CustomWidgetElementType.Slider]: {
    /**
     * Element hash
     */
    hash: string
    /**
     *
     */
    name: string
    /**
     *
     */
    options: {
      /**
       *
       */
      cockpitAction: CockpitAction
      /**
       * Alignment of the element
       */
      align: 'start' | 'center' | 'end'
      /**
       *
       */
      size: 'small' | 'medium' | 'large'
      /**
       *
       */
      color: string
      /**
       *
       */
      minValue: number
      /**
       *
       */
      maxValue: number
      /**
       *
       */
      showValue: boolean
      /**
       *
       */
      label: string
      /**
       *
       */
      labelWidth: number
    }
  }
  /**
   *
   */
  [CustomWidgetElementType.Switch]: {
    /**
     * Element hash
     */
    hash: string
    /**
     *
     */
    name: string
    /**
     *
     */
    options: {
      /**
       *
       */
      cockpitAction: CockpitAction
      /**
       * Alignment of the element
       */
      align: 'start' | 'center' | 'end'
      /**
       *
       */
      size: 'small' | 'medium' | 'large'
      /**
       *
       */
      color: string
      /**
       *
       */
      label: string
    }
  }
}

/**
 * External variables used by the widget manager
 */
export type WidgetManagerVars = {
  /**
   * Number of times the widget was mounted
   */
  everMounted: boolean
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
  /**
   * Wether thewidget should be highlited or not
   */
  highlighted: boolean
  /**
   * Wether the widget should be resized according to te window size
   */
  disableResponsiveness: boolean
}

/**
 * External variables used by the widget manager
 */
export type MiniWidgetManagerVars = {
  /**
   * Number of times the mini-widget was mounted
   */
  everMounted: boolean
  /**
   * If the configuration menu is open or not
   */
  configMenuOpen: boolean
  /**
   * Wether the mini-widget should be highlited or not
   */
  highlighted: boolean
}

/**
 * External variables used by the custom widget manager
 */
export type CustomWidgetManagerVars = {
  /**
   * Number of times the custom widget was mounted
   */
  everMounted: boolean
  /**
   * If the configuration menu is open or not
   */
  configMenuOpen: boolean
  /**
   * Wether the custom widget should be highlited or not
   */
  highlighted: boolean
  /**
   * Variables that are used by the custom widget
   */
  customWidgetVars: CustomWidgetVarsType
  /**
   * Cockpit actions that are used by the custom widget
   */
  cockpitActions: CockpitAction[]
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
}

export type MiniWidget = {
  /**
   * Unique identifier for the widget
   */
  hash: string
  /**
   * Editable name for the widget
   */
  name: string
  /**
   * Component type of the widget
   */
  component: MiniWidgetType
  /**
   * Internal options of the widget
   */
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type CustomWidget = {
  /**
   *
   */
  hash: string
  /**
   *
   */
  component: WidgetType
  /**
   *
   */
  position: Point2D
  /**
   *
   */
  size: SizeRect2D
  /**
   *
   */
  name: string
  /**
   *
   */
  elementContainers: Array<{
    /**
     *
     */
    name: CustomWidgetElementContainers
    /**
     *
     */
    elements: CustomWidgetElement[]
  }>
  /**
   *
   */
  options: Record<string, any>
}

export type CustomWidgetElement = {
  /**
   * Unique identifier for the widget
   */
  hash: string
  /**
   * Editable name for the widget
   */
  name: string
  /**
   * Component type of the element
   */
  component: CustomWidgetElementType
  /**
   * Internal options of the widget
   */
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  /**
   * Internal variables of the widget
   */
  cockpitActions: CockpitAction[]
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

export type CustomWidgetElementContainer = {
  /**
   * Array of widgets that are stored in the container
   */
  elements: CustomWidgetElement[]
  /**
   * Editable name for the container
   */
  name: string
}

export type MiniWidgetProfile = {
  /**
   * Array of views that are stored in the profile
   */
  containers: MiniWidgetContainer[]
  /**
   * Editable name for the profile
   */
  name: string
}

export type DraggableEvent = {
  /**
   * The HTML item that is being dragged
   */
  item: HTMLElement
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
  /**
   * To show or not the bottom bar on boot.
   */
  showBottomBarOnBoot: boolean
  /**
   * To show or not the view.
   */
  visible: boolean
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

export const validateWidget = (maybeWidget: Widget): maybeWidget is Widget => {
  if (maybeWidget.hash === undefined) throw new Error('Widget validation failed: property hash is missing.')

  const widgetProps = ['component', 'position', 'size', 'name', 'options']
  const checkFails: string[] = []

  widgetProps.forEach((p) => {
    // @ts-ignore
    if (maybeWidget[p] !== undefined) return
    checkFails.push(`Property ${p} is missing.`)
  })

  if (checkFails.length !== 0) {
    throw new Error(`Widget ${maybeWidget.hash} validation failed: ${checkFails.join(' ')}`)
  }

  return true
}

export const validateMiniWidget = (maybeMiniWidget: MiniWidget): maybeMiniWidget is MiniWidget => {
  if (maybeMiniWidget.hash === undefined) throw new Error('Mini widget validation failed: property hash is missing.')

  const miniWidgetProps = ['component', 'name', 'options']
  const checkFails: string[] = []

  miniWidgetProps.forEach((p) => {
    // @ts-ignore
    if (maybeMiniWidget[p] !== undefined) return
    checkFails.push(`Property ${p} is missing.`)
  })

  if (checkFails.length !== 0) {
    throw new Error(`Mini widget ${maybeMiniWidget.hash} validation failed: ${checkFails.join(' ')}`)
  }

  return true
}

export const validateContainer = (maybeContainer: MiniWidgetContainer): maybeContainer is MiniWidgetContainer => {
  if (maybeContainer.name === undefined) throw new Error('View validation failed: property "name" is missing.')
  const checkFails: string[] = []

  if (Array.isArray(maybeContainer.widgets)) {
    maybeContainer.widgets.forEach((w) => {
      try {
        validateMiniWidget(w)
      } catch (error) {
        checkFails.push((error as Error).message)
      }
    })
  } else {
    checkFails.push('Property "widgets" is missing or is not an array.')
  }

  if (checkFails.length !== 0) {
    throw new Error(`Mini widget container ${maybeContainer.name} validation failed: ${checkFails.join(' ')}`)
  }

  return true
}

export const validateView = (maybeView: View): maybeView is View => {
  if (maybeView.hash === undefined) throw new Error('View validation failed: property "hash" is missing.')

  const viewProps = ['name', 'showBottomBarOnBoot', 'visible']
  const checkFails: string[] = []

  viewProps.forEach((p) => {
    // @ts-ignore
    if (maybeView[p] !== undefined) return
    checkFails.push(`Property "${p}" is missing.`)
  })

  if (Array.isArray(maybeView.widgets)) {
    maybeView.widgets.forEach((w) => {
      try {
        validateWidget(w)
      } catch (error) {
        checkFails.push((error as Error).message)
      }
    })
  } else {
    checkFails.push('Property "widgets" is missing or is not an array.')
  }

  if (Array.isArray(maybeView.miniWidgetContainers)) {
    maybeView.miniWidgetContainers.forEach((c) => {
      try {
        validateContainer(c)
      } catch (error) {
        checkFails.push((error as Error).message)
      }
    })
  } else {
    checkFails.push('Property "miniWidgetContainers" is missing or is not an array.')
  }

  if (checkFails.length !== 0) {
    throw new Error(`View ${maybeView.hash} validation failed: ${checkFails.join(' ')}`)
  }

  return true
}

export const validateProfile = (maybeProfile: Profile): maybeProfile is Profile => {
  if (maybeProfile.hash === undefined) throw new Error('Provile validation failed: property "hash" is missing.')

  const checkFails: string[] = []

  if (Array.isArray(maybeProfile.views)) {
    maybeProfile.views.forEach((v) => {
      try {
        validateView(v)
      } catch (error) {
        checkFails.push((error as Error).message)
      }
    })
  } else {
    checkFails.push('Property "views" is missing or is not an array.')
  }

  if (maybeProfile.name === undefined) checkFails.push('Property "name" is missing.')

  if (checkFails.length !== 0) {
    throw new Error(`Profile ${maybeProfile.hash} validation failed: ${checkFails.join(' ')}`)
  }

  return true
}
