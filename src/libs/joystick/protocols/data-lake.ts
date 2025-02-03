import { type DataLakeVariable, getAllDataLakeVariablesInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { setupPostPiniaConnection } from '@/libs/post-pinia-connections'
import { useControllerStore } from '@/stores/controller'
import { type ProtocolAction, CockpitModifierKeyOption, JoystickProtocol } from '@/types/joystick'

import { modifierKeyActions } from './other'

/**
 * An action to set a data lake variable
 */
export class DataLakeVariableAction implements ProtocolAction {
  readonly protocol = JoystickProtocol.DataLakeVariable
  /**
   * Variable ID
   */
  id: string
  /**
   * Human-readable name
   */
  name: string

  /**
   * Create a data lake variable action
   * @param {DataLakeVariable} variable The data lake variable to create an action for
   */
  constructor(variable: DataLakeVariable) {
    this.id = variable.id
    this.name = variable.name
  }
}

/**
 * Get all available data lake variable actions
 * @returns {DataLakeVariableAction[]} Array of available data lake variable actions
 */
export const availableDataLakeActions = (): Record<string, DataLakeVariableAction> => {
  const variables = getAllDataLakeVariablesInfo()
  const actions: Record<string, DataLakeVariableAction> = {}
  Object.entries(variables).forEach(([id, variable]) => {
    actions[id] = new DataLakeVariableAction(variable)
  })
  return actions
}

// Update data lake variables when joystick buttons are pressed
setupPostPiniaConnection(() => {
  const controllerStore = useControllerStore()
  controllerStore.registerControllerUpdateCallback((joystickState, actionsMapping, activeActions) => {
    if (!joystickState || !actionsMapping) return

    const useShift = activeActions.map((a) => a.id).includes(modifierKeyActions.shift.id)
    const modifierKeyId = useShift ? CockpitModifierKeyOption.shift : CockpitModifierKeyOption.regular

    joystickState.buttons
      .map((btnState, idx) => ({ id: idx, value: btnState }))
      .forEach((btn) => {
        const btnMapping = actionsMapping.buttonsCorrespondencies[modifierKeyId as CockpitModifierKeyOption][btn.id]
        if (btnMapping && btnMapping.action && btnMapping.action.protocol === JoystickProtocol.DataLakeVariable) {
          setDataLakeVariableData(btnMapping.action.id, Number(btn.value))
        }
      })
  })
})
