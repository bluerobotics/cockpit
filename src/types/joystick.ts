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
export interface ControllerMapping {
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
