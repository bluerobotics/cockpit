import { MavlinkMessageActionConfig, MavlinkMessageConfig, MessageFieldType } from '@/types/cockpit-actions'

import { sendMavlinkMessage } from '../communication/mavlink'
import type { Message } from '../connection/m2r/messages/mavlink2rest'
import {
  availableCockpitActions,
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { settingsManager } from '../settings-management'
import { isNumber } from '../utils'
import {
  findDataLakeInputsInString,
  getDataLakeVariableIdFromInput,
  replaceDataLakeInputsInJsonString,
} from '../utils-data-lake'
import { getDataLakeVariableData } from './data-lake'
const mavlinkMessageActionIdPrefix = 'mavlink-message-action'

let registeredMavlinkMessageActionConfigs: Record<string, MavlinkMessageActionConfig> = {}

/**
 * Register a new MAVLink message action config and create a cockpit action for it
 * @param {MavlinkMessageActionConfig} action - The action config to register
 * @param {string} customId - Optional explicit ID (e.g. from an extension manifest). Falls back to a generated ID.
 * @returns {string} The ID under which the action was registered
 */
export const registerMavlinkMessageActionConfig = (action: MavlinkMessageActionConfig, customId?: string): string => {
  const id = customId ?? `${mavlinkMessageActionIdPrefix} (${action.name})`
  registeredMavlinkMessageActionConfigs[id] = action
  saveMavlinkMessageActionConfigs()
  updateCockpitActions()
  return id
}

export const getMavlinkMessageActionConfig = (id: string): MavlinkMessageActionConfig | undefined => {
  return registeredMavlinkMessageActionConfigs[id]
}

export const getAllMavlinkMessageActionConfigs = (): Record<string, MavlinkMessageActionConfig> => {
  return registeredMavlinkMessageActionConfigs
}

export const deleteMavlinkMessageActionConfig = (id: string): void => {
  deleteAction(id as CockpitActionsFunction)
  delete registeredMavlinkMessageActionConfigs[id]
  saveMavlinkMessageActionConfigs()
  updateCockpitActions()
}

export const updateMavlinkMessageActionConfig = (id: string, updatedAction: MavlinkMessageActionConfig): void => {
  registeredMavlinkMessageActionConfigs[id] = updatedAction
  saveMavlinkMessageActionConfigs()
  updateCockpitActions()
}

export const updateCockpitActions = (): void => {
  // Remove existing MAVLink message actions
  Object.entries(availableCockpitActions).forEach(([id]) => {
    if (id.includes(mavlinkMessageActionIdPrefix)) {
      deleteAction(id as CockpitActionsFunction)
    }
  })

  // Register new actions
  const mavlinkActions = getAllMavlinkMessageActionConfigs()
  for (const [id, action] of Object.entries(mavlinkActions)) {
    try {
      const cockpitAction = new CockpitAction(id as CockpitActionsFunction, action.name)
      registerNewAction(cockpitAction)
      registerActionCallback(cockpitAction, getMavlinkMessageActionCallback(id))
    } catch (error) {
      console.error(`Error registering action ${id}: ${error}`)
    }
  }
}

export const loadMavlinkMessageActionConfigs = (): void => {
  const savedActions = settingsManager.getKeyValue('cockpit-mavlink-message-actions')
  if (savedActions !== undefined) {
    registeredMavlinkMessageActionConfigs = savedActions as Record<string, MavlinkMessageActionConfig>
  }
}

export const saveMavlinkMessageActionConfigs = (): void => {
  settingsManager.setKeyValue('cockpit-mavlink-message-actions', registeredMavlinkMessageActionConfigs)
}

export type MavlinkMessageActionCallback = () => void

export const getMavlinkMessageActionCallback = (id: string): MavlinkMessageActionCallback => {
  return () => {
    const action = getMavlinkMessageActionConfig(id)
    if (!action) {
      throw new Error(`Action with id ${id} not found.`)
    }

    const message: Message = {
      type: action.messageType,
      ...processMessageConfig(action.messageConfig),
    }
    sendMavlinkMessage(message)
  }
}

const processMessageConfig = (config: MavlinkMessageConfig): Record<string, any> => {
  let processedConfig: Record<string, any> = {}
  if (typeof config === 'string') {
    const configWithDynamicValues = replaceDataLakeInputsInJsonString(config)
    processedConfig = JSON.parse(configWithDynamicValues)
  } else {
    for (const [k, v] of Object.entries(config)) {
      if (v.type === MessageFieldType.TYPE_STRUCT_ENUM) {
        processedConfig[k] = { type: v.value }
      } else {
        const inputs = findDataLakeInputsInString(v.value)
        const isNumberValue = isNumber(v.value)
        if (inputs.length === 0) {
          processedConfig[k] = isNumberValue ? Number(v.value) : v.value
        } else {
          const variableId = getDataLakeVariableIdFromInput(inputs[0])
          if (!variableId) {
            processedConfig[k] = isNumberValue ? Number(v.value) : v.value
          } else {
            const variableData = getDataLakeVariableData(variableId)
            processedConfig[k] = variableData
          }
        }
      }
    }
  }

  return processedConfig
}

// Initialize actions on module load
loadMavlinkMessageActionConfigs()
updateCockpitActions()
