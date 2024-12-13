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

export const registerMavlinkMessageActionConfig = (action: MavlinkMessageActionConfig): void => {
  const id = `${mavlinkMessageActionIdPrefix} (${action.name})`
  registeredMavlinkMessageActionConfigs[id] = action
  saveMavlinkMessageActionConfigs()
  updateCockpitActions()
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
    const configWithDynamicValues = config.replace(/{{\s*([^{}\s]+)\s*}}/g, (match, p1) => {
      const variableValue = getDataLakeVariableData(p1)
      return variableValue ? variableValue.toString() : match
    })
    processedConfig = JSON.parse(configWithDynamicValues)
  } else {
    for (const [k, v] of Object.entries(config)) {
      if (typeof v.value === 'string' && v.value.startsWith('{{') && v.value.endsWith('}}')) {
        const variableName = v.value.slice(2, -2).trim()
        const variableValue = getDataLakeVariableData(variableName)
        processedConfig[k] = typeof variableValue === 'boolean' ? (variableValue ? 1 : 0) : variableValue
      } else if (v.type === MessageFieldType.TYPE_STRUCT_ENUM) {
        processedConfig[k] = { type: v.value }
      } else if (v.type === MessageFieldType.NUMBER) {
        processedConfig[k] = Number(v.value)
      } else {
        processedConfig[k] = v.value
      }
    }
  }

  return processedConfig
}

// Initialize actions on module load
loadMavlinkMessageActionConfigs()
updateCockpitActions()
