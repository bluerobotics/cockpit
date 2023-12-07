import { type ProtocolAction, CockpitModifierKeyOption, JoystickProtocol } from '@/types/joystick'

/**
 * Possible other protocol functions
 */
export enum OtherProtocol {
  no_function = 'no_function',
}

export const otherAvailableActions: { [key in OtherProtocol]: ProtocolAction } = {
  [OtherProtocol.no_function]: {
    protocol: JoystickProtocol.Other,
    id: OtherProtocol.no_function,
    name: 'No function',
  },
}

export const modifierKeyActions: { [key in CockpitModifierKeyOption]: ProtocolAction } = {
  [CockpitModifierKeyOption.regular]: {
    protocol: JoystickProtocol.CockpitModifierKey,
    id: CockpitModifierKeyOption.regular,
    name: 'Regular',
  },
  [CockpitModifierKeyOption.shift]: {
    protocol: JoystickProtocol.CockpitModifierKey,
    id: CockpitModifierKeyOption.shift,
    name: 'Shift',
  },
}
