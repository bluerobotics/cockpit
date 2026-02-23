import i18n from '@/plugins/i18n'
import { type ProtocolAction, CockpitModifierKeyOption, JoystickProtocol } from '@/types/joystick'

/**
 * Possible other protocol functions
 */
export enum OtherProtocol {
  no_function = 'no_function',
}

export const getOtherAvailableActions = (): { [key in OtherProtocol]: ProtocolAction } => ({
  [OtherProtocol.no_function]: {
    protocol: JoystickProtocol.Other,
    id: OtherProtocol.no_function,
    name: i18n.global.t('configuration.joystick.noFunction'),
  },
})

// For backward compatibility
export const otherAvailableActions = getOtherAvailableActions()

export const getModifierKeyActions = (): { [key in CockpitModifierKeyOption]: ProtocolAction } => ({
  [CockpitModifierKeyOption.regular]: {
    protocol: JoystickProtocol.CockpitModifierKey,
    id: CockpitModifierKeyOption.regular,
    name: i18n.global.t('configuration.joystick.regular'),
  },
  [CockpitModifierKeyOption.shift]: {
    protocol: JoystickProtocol.CockpitModifierKey,
    id: CockpitModifierKeyOption.shift,
    name: i18n.global.t('configuration.joystick.shift'),
  },
})

// For backward compatibility
export const modifierKeyActions = getModifierKeyActions()
