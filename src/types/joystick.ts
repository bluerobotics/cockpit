import { availableGamepadToCockpitMaps } from '@/assets/joystick-profiles'
import { JoystickModel } from '@/libs/joystick/manager'

/**
 * Available joystick protocols.
 * Each protocol is expected to have it's own way of doing thing, including mapping, limiting, communicating, etc.
 */
export enum JoystickProtocol {
  MAVLink = 'mavlink',
}

/**
 * Current state of joystick inputs
 */
export class JoystickValues {
  leftAxisHorizontal = 0
  leftAxisVertical = 0
  rightAxisHorizontal = 0
  rightAxisVertical = 0

  directionalTopButton = false
  directionalBottomButton = false
  directionalLeftButton = false
  directionalRightButton = false

  rightClusterBottomButton = false
  rightClusterRightButton = false
  rightClusterLeftButton = false
  rightClusterTopButton = false

  leftShoulderButton = false
  leftTriggerButton = false
  leftStickerButton = false
  rightShoulderButton = false
  rightTriggerButton = false
  rightStickerButton = false

  extraButton1 = false
  extraButton2 = false
  extraButton3 = false
  extraButton4 = false
  extraButton5 = false
}

/**
 * Current state of the controller in the protocol POV
 */
export class ProtocolControllerState {}

/**
 * Joystick abstraction for widget
 */
export class Joystick {
  gamepad: Gamepad
  values = new JoystickValues()
  model = JoystickModel.Unknown

  /**
   * Create joystick component
   *
   * @param {Gamepad} gamepad Axis to be set
   */
  constructor(gamepad: Gamepad) {
    this.gamepad = gamepad
  }
}

/**
 * Interface that represents the necessary information for mapping a Gamepad API controller to a specific protocol.
 */
export interface ProtocolControllerMapping {
  /**
   *  Name to help identification of a mapping profile
   */
  name: string
  /**
   *  Values to which each Gamepad API axis state of -1 should be mapped to
   */
  axesMins: number[]
  /**
   *  Values to which each Gamepad API axis state of 1 should be mapped to
   */
  axesMaxs: number[]
  /**
   * Correspondency from Gamepad API to protocol axis.
   * Corresponds to which Axis in the protocol should the Nth axis be mapped to.
   */
  axesCorrespondencies: (number | string | undefined)[]
  /**
   * Correspondency from Gamepad API to protocol button.
   * Corresponds to which button in the protocol should the Nth button be mapped to.
   */
  buttons: (number | string | undefined)[]
}

export type CockpitButton = undefined | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 // eslint-disable-line
export type CockpitAxis = undefined | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

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
