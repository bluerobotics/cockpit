import { getDataLakeVariableInfo } from '@/libs/actions/data-lake'
import { getAllTransformingFunctions } from '@/libs/actions/data-lake-transformations'
import { type ProtocolAction, JoystickProtocolActionsMapping } from '@/types/joystick'

import { availableCockpitActions } from './protocols/cockpit-actions'
import { availableDataLakeActions } from './protocols/data-lake'
import {
  availableMavlinkManualControlButtonFunctions,
  MAVLinkButtonFunction,
  migrateMavlinkManualControlAxes,
  migrateMavlinkManualControlButtons,
} from './protocols/mavlink-manual-control'
import { modifierKeyActions, otherAvailableActions } from './protocols/other'
import { mavlinkCameraFocusActionId, mavlinkCameraZoomActionId } from './protocols/predefined-resources'

export const allAvailableAxes = (): ProtocolAction[] => {
  return [...Object.values(availableDataLakeActions()), otherAvailableActions.no_function]
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

/**
 * Whether an on/off input, like a joystick button or a keyboard key, can be assigned an action
 * @param {string} actionId The id of the action to check
 * @returns {boolean} False for excluded actions, transforming functions and data-lake variables it cannot write into
 */
export const isAssignableToButton = (actionId: string): boolean => {
  const excludedIds: (string | undefined)[] = [
    MAVLinkButtonFunction.arm,
    MAVLinkButtonFunction.disarm,
    mavlinkCameraZoomActionId,
    mavlinkCameraFocusActionId,
  ]
  if (excludedIds.includes(actionId)) return false

  // Do not show transforming functions, as they are calculated, not to be injected
  if (getAllTransformingFunctions().some((v) => v.id === actionId)) return false

  const dataLakeVariableInfo = getDataLakeVariableInfo(actionId)
  if (!dataLakeVariableInfo) return true
  return dataLakeVariableInfo.allowUserToChangeValue === true && dataLakeVariableInfo.type !== 'string'
}

export const performJoystickMappingMigrations = (
  mappings: JoystickProtocolActionsMapping[]
): JoystickProtocolActionsMapping[] => {
  return migrateMavlinkManualControlAxes(migrateMavlinkManualControlButtons(mappings))
}
