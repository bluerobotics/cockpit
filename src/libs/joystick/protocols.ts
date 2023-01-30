import { ps4MavlinkMapping } from '@/assets/joystick-profiles'
import { round, scale } from '@/libs/utils'
import { sequentialArray } from '@/libs/utils'
import { type ControllerMapping, JoystickProtocol, ProtocolControllerState } from '@/types/joystick'

export type MavlinkControllerMapping = ControllerMapping

/**
 * Current state of the controller in the MavLink protocol
 */
export class MavlinkControllerState extends ProtocolControllerState {
  x: number
  y: number
  z: number
  r: number
  buttons: number
  target: number
  public static readonly BUTTONS_PER_BITFIELD = 16

  /**
   *
   * @param { Gamepad } gamepad - Gamepad object where the joystick state is stored.
   * @param { MavlinkControllerMapping } mapping - Gamepad API to Mavlink joystick mapping, where assignments and limits are got from.
   * @param { number } target - Specify targeted vehicle ID.
   */
  constructor(gamepad: Gamepad, mapping: MavlinkControllerMapping, target = 1) {
    super()

    let buttons_int = 0
    for (let i = 0; i < MavlinkControllerState.BUTTONS_PER_BITFIELD; i++) {
      const gamepadButtonPosition = mapping.buttons.findIndex((v) => v === i)
      if (gamepadButtonPosition === -1) continue
      const gamepadButtonState = gamepad.buttons[gamepadButtonPosition]
      if (gamepadButtonState === undefined) continue
      buttons_int += +gamepadButtonState.pressed * 2 ** i
    }

    const xIndex = mapping.axesCorrespondencies.findIndex((v) => v === 'x')
    const yIndex = mapping.axesCorrespondencies.findIndex((v) => v === 'y')
    const zIndex = mapping.axesCorrespondencies.findIndex((v) => v === 'z')
    const rIndex = mapping.axesCorrespondencies.findIndex((v) => v === 'r')

    const xLimits = [mapping.axesMins[xIndex], mapping.axesMaxs[xIndex]]
    const yLimits = [mapping.axesMins[yIndex], mapping.axesMaxs[yIndex]]
    const zLimits = [mapping.axesMins[zIndex], mapping.axesMaxs[zIndex]]
    const rLimits = [mapping.axesMins[rIndex], mapping.axesMaxs[rIndex]]

    const absLimits = mavlinkAxesLimits

    this.x = round(scale(gamepad.axes[xIndex], -1, 1, xLimits[0] ?? absLimits[0], xLimits[1] ?? absLimits[1]), 0)
    this.y = round(scale(gamepad.axes[yIndex], -1, 1, yLimits[0] ?? absLimits[0], yLimits[1] ?? absLimits[1]), 0)
    this.z = round(scale(gamepad.axes[zIndex], -1, 1, zLimits[0] ?? absLimits[0], zLimits[1] ?? absLimits[1]), 0)
    this.r = round(scale(gamepad.axes[rIndex], -1, 1, rLimits[0] ?? absLimits[0], rLimits[1] ?? absLimits[1]), 0)

    this.buttons = buttons_int
    this.target = round(target, 0)
  }
}

export const defaultMavlinkControllerMapping = ps4MavlinkMapping
export const protocolDefaultMapping = (protocol: JoystickProtocol): ControllerMapping => {
  switch (protocol) {
    case JoystickProtocol.MAVLink:
      return defaultMavlinkControllerMapping
    default:
      // Mavlink is the current main protocol and will be used by default
      return defaultMavlinkControllerMapping
  }
}

const mavlinkAvailableAxes = ['x', 'y', 'z', 'r']
export const protocolAvailableAxes = (protocol: JoystickProtocol): (string | number)[] => {
  switch (protocol) {
    case JoystickProtocol.MAVLink:
      return mavlinkAvailableAxes
    default:
      // Mavlink is the current main protocol and will be used by default
      return mavlinkAvailableAxes
  }
}

const mavlinkAvailableButtons = sequentialArray(16)
export const protocolAvailableButtons = (protocol: JoystickProtocol): (string | number)[] => {
  switch (protocol) {
    case JoystickProtocol.MAVLink:
      return mavlinkAvailableButtons
    default:
      // Mavlink is the current main protocol and will be used by default
      return mavlinkAvailableButtons
  }
}

const mavlinkAxesLimits = [-1000, 1000]
export const protocolAxesLimits = (protocol: JoystickProtocol): number[] => {
  switch (protocol) {
    case JoystickProtocol.MAVLink:
      return mavlinkAxesLimits
    default:
      // Mavlink is the current main protocol and will be used by default
      return mavlinkAxesLimits
  }
}
