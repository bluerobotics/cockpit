import { JoystickModel } from '@/libs/joystick/manager'

/**
 * Available joystick protocols.
 * Each protocol is expected to have it's own way of doing thing, including mapping, limiting, communicating, etc.
 */
export enum JoystickProtocol {
  CockpitModifierKey = 'cockpit-modifier-key',
  MAVLinkManualControl = 'mavlink-manual-control',
  CockpitAction = 'cockpit-action',
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
    return {
      buttons:
        this.gamepadToCockpitMap?.buttons.map((idx) => {
          if (idx === null || this.gamepad.buttons[idx] === undefined) return undefined
          return this.gamepad.buttons[idx].value
        }) || [],
      axes:
        this.gamepadToCockpitMap?.axes.map((idx) => {
          if (idx === null || this.gamepad.axes[idx] === undefined) return undefined
          return this.gamepad.axes[idx]
        }) || [],
    }
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
  [key in JoystickAxis]: {
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
  [key in JoystickButton]: {
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
export type CockpitAxis = null | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

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
