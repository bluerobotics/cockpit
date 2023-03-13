import { cockpitStandardToMavlink } from '@/assets/joystick-profiles'
import { round, scale } from '@/libs/utils'
import { sequentialArray } from '@/libs/utils'
import {
  type JoystickState,
  type ProtocolControllerMapping,
  JoystickProtocol,
  ProtocolControllerState,
} from '@/types/joystick'

export type MavlinkControllerMapping = ProtocolControllerMapping

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
   * @param { JoystickState } joystickState - Cockpit standard mapped values for the joystick
   * @param { MavlinkControllerMapping } mapping - Gamepad API to Mavlink joystick mapping, where assignments and limits are got from.
   * @param { number } target - Specify targeted vehicle ID.
   */
  constructor(joystickState: JoystickState, mapping: MavlinkControllerMapping, target = 1) {
    super()

    let buttons_int = 0
    for (let i = 0; i < MavlinkControllerState.BUTTONS_PER_BITFIELD; i++) {
      const gamepadButtonPosition = mapping.buttons.findIndex((v) => v === i)
      if (gamepadButtonPosition === -1) continue
      const gamepadButtonState = joystickState.buttons[gamepadButtonPosition]
      buttons_int += (gamepadButtonState ?? 0) * 2 ** i
    }

    const xIndex = mapping.axesCorrespondencies.findIndex((v) => v === 'x')
    const yIndex = mapping.axesCorrespondencies.findIndex((v) => v === 'y')
    const zIndex = mapping.axesCorrespondencies.findIndex((v) => v === 'z')
    const rIndex = mapping.axesCorrespondencies.findIndex((v) => v === 'r')

    const absLimits = mavlinkAxesLimits

    const xLimits = [mapping.axesMins[xIndex] ?? absLimits[0], mapping.axesMaxs[xIndex] ?? absLimits[1]]
    const yLimits = [mapping.axesMins[yIndex] ?? absLimits[0], mapping.axesMaxs[yIndex] ?? absLimits[1]]
    const zLimits = [mapping.axesMins[zIndex] ?? absLimits[0], mapping.axesMaxs[zIndex] ?? absLimits[1]]
    const rLimits = [mapping.axesMins[rIndex] ?? absLimits[0], mapping.axesMaxs[rIndex] ?? absLimits[1]]

    this.x = xIndex === undefined ? 0 : round(scale(joystickState.axes[xIndex] ?? 0, -1, 1, xLimits[0], xLimits[1]), 0)
    this.y = yIndex === undefined ? 0 : round(scale(joystickState.axes[yIndex] ?? 0, -1, 1, yLimits[0], yLimits[1]), 0)
    this.z = zIndex === undefined ? 0 : round(scale(joystickState.axes[zIndex] ?? 0, -1, 1, zLimits[0], zLimits[1]), 0)
    this.r = rIndex === undefined ? 0 : round(scale(joystickState.axes[rIndex] ?? 0, -1, 1, rLimits[0], rLimits[1]), 0)

    this.buttons = buttons_int
    this.target = round(target, 0)
  }
}

export const defaultMavlinkControllerMapping = cockpitStandardToMavlink
export const protocolDefaultMapping = (protocol: JoystickProtocol): ProtocolControllerMapping => {
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
