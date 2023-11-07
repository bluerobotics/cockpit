import { v4 as uuid4 } from 'uuid'

import { round, scale } from '@/libs/utils'
import { sequentialArray } from '@/libs/utils'
import {
  type JoystickState,
  type ProtocolControllerMapping,
  type ProtocolInput,
  JoystickProtocol,
  ProtocolControllerState,
} from '@/types/joystick'

/**
 * Correspondency between protocol input and it's pretty name (usually the actual function it triggers)
 */
export interface InputWithPrettyName {
  /**
   * Input which triggers the function
   */
  input: ProtocolInput
  /**
   * Name of the parameter option
   */
  prettyName: string
}

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
   * @param { ProtocolControllerMapping } mapping - Gamepad API to Protocols joystick mapping, where assignments and limits are got from.
   * @param { number } target - Specify targeted vehicle ID.
   */
  constructor(joystickState: JoystickState, mapping: ProtocolControllerMapping, target = 1) {
    super()

    const isMavlinkInput = (input: ProtocolInput): boolean => input.protocol === JoystickProtocol.MAVLink

    let buttons_int = 0
    for (let i = 0; i < MavlinkControllerState.BUTTONS_PER_BITFIELD; i++) {
      let buttonState = 0
      mapping.buttonsCorrespondencies.forEach((b, idx) => {
        if (isMavlinkInput(b) && b.value === i && joystickState.buttons[idx]) {
          buttonState = 1
        }
      })
      buttons_int += buttonState * 2 ** i
    }

    const xIndex = mapping.axesCorrespondencies.findIndex((v) => isMavlinkInput(v) && v.value === MAVLinkAxis.X)
    const yIndex = mapping.axesCorrespondencies.findIndex((v) => isMavlinkInput(v) && v.value === MAVLinkAxis.Y)
    const zIndex = mapping.axesCorrespondencies.findIndex((v) => isMavlinkInput(v) && v.value === MAVLinkAxis.Z)
    const rIndex = mapping.axesCorrespondencies.findIndex((v) => isMavlinkInput(v) && v.value === MAVLinkAxis.R)

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

/**
 * Possible other protocol functions
 */
export enum OtherProtocol {
  NO_FUNCTION = 'No function',
}

/**
 * Possible Cockpit Actions
 */
export enum CockpitAction {
  GO_TO_NEXT_VIEW = 'Go to next view',
  GO_TO_PREVIOUS_VIEW = 'Go to previous view',
  TOGGLE_FULL_SCREEN = 'Toggle full-screen',
  MAVLINK_ARM = 'Mavlink Command - Arm',
  MAVLINK_DISARM = 'Mavlink Command - Disarm',
  TOGGLE_BOTTOM_BAR = 'Toggle bottom bar',
}

export type CockpitActionCallback = () => void

/**
 * Callback entry
 */
interface CallbackEntry {
  /**
   * Unique ID for that callback register
   */
  action: CockpitAction
  /**
   * Callback to be called
   */
  callback: CockpitActionCallback
}

// @ts-ignore: Typescript does not get that we are initializing the object dinamically
const actionsCallbacks: { [id in string]: CallbackEntry } = {}

export const registerActionCallback = (action: CockpitAction, callback: CockpitActionCallback): string => {
  const id = uuid4()
  actionsCallbacks[id] = { action, callback }
  return id
}
export const unregisterActionCallback = (id: string): void => {
  delete actionsCallbacks[id]
}

export const sendCockpitActions = (joystickState: JoystickState, mapping: ProtocolControllerMapping): void => {
  const actionsToCallback: CockpitAction[] = []
  joystickState.buttons.forEach((state, idx) => {
    const mappedButton = mapping.buttonsCorrespondencies[idx]
    if (state && mappedButton.protocol === JoystickProtocol.CockpitAction) {
      actionsToCallback.push(mappedButton.value as CockpitAction)
    }
  })
  Object.values(actionsCallbacks).forEach((entry) => {
    if (actionsToCallback.includes(entry.action)) {
      entry.callback()
    }
  })
}

/**
 * Possible axes in the MAVLink protocol
 */
export enum MAVLinkAxis {
  X = 'x',
  Y = 'y',
  Z = 'z',
  R = 'r',
}
const mavlinkAvailableAxes = Object.values(MAVLinkAxis)
export const mavlinkAvailableButtons = sequentialArray(16)

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

export const allAvailableAxes: InputWithPrettyName[] = []
mavlinkAvailableAxes.forEach((axis) =>
  allAvailableAxes.push({ input: { protocol: JoystickProtocol.MAVLink, value: axis }, prettyName: axis })
)

Object.values(OtherProtocol).forEach((fn) =>
  allAvailableAxes.push({ input: { protocol: JoystickProtocol.Other, value: fn }, prettyName: fn })
)

export const allAvailableButtons: InputWithPrettyName[] = []
mavlinkAvailableButtons.forEach((btn) =>
  allAvailableButtons.push({ input: { protocol: JoystickProtocol.MAVLink, value: btn }, prettyName: btn.toString() })
)
Object.values(CockpitAction).forEach((action) =>
  allAvailableButtons.push({ input: { protocol: JoystickProtocol.CockpitAction, value: action }, prettyName: action })
)
Object.values(OtherProtocol).forEach((fn) =>
  allAvailableButtons.push({ input: { protocol: JoystickProtocol.Other, value: fn }, prettyName: fn })
)
