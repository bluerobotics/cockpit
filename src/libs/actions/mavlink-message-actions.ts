import { sendMavlinkMessage } from '../communication/mavlink'
import type { Message } from '../connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '../connection/m2r/messages/mavlink2rest-enum'
import {
  availableCockpitActions,
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { isNumber } from '../utils'
import {
  findDataLakeInputsInString,
  getDataLakeVariableIdFromInput,
  replaceDataLakeInputsInJsonString,
} from '../utils-data-lake'
import { getDataLakeVariableData } from './data-lake'
const mavlinkMessageActionIdPrefix = 'mavlink-message-action'

/**
 * Enum with the possible message field types
 */
export enum MessageFieldType {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
  TYPE_STRUCT_ENUM = 'type_struct_enum',
}

export type MavlinkMessageConfigField = {
  /**
   * The type of the field
   * Determines how the value is processed
   */
  type: MessageFieldType
  /**
   * The value of the field
   */
  value: any
}

export type MavlinkMessageConfig = Record<string, MavlinkMessageConfigField> | string

export type MavlinkMessageActionConfig = {
  /**
   * The name of the action
   */
  name: string
  /**
   * The type of MAVLink message to send
   */
  messageType: MAVLinkType
  /**
   * The key-value pairs of the message fields
   */
  messageConfig: MavlinkMessageConfig
}

let registeredMavlinkMessageActionConfigs: Record<string, MavlinkMessageActionConfig> = {}

export const registerMavlinkMessageActionConfig = (action: MavlinkMessageActionConfig): string => {
  const id = `${mavlinkMessageActionIdPrefix} (${action.name})`
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
  const savedActions = localStorage.getItem('cockpit-mavlink-message-actions')
  if (savedActions) {
    registeredMavlinkMessageActionConfigs = JSON.parse(savedActions)
  }
}

export const saveMavlinkMessageActionConfigs = (): void => {
  localStorage.setItem('cockpit-mavlink-message-actions', JSON.stringify(registeredMavlinkMessageActionConfigs))
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
