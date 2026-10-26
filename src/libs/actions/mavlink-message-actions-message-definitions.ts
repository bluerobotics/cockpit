import { MessageFieldType } from '@/types/cockpit-actions'

import { MAVLinkType } from '../connection/m2r/messages/mavlink2rest-enum'
import mavlinkDefinition, { type EnumEntryParam } from '../vehicle/mavlink/mavlink-definition'

/* eslint-disable jsdoc/require-jsdoc */
interface MessageField {
  value: number | string | boolean
  type: MessageFieldType
  description: string
  units?: string
  required: boolean
}

interface CommandParamFieldInfo {
  label: string
  hint?: string
  unused?: boolean
}
/* eslint-enable jsdoc/require-jsdoc */

// Partial message field definitions for each MAVLink message type
export const messageFieldDefinitions: Partial<Record<MAVLinkType, Record<string, MessageField>>> = {
  [MAVLinkType.COMMAND_LONG]: {
    target_system: {
      value: '{{autopilotSystemId}}',
      type: MessageFieldType.NUMBER,
      description: 'System ID of target system',
      required: true,
    },
    target_component: {
      value: 1,
      type: MessageFieldType.NUMBER,
      description: 'Component ID of target component',
      required: true,
    },
    command: {
      value: 'MAV_CMD_COMPONENT_ARM_DISARM',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      description: 'Command ID',
      required: true,
    },
    confirmation: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Confirmation value (0: first transmission, 1-255: confirmations)',
      required: true,
    },
    param1: {
      value: 1,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 1',
      required: false,
    },
    param2: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 2',
      required: false,
    },
    param3: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 3',
      required: false,
    },
    param4: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 4',
      required: false,
    },
    param5: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 5',
      required: false,
    },
    param6: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 6',
      required: false,
    },
    param7: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 7',
      required: false,
    },
  },
  [MAVLinkType.COMMAND_INT]: {
    target_system: {
      value: '{{autopilotSystemId}}',
      type: MessageFieldType.NUMBER,
      description: 'System ID of target system',
      required: true,
    },
    target_component: {
      value: 1,
      type: MessageFieldType.NUMBER,
      description: 'Component ID of target component',
      required: true,
    },
    command: {
      value: 'MAV_CMD_DO_REPOSITION',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      description: 'Command ID',
      required: true,
    },
    frame: {
      value: 'MAV_FRAME_GLOBAL',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      description: 'Coordinate frame',
      required: true,
    },
    current: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Current sequence number',
      required: true,
    },
    autocontinue: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Autocontinue bit',
      required: true,
    },
    param1: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 1',
      required: false,
    },
    param2: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 2',
      required: false,
    },
    param3: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 3',
      required: false,
    },
    param4: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Parameter 4',
      required: false,
    },
    x: {
      value: -275600000,
      type: MessageFieldType.NUMBER,
      description: 'Latitude',
      required: false,
    },
    y: {
      value: -484500000,
      type: MessageFieldType.NUMBER,
      description: 'Longitude',
      required: false,
    },
    z: {
      value: 0,
      type: MessageFieldType.NUMBER,
      description: 'Altitude',
      required: false,
    },
  },
} as const

// COMMAND_INT carries params 5-7 as the x/y/z position fields
const commandParamIndexByField: Record<string, string> = {
  param1: '1',
  param2: '2',
  param3: '3',
  param4: '4',
  param5: '5',
  param6: '6',
  param7: '7',
  x: '5',
  y: '6',
  z: '7',
}

const paramHint = (param: EnumEntryParam): string => {
  const range = [param.minValue && `Min ${param.minValue}`, param.maxValue && `Max ${param.maxValue}`]
  const extras = [param.enum && `Values from ${param.enum}`, ...range, param.default && `Default ${param.default}`]
  return [param.description, ...extras].filter(Boolean).join('. ')
}

/**
 * Describe a command message's param fields with the MAV_CMD definition of the chosen command
 * @param {string} command - The MAV_CMD entry name, e.g. 'MAV_CMD_DO_REPOSITION'
 * @returns {Record<string, CommandParamFieldInfo>} Label, hint and whether the command ignores it, per field key, empty if the command is unknown
 */
export const commandParamFieldInfo = (command: string): Record<string, CommandParamFieldInfo> => {
  const entry = mavlinkDefinition.enumEntry('MAV_CMD', command)
  if (!entry) return {}

  const info: Record<string, CommandParamFieldInfo> = {}
  for (const [field, index] of Object.entries(commandParamIndexByField)) {
    const param = entry.params?.find((p) => p.index === index)
    if (!param) {
      info[field] = { label: `${field} · Unused`, unused: true }
      continue
    }
    if (param.reserved === 'true') {
      info[field] = { label: `${field} · Reserved`, hint: param.default ? `Send ${param.default}` : undefined }
      continue
    }
    // COMMAND_INT x/y are int32 scaled (degE7, or m×1e4 in local frames), so the float param's units and limits don't apply
    const isScaledInt = field === 'x' || field === 'y'
    const units = param.units && !isScaledInt ? ` (${param.units})` : ''
    info[field] = {
      label: `${param.label ?? param.description ?? field}${units}`,
      hint: isScaledInt ? param.description : paramHint(param),
    }
  }
  return info
}
