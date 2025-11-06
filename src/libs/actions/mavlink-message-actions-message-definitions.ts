import { MAVLinkType } from '../connection/m2r/messages/mavlink2rest-enum'
import { MessageFieldType } from './mavlink-message-actions'

/* eslint-disable jsdoc/require-jsdoc */
interface MessageField {
  value: number | string | boolean
  type: MessageFieldType
  description: string
  units?: string
  required: boolean
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
