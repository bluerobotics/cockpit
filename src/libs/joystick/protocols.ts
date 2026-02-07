import { type ProtocolAction, JoystickProtocolActionsMapping } from '@/types/joystick'

import { getAvailableCockpitActions } from './protocols/cockpit-actions'
import { availableDataLakeActions } from './protocols/data-lake'
import {
  availableMavlinkManualControlButtonFunctions,
  mavlinkManualControlAxes,
  migrateMavlinkManualControlButtons,
} from './protocols/mavlink-manual-control'
import {
  getModifierKeyActions,
  getOtherAvailableActions,
  modifierKeyActions,
  otherAvailableActions,
} from './protocols/other'

export const allAvailableAxes = (): ProtocolAction[] => {
  return [
    ...Object.values(mavlinkManualControlAxes),
    ...Object.values(availableDataLakeActions()),
    getOtherAvailableActions().no_function,
  ]
}

export const allAvailableButtons = (): ProtocolAction[] => {
  return [
    ...Object.values(getAvailableCockpitActions()),
    ...Object.values(availableMavlinkManualControlButtonFunctions),
    ...Object.values(getOtherAvailableActions()),
    ...Object.values(getModifierKeyActions()),
    ...Object.values(availableDataLakeActions()),
  ]
}

export const performJoystickMappingMigrations = (
  mappings: JoystickProtocolActionsMapping[]
): JoystickProtocolActionsMapping[] => {
  return migrateMavlinkManualControlButtons(mappings)
}
