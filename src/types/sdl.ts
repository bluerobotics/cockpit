/* eslint-disable jsdoc/require-jsdoc */

export interface SDLJoystickState {
  buttons: boolean[]
  axes: number[]
}

/**
 * SDL joystick instance type
 */
export interface SDLJoystickInstance {
  /**
   * State of the joystick buttons
   */
  buttons: boolean[]
  /**
   * State of the joystick axes
   */
  axes: number[]
  /**
   * State of the joystick hats
   */
  hats: string[]
  /**
   * Number of axes
   */
  /**
   * Whether the joystick is disabled or not
   */
  closed: boolean
}

export const namesStandardButtons = [
  'dpadLeft',
  'dpadRight',
  'dpadUp',
  'dpadDown',
  'a',
  'b',
  'x',
  'y',
  'guide',
  'back',
  'start',
  'leftStick',
  'rightStick',
  'leftShoulder',
  'rightShoulder',
  'paddle1',
  'paddle2',
  'paddle3',
  'paddle4',
]

export const namesStandardAxes = [
  'leftStickX',
  'leftStickY',
  'rightStickX',
  'rightStickY',
  'leftTrigger',
  'rightTrigger',
]

export interface SDLControllerButtons {
  [key: string]: boolean
  extra: boolean
}

export interface SDLControllerAxes {
  [key: string]: number
}

export interface SDLControllerState {
  buttons: SDLControllerButtons
  axes: SDLControllerAxes
}

/**
 * SDL controller instance type
 */
export interface SDLControllerInstance {
  /**
   * State of the controller buttons
   */
  buttons: SDLControllerButtons
  /**
   * State of the controller axes
   */
  axes: SDLControllerAxes
  /**
   * Whether the controller is disabled or not
   */
  closed: boolean
}

/**
 * SDL joystick device type
 */
export interface SDLJoystickDevice {
  /**
   * Device identification
   */
  id: number
  /**
   * Device name
   */
  name: string
  /**
   * Device vendor ID
   */
  vendor: number
  /**
   * Device product ID
   */
  product: number
  /**
   * Joystick type
   */
  type: 'gamecontroller' | 'others'
}

/**
 * SDL controller device type
 */
export interface SDLControllerDevice {
  /**
   * Index of the controller
   */
  _index: number
  /**
   * Device identification
   */
  id: number
  /**
   * Device name
   */
  name: string
  /**
   * Device path
   */
  path: string
  /**
   * Device GUID
   */
  guid: string
  /**
   * Device vendor ID
   */
  vendor: number
  /**
   * Device product ID
   */
  product: number
  /**
   * Device version
   */
  version: number
  /**
   * Device player
   */
  player: number
  /**
   * Device mapping
   */
  mapping: string
}

/**
 * SDL joystick module type
 */
export interface SDLJoystickModule {
  /**
   * List of available joysticks
   */
  devices: SDLJoystickDevice[]
  /**
   * Enable a joystick device by its device identification
   */
  openDevice: (device: SDLJoystickDevice) => SDLJoystickInstance
}

/**
 * SDL module type
 */
export interface SDLModule {
  /**
   * Joystick module
   */
  joystick: SDLJoystickModule
  /**
   * Controller module
   */
  controller: SDLControllerModule
}

/**
 * SDL controller module type
 */
export interface SDLControllerModule {
  /**
   * List of available controllers
   */
  devices: SDLControllerDevice[]
  /**
   * Open a controller device
   */
  openDevice: (device: SDLControllerDevice) => SDLControllerInstance
}

export interface SDLStatus {
  /**
   * Whether SDL was loaded successfully
   */
  loaded: boolean
  connectedControllers: Map<
    number,
    {
      /**
       * The ID of the controller
       */
      deviceId: number
      /**
       * The name of the controller
       */
      deviceName: string
    }
  >
  connectedJoysticks: Map<
    number,
    {
      /**
       * The ID of the joystick
       */
      deviceId: number
      /**
       * The name of the joystick
       */
      deviceName: string
    }
  >
}
