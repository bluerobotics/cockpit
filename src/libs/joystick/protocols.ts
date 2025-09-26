import { type ProtocolAction, JoystickProtocolActionsMapping } from '@/types/joystick'

import { availableCockpitActions } from './protocols/cockpit-actions'
import { availableDataLakeActions } from './protocols/data-lake'
import {
  availableMavlinkManualControlButtonFunctions,
  mavlinkManualControlAxes,
  migrateMavlinkManualControlButtons,
} from './protocols/mavlink-manual-control'
import { modifierKeyActions, otherAvailableActions } from './protocols/other'

export const allAvailableAxes = (): ProtocolAction[] => {
  return [
    ...Object.values(mavlinkManualControlAxes),
    ...Object.values(availableDataLakeActions()),
    otherAvailableActions.no_function,
  ]
}

export const allAvailableButtons = (): ProtocolAction[] => {
  return [
    ...Object.values(availableCockpitActions),
    ...Object.values(availableMavlinkManualControlButtonFunctions),
    ...Object.values(otherAvailableActions),
    ...Object.values(modifierKeyActions),
    ...Object.values(availableDataLakeActions()),
  ]
}

export const performJoystickMappingMigrations = (
  mappings: JoystickProtocolActionsMapping[]
): JoystickProtocolActionsMapping[] => {
  return migrateMavlinkManualControlButtons(mappings)
}
