import { CockpitAction } from '@/libs/joystick/protocols/cockpit-actions'

import type { Point2D, SizeRect2D } from './general'

/**
 * Widget configuration object as received from BlueOS or another external source
 */
export interface ExternalWidgetSetupInfo {
  /**
   * Name of the widget, this is displayed on edit mode widget browser
   */
  name: string
  /**
   * The URL at which the widget is located
   * This is expected to be an absolute url
   */
  iframe_url: string

  /**
   * The icon of the widget, this is displayed on the widget browser
   */
  iframe_icon: string
}

/**
 * Internal data used for setting up a new widget. This includes WidgetType, a custom name, options, and icon
 */ export interface InternalWidgetSetupInfo {
  /**
   *  Widget type
   */
  component: WidgetType
  /**
   *  Widget name, this will be displayed on edit mode
   */
  name: string
  /**
   *  Widget options, this is the configuration that will be passed to the widget when it is created
   */
  options: Record<string, unknown>
  /**
   *  Widget icon, this is the icon that will be displayed on the widget browser
   */
  icon: string
}

/**
 * Available components to be used in the Widget system
 * The enum value is equal to the component's filename, without the '.vue' extension
 */
export enum WidgetType {
  Attitude = 'Attitude',
  Compass = 'Compass',
  CompassHUD = 'CompassHUD',
  CollapsibleContainer = 'CollapsibleContainer',
  DepthHUD = 'DepthHUD',
  DoItYourself = 'DoItYourself',
  IFrame = 'IFrame',
  ImageView = 'ImageView',
  Map = 'Map',
  MiniWidgetsBar = 'MiniWidgetsBar',
  Plotter = 'Plotter',
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
  GoFullScreen = 'GoFullScreen',
  EnterEditMode = 'EnterEditMode',
  DepthIndicator = 'DepthIndicator',
  MissionIdentifier = 'MissionIdentifier',
  RelativeAltitudeIndicator = 'RelativeAltitudeIndicator',
  ReloadCockpit = 'ReloadCockpit',
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
 * Available containers to be used in the Custom Widget creator.
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

export type SelectorOption = {
  /**
   * The name of the option
   */
  name: string
  /**
   * The value of the option
   */
  value: string
}

/**
 * Options for the Cockpit Actions parameters
 */
export interface DataLakeVariable {
  /**
   * Parameter ID, equals to initial name of the parameter
   */
  id: string
  /**
   * Parameter name
   */
  name: string
  /**
   * Parameter type
   */
  type: 'string' | 'boolean' | 'number'
  /**
   * Parameter description
   */
  description?: string
}

/**
 * Options for the Custom Widgets inner elements
 */
export type CustomWidgetElementOptions = {
  /**
   * Custom widget element - Label
   */
  [CustomWidgetElementType.Label]: {
    /**
     * Element hash
     */
    hash: string
    /**
     * Element name
     */
    name: string
    /**
     * Mark as custom mini widget
     */
    isCustomElement: boolean
    /**
     * Element options
     */
    options: {
      /**
       * Variable type
       */
      variableType: DataLakeVariable | null
      /**
       * Action parameter
       */
      dataLakeVariable: DataLakeVariable
      /**
       * Layout options
       */
      layout: {
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
  }
  /**
   * Custom widget element - Button
   */
  [CustomWidgetElementType.Button]: {
    /**
     * Element hash
     */
    hash: string
    /**
     * Element name
     */
    name: string
    /**
     * Mark as custom mini widget
     */
    isCustomElement: boolean
    /**
     * Element options
     */
    options: {
      /**
       * Variable type
       */
      variableType: DataLakeVariable['type'] | null
      /**
       * Action parameter
       */
      cockpitAction: CockpitAction
      /**
       * Layout options
       */
      layout: {
        /**
         * Alignment of the element
         */
        align: 'start' | 'center' | 'end'
        /**
         * The label of the button
         */
        label: string
        /**
         * The size of the button
         */
        buttonSize: 'small' | 'default' | 'large'
        /**
         * The color of the button
         */
        backgroundColor: string
        /**
         * The color of the button's text
         */
        textColor: string
        /**
         * The variant of the button
         */
        variant: 'text' | 'outlined' | 'flat' | 'elevated' | 'tonal' | 'plain'
      }
    }
  }
  /**
   * Custom widget element - Checkbox
   */
  [CustomWidgetElementType.Checkbox]: {
    /**
     * Element hash
     */
    hash: string
    /**
     * Element name
     */
    name: string
    /**
     * Mark as custom mini widget
     */
    isCustomElement: boolean
    /**
     * Element options
     */
    options: {
      /**
       * Variable type
       */
      variableType: DataLakeVariable['type'] | null
      /**
       * Action parameter
       */
      dataLakeVariable: DataLakeVariable
      /**
       * Layout props for the element
       */
      layout: {
        /**
         * Alignment of the element
         */
        align: 'start' | 'center' | 'end'
        /**
         * The size of the checkbox
         */
        color: string
        /**
         * The label of the checkbox
         */
        label: string
      }
    }
  }
  /**
   * Custom widget element - Dial
   */
  [CustomWidgetElementType.Dial]: {
    /**
     * Element hash
     */
    hash: string
    /**
     * Element name
     */
    name: string
    /**
     * Mark as custom mini widget
     */
    isCustomElement: boolean
    /**
     * Element options
     */
    options: {
      /**
       * Variable type
       */
      variableType: DataLakeVariable['type'] | null
      /**
       * Action parameter
       */
      dataLakeVariable: DataLakeVariable
      /**
       * Layout options
       */
      layout: {
        /**
         * Alignment of the element
         */
        align: 'start' | 'center' | 'end'
        /**
         * The size of the dial
         */
        size: 'small' | 'medium' | 'large'
        /**
         * The color of the dial
         */
        knobColor: string
        /**
         * The color of the knob's notch
         */
        notchColor: string
        /**
         * The minimum value of the dial
         */
        minValue: number
        /**
         * The maximum value of the dial
         */
        maxValue: number
        /**
         * The step value of the dial
         */
        showValue: boolean
      }
    }
  }
  /**
   * Custom widget element - Dropdown
   */
  [CustomWidgetElementType.Dropdown]: {
    /**
     * Element hash
     */
    hash: string
    /**
     * Element name
     */
    name: string
    /**
     * Mark as custom mini widget
     */
    isCustomElement: boolean
    /**
     * Element options
     */
    options: {
      /**
       * Variable type
       */
      variableType: DataLakeVariable['type'] | null
      /**
       * Action parameter
       */
      dataLakeVariable: DataLakeVariable
      /**
       * Last selected value
       */
      lastSelected: SelectorOption
      /**
       * Layout options
       */
      layout: {
        /**
         * Alignment of the element
         */
        selectorOptions: SelectorOption[]
        /**
         * Alignment of the element
         */
        align: 'start' | 'center' | 'end'
        /**
         *  The size of the dropdown
         */
        width: number
      }
    }
  }
  /**
   * Custom widget element - Slider
   */
  [CustomWidgetElementType.Slider]: {
    /**
     * Element hash
     */
    hash: string
    /**
     * Element name
     */
    name: string
    /**
     * Mark as custom mini widget
     */
    isCustomElement: boolean
    /**
     * Element options
     */
    options: {
      /**
       * Variable type
       */
      variableType: DataLakeVariable['type'] | null
      /**
       * Action parameter
       */
      dataLakeVariable: DataLakeVariable
      /**
       * Layout options
       */
      layout: {
        /**
         * Alignment of the element
         */
        align: 'start' | 'center' | 'end'
        /**
         * The size of the slider
         */
        size: 'small' | 'medium' | 'large'
        /**
         * The color of the slider
         */
        color: string
        /**
         * Apply color to the label
         */
        coloredLabel: boolean
        /**
         * The minimum value of the slider
         */
        minValue: number
        /**
         * The maximum value of the slider
         */
        maxValue: number
        /**
         * The step value of the slider
         */
        showTooltip: boolean
        /**
         * The label of the slider
         */
        label: string
        /**
         * The width of the label
         */
        labelWidth: number
      }
    }
  }
  /**
   * Custom widget element - Switch
   */
  [CustomWidgetElementType.Switch]: {
    /**
     * Element hash
     */
    hash: string
    /**
     * Element name
     */
    name: string
    /**
     * Mark as custom mini widget
     */
    isCustomElement: boolean
    /**
     * Element options
     */
    options: {
      /**
       * Variable type
       */
      variableType: DataLakeVariable['type'] | null
      /**
       * Action parameter
       */
      dataLakeVariable: DataLakeVariable
      /**
       * Layout options
       */
      layout: {
        /**
         * Alignment of the element
         */
        align: 'start' | 'center' | 'end'
        /**
         * The color of the switch
         */
        color: string
        /**
         * The label of the switch
         */
        label: string
      }
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
  elementContainers: Array<{
    /**
     * Editable name for the container
     */
    name: CustomWidgetElementContainers
    /**
     * Array of elements that are stored in the container
     */
    elements: CustomWidgetElement[]
  }>
  /**
   * Internal options of the widget
   */
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
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
   * If the element is a custom mini widget
   */
  isCustomElement?: boolean
  /**
   * Internal options of the widget
   */
  options: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
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

export const isWidgetConfigurable: Record<WidgetType, boolean> = {
  [WidgetType.Attitude]: true,
  [WidgetType.Compass]: true,
  [WidgetType.CompassHUD]: true,
  [WidgetType.CollapsibleContainer]: true,
  [WidgetType.DepthHUD]: true,
  [WidgetType.DoItYourself]: true,
  [WidgetType.IFrame]: true,
  [WidgetType.ImageView]: true,
  [WidgetType.Map]: true,
  [WidgetType.MiniWidgetsBar]: false,
  [WidgetType.Plotter]: true,
  [WidgetType.URLVideoPlayer]: true,
  [WidgetType.VideoPlayer]: true,
  [WidgetType.VirtualHorizon]: false,
}

export const isMiniWidgetConfigurable: Record<MiniWidgetType, boolean> = {
  [MiniWidgetType.Alerter]: false,
  [MiniWidgetType.ArmerButton]: false,
  [MiniWidgetType.BaseCommIndicator]: false,
  [MiniWidgetType.BatteryIndicator]: true,
  [MiniWidgetType.ChangeAltitudeCommander]: false,
  [MiniWidgetType.Clock]: false,
  [MiniWidgetType.GoFullScreen]: false,
  [MiniWidgetType.ReloadCockpit]: false,
  [MiniWidgetType.EnterEditMode]: false,
  [MiniWidgetType.DepthIndicator]: false,
  [MiniWidgetType.MissionIdentifier]: true,
  [MiniWidgetType.RelativeAltitudeIndicator]: false,
  [MiniWidgetType.TakeoffLandCommander]: false,
  [MiniWidgetType.VeryGenericIndicator]: true,
  [MiniWidgetType.JoystickCommIndicator]: true,
  [MiniWidgetType.MiniVideoRecorder]: true,
  [MiniWidgetType.ModeSelector]: false,
  [MiniWidgetType.SatelliteIndicator]: false,
  [MiniWidgetType.ViewSelector]: false,
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
