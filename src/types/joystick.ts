import { JoystickModel } from '@/libs/joystick/manager'

import { SDLControllerState, SDLJoystickState } from './sdl'

/**
 * Available joystick protocols.
 * Each protocol is expected to have it's own way of doing thing, including mapping, limiting, communicating, etc.
 */
export enum JoystickProtocol {
  CockpitModifierKey = 'cockpit-modifier-key',
  MAVLinkManualControl = 'mavlink-manual-control',
  CockpitAction = 'cockpit-action',
  DataLakeVariable = 'data-lake-variable',
  Other = 'other',
}

/**
 * Modifier keys
 */
export enum CockpitModifierKeyOption {
  regular = 'regular',
  shift = 'shift',
}

/**
 * Current state of joystick inputs
 */
export interface JoystickState {
  /**
   * Joystick buttons state
   */
  buttons: (number | undefined)[]
  /**
   * Joystick axes state
   */
  axes: (number | undefined)[]
}

/**
 * Joystick abstraction for widget
 */
export class Joystick {
  gamepad: Gamepad
  gamepadToCockpitMap: GamepadToCockpitStdMapping | undefined = undefined
  model = JoystickModel.Unknown

  /**
   * Create joystick component
   * @param {Gamepad} gamepad Axis to be set
   */
  constructor(gamepad: Gamepad) {
    this.gamepad = gamepad
  }

  /**
   * Returns current state of axes and buttons
   * @returns {JoystickState}
   */
  get state(): JoystickState {
    let buttons =
      this.gamepadToCockpitMap?.buttons.map((idx) => {
        if (idx === null || this.gamepad.buttons[idx] === undefined) return undefined
        return this.gamepad.buttons[idx].value
      }) || []

    buttons = buttons.filter((button) => button !== undefined)

    let axes =
      this.gamepadToCockpitMap?.axes.map((idx) => {
        if (idx === null || this.gamepad.axes[idx] === undefined) return undefined
        return this.gamepad.axes[idx]
      }) || []

    axes = axes.filter((axis) => axis !== undefined)

    return { buttons, axes }
  }
}

/**
 *
 */
export interface ProtocolAction {
  /**
   * Protocol that holds the action
   */
  protocol: JoystickProtocol
  /**
   * Action identification
   */
  id: string
  /**
   * Human-readable name for the action
   */
  name: string
}

/**
 * Correspondency between the hardware axis input and the protocol action that should be triggered by it
 */
export type JoystickAxisActionCorrespondency = {
  /**
   * The ID of the axis that holds the correspondent action
   */
  [key in number]: {
    /**
     * The protocol action that should be triggered
     */
    action: ProtocolAction
    /**
     * The
     */
    min: number
    /**
     * Maximum axis value
     */
    max: number
  }
}

/**
 * Correspondency between the hardware button input and the protocol action that should be triggered by it
 */
export type JoystickButtonActionCorrespondency = {
  /**
   * The ID of the button that holds the correspondent action
   */
  [key in number]: {
    /**
     * The protocol action that should be triggered
     */
    action: ProtocolAction
    /**
     * User's custom label for the button
     */
    label?: string
  }
}

/**
 * Interface that represents the necessary information for mapping a Gamepad API controller to a specific protocol.
 */
export interface JoystickProtocolActionsMapping {
  /**
   *  Name to help identification of a mapping profile
   */
  name: string
  /**
   * Unique identifier for the mapping
   */
  hash: string
  /**
   * Correspondency from Gamepad API to protocol axis.
   * Corresponds to which Axis in the protocol should the Nth axis be mapped to.
   */
  axesCorrespondencies: JoystickAxisActionCorrespondency
  /**
   * Correspondency from Gamepad API to protocol button.
   * Corresponds to which button in the protocol should the Nth button be mapped to.
   */
  buttonsCorrespondencies: {
    /**
     * Defines the buttons correspondencies for each modifier key
     */
    [key in CockpitModifierKeyOption]: JoystickButtonActionCorrespondency
  }
}

export type CockpitButton = null | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 // eslint-disable-line
export type CockpitAxis = null | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 // eslint-disable-line

/**
 * This interface defines the mapping for a specific controller from the Gamepad API to Cockpit's standard.
 */
export interface GamepadToCockpitStdMapping {
  /**
   *  Name to help identification of a mapping profile
   */
  name: string
  /**
   * Correspondency from Gamepad API to Cockpit standard axes.
   * Corresponds to which Axis in the Cockpit standard should the Nth axis be mapped to.
   * E.g.: [2, 0, 1, 3] means axis 0 in the Gamepad API will provide data to axis 2 in Cockpit, while axis 1
   * in the Gamepad API will provide data to axis 0 in Cockpit.
   * Gamepad API / Cockpit API
   *      0     ->     2
   *      1     ->     0
   *      2     ->     1
   *      3     ->     undefined
   *     ...    ->    ...
   *
   * You can notice that in the previous case axis 3 in the Gamepad API does is not used in the Cockpit API
   */
  axes: CockpitAxis[]
  /**
   * Correspondency from Gamepad API to Cockpit standard buttons.
   * Corresponds to which button in the Cockpit standard should the Nth button be mapped to.
   * E.g.: [3, 4, 15, 2, ...] means button 0 in the Gamepad API will provide data to button 3 in the Cockpit
   * API, while button 1 in the Gamepad API will provide data to button 4 in the Cockpit API.
   * Gamepad API / Cockpit API
   *      0     ->     3
   *      1     ->     4
   *      2     ->     15
   *      3     ->     undefined
   *     ...    ->    ...
   *
   * You can notice that in the previous case button 3 in the Gamepad API does is not used in the Cockpit API
   */
  buttons: CockpitButton[]
}

/**
 * Buttons for PS4 controller
 */
export enum JoystickButton {
  B0 = 0, // Bottom button in right cluster
  B1 = 1, // Right button in right cluster
  B2 = 2, // Left button in right cluster
  B3 = 3, // Top button in right cluster
  B4 = 4, // Top left front button
  B5 = 5, // Top right front button
  B6 = 6, // Bottom left front button
  B7 = 7, // Bottom right front button
  B8 = 8, // Left button in center cluster
  B9 = 9, // Right button in center cluster
  B10 = 10, // Left stick pressed button
  B11 = 11, // Right stick pressed button
  B12 = 12, // Top button in left cluster
  B13 = 13, // Bottom button in left cluster
  B14 = 14, // Left button in left cluster
  B15 = 15, // Right button in left cluster
  B16 = 16, // Center button in center cluster
  B17 = 17, // 	Extra non-standard buttons
}

/**
 * Joystick axis
 */
export enum JoystickAxis {
  A0 = 0, // Horizontal axis for left stick (negative left/positive right)
  A1 = 1, // Vertical axis for left stick (negative up/positive down)
  A2 = 2, // Horizontal axis for right stick (negative left/positive right)
  A3 = 3, // Vertical axis for right stick (negative up/positive down)
  A4 = 4, // Left trigger (positive pressed)
  A5 = 5, // Right trigger (positive pressed)
  A6 = 6, // Horizontal axis for D-pad (negative left/positive right)
  A7 = 7, // Vertical axis for D-pad (negative up/positive down)
  A8 = 8, // Extra non-standard axes
  A9 = 9, // Extra non-standard axes
  A10 = 10, // Extra non-standard axes
  A11 = 11, // Extra non-standard axes
  A12 = 12, // Extra non-standard axes
  A13 = 13, // Extra non-standard axes
  A14 = 14, // Extra non-standard axes
  A15 = 15, // Extra non-standard axes
  A16 = 16, // Extra non-standard axes
  A17 = 17, // Extra non-standard axes
  A18 = 18, // Extra non-standard axes
  A19 = 19, // Extra non-standard axes
  A20 = 20, // Extra non-standard axes
  A21 = 21, // Extra non-standard axes
  A22 = 22, // Extra non-standard axes
  A23 = 23, // Extra non-standard axes
  A24 = 24, // Extra non-standard axes
  A25 = 25, // Extra non-standard axes
  A26 = 26, // Extra non-standard axes
  A27 = 27, // Extra non-standard axes
  A28 = 28, // Extra non-standard axes
  A29 = 29, // Extra non-standard axes
  A30 = 30, // Extra non-standard axes
  A31 = 31, // Extra non-standard axes
}

/**
 * Possible inputs types coming from a joystick
 */
export enum InputType {
  Unknown = 'unknown',
  Axis = 'axis',
  Button = 'button',
}

/**
 * Possible joystick input
 */
export interface JoystickInput {
  /**
   * Input type (Axis or Button)
   */
  type: InputType.Axis | InputType.Button
  /**
   * Input identification
   */
  id: JoystickAxis | JoystickButton
}

/**
 * Joystick actions
 */
export interface JoystickAction {
  /**
   * Action identification
   */
  name: string
  /**
   * Action's protocol
   */
  protocol: string
  /**
   * Action's id
   */
  id: string
  [key: string]: string
}

/**
 * Joystick button input
 */
export class JoystickButtonInput implements JoystickInput {
  readonly type = InputType.Button
  /**
   * Create an axis input
   * @param {JoystickAxis} id Axis identification
   */
  constructor(public id: JoystickButton) {}
}

/**
 * Joystick axis input
 */
export class JoystickAxisInput implements JoystickInput {
  readonly type = InputType.Axis
  /**
   * Create an axis input
   * @param {JoystickAxis} id Axis identification
   */
  constructor(public id: JoystickAxis) {}
}

/**
 * Joystick calibration options
 * @description The calibration options for each joystick model. They help ensuring the joystick behaves as the user expects.
 */
export type JoystickCalibration = {
  /**
   * Deadband calibration
   * @description This will help eliminate small unwanted movements around the center position.
   */
  deadband: {
    /**
     * Whether the deadband is enabled
     */
    enabled: boolean
    /**
     * The thresholds for each axis
     */
    thresholds: {
      /**
       * The thresholds for each axis
       */
      axes: number[]
      /**
       * The thresholds for each button
       */
      buttons: number[]
    }
  }
  /**
   * Exponential scaling calibration
   * @description This will help adjust the sensitivity curve of your joystick.
   */
  exponential: {
    /**
     * Whether the exponential scaling is enabled
     */
    enabled: boolean
    /**
     * The exponential factors for each axis
     */
    factors: {
      /**
       * The exponential factors for each axis
       */
      axes: number[]
      /**
       * The exponential factors for each button
       */
      buttons: number[]
    }
  }
}

export type JoystickCalibrationOptions = {
  [joystickModel in string]: JoystickCalibration
}

/**
 * Data for the event of a new state of a joystick on the Electron side
 */
export interface ElectronSDLJoystickControllerStateEventBase {
  /**
   * Joystick device id
   */
  deviceId: number
  /**
   * Joystick device name
   */
  deviceName: string
  /**
   * Joystick product id
   */
  productId: string
  /**
   * Joystick vendor id
   */
  vendorId: string
  /**
   * Joystick type
   */
  type: 'joystick' | 'controller'
}

/**
 * Data for the event of a new state of a joystick on the Electron side
 */
export interface ElectronSDLControllerStateEventData extends ElectronSDLJoystickControllerStateEventBase {
  /**
   * Controller type
   */
  type: 'controller'
  /**
   * Controller state
   */
  state: SDLControllerState
}

/**
 * Data for the event of a new state of a joystick on the Electron side
 */
export interface ElectronSDLJoystickStateEventData extends ElectronSDLJoystickControllerStateEventBase {
  /**
   * Joystick type
   */
  type: 'joystick'
  /**
   * Joystick state
   */
  state: SDLJoystickState
}

// eslint-disable-next-line prettier/prettier
export type ElectronSDLJoystickControllerStateEventData = ElectronSDLControllerStateEventData | ElectronSDLJoystickStateEventData

export type JoystickSdlStandardToGamepadStandard = {
  /**
   * SDL button index as key to Gamepad button index as value
   */
  buttons: {
    [key: number]: number
  }
  /**
   * SDL axis index as key to Gamepad axis index as value
   */
  axes: {
    [key: number]:
      | number
      | {
          /**
           * Gamepad axis index
           */
          axis: number
          /**
           * Gamepad button index (if the axis should also be mapped as a button)
           */
          button: number
        }
  }
}

/**
 * Convert SDL controller state to Gamepad state, using the default mapping for both
 * @param {SDLControllerState} sdlState - SDL controller state
 * @returns {JoystickState} Gamepad state
 */
export const convertSDLControllerStateToGamepadState = (sdlState: SDLControllerState): JoystickState => {
  return {
    buttons: [
      sdlState.buttons.a ? 1 : 0,
      sdlState.buttons.b ? 1 : 0,
      sdlState.buttons.x ? 1 : 0,
      sdlState.buttons.y ? 1 : 0,
      sdlState.buttons.leftShoulder ? 1 : 0,
      sdlState.buttons.rightShoulder ? 1 : 0,
      sdlState.axes.leftTrigger,
      sdlState.axes.rightTrigger,
      sdlState.buttons.back ? 1 : 0,
      sdlState.buttons.start ? 1 : 0,
      sdlState.buttons.leftStick ? 1 : 0,
      sdlState.buttons.rightStick ? 1 : 0,
      sdlState.buttons.dpadUp ? 1 : 0,
      sdlState.buttons.dpadDown ? 1 : 0,
      sdlState.buttons.dpadLeft ? 1 : 0,
      sdlState.buttons.dpadRight ? 1 : 0,
      sdlState.buttons.guide ? 1 : 0,
      sdlState.buttons.extra ? 1 : 0,
      sdlState.buttons.paddle1 ? 1 : 0,
      sdlState.buttons.paddle2 ? 1 : 0,
      sdlState.buttons.paddle3 ? 1 : 0,
      sdlState.buttons.paddle4 ? 1 : 0,
    ],
    axes: [
      sdlState.axes.leftStickX,
      sdlState.axes.leftStickY,
      sdlState.axes.rightStickX,
      sdlState.axes.rightStickY,
      sdlState.axes.leftTrigger,
      sdlState.axes.rightTrigger,
    ],
  }
}

/**
 * Convert SDL joystick state to Gamepad state, using the default mapping for both
 * @param {SDLJoystickState} sdlState - SDL joystick state
 * @returns {JoystickState} Gamepad state
 */
export const convertSDLJoystickStateToGamepadState = (sdlState: SDLJoystickState): JoystickState => {
  return {
    buttons: sdlState.buttons.map((button) => (button ? 1 : 0)),
    axes: sdlState.axes,
  }
}
