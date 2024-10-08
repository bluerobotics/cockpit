import { type ProtocolAction } from '@/types/joystick'

import { availableCockpitActions } from './protocols/cockpit-actions'
import {
  availableMavlinkManualControlButtonFunctions,
  mavlinkManualControlAxes,
} from './protocols/mavlink-manual-control'
import { modifierKeyActions, otherAvailableActions } from './protocols/other'

export const allAvailableAxes = (): ProtocolAction[] => {
  return [...Object.values(mavlinkManualControlAxes), ...Object.values(otherAvailableActions)]
}

export const allAvailableButtons = (): ProtocolAction[] => {
  return [
    ...Object.values(availableCockpitActions),
    ...Object.values(availableMavlinkManualControlButtonFunctions),
    ...Object.values(otherAvailableActions),
    ...Object.values(modifierKeyActions),
  ]
}
