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

    joystickState.buttons
      .map((btnState, idx) => ({ id: idx, value: btnState }))
      .forEach((btn) => {
        // Check both regular and shift mappings
        const regularMapping = actionsMapping.buttonsCorrespondencies[CockpitModifierKeyOption.regular][btn.id]
        const shiftMapping = actionsMapping.buttonsCorrespondencies[CockpitModifierKeyOption.shift][btn.id]

        // Handle regular button press
        if (regularMapping?.action?.protocol === JoystickProtocol.DataLakeVariable) {
          const shouldBeActive = btn.value && !useShift
          setDataLakeVariableData(regularMapping.action.id, shouldBeActive ? Number(btn.value) : 0)
        }

        // Handle shift+button press
        if (shiftMapping?.action?.protocol === JoystickProtocol.DataLakeVariable) {
          const shouldBeActive = btn.value && useShift
          setDataLakeVariableData(shiftMapping.action.id, shouldBeActive ? Number(btn.value) : 0)
        }
      })
  })
})
