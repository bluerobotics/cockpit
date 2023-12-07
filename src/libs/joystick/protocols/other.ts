import { type ProtocolAction, JoystickProtocol } from '@/types/joystick'

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
