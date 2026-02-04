import { MAVLinkType } from '../connection/m2r/messages/mavlink2rest-enum'
import { MessageFieldType } from './mavlink-message-actions'

/* eslint-disable jsdoc/require-jsdoc */
interface MessageField {
  value: number | string | boolean
  type: MessageFieldType
  descriptionKey: string
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
      descriptionKey: 'target_system',
      required: true,
    },
    target_component: {
      value: 1,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'target_component',
      required: true,
    },
    command: {
      value: 'MAV_CMD_COMPONENT_ARM_DISARM',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      descriptionKey: 'command',
      required: true,
    },
    confirmation: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'confirmation',
      required: true,
    },
    param1: {
      value: 1,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param1',
      required: false,
    },
    param2: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param2',
      required: false,
    },
    param3: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param3',
      required: false,
    },
    param4: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param4',
      required: false,
    },
    param5: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param5',
      required: false,
    },
    param6: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param6',
      required: false,
    },
    param7: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param7',
      required: false,
    },
  },
  [MAVLinkType.COMMAND_INT]: {
    target_system: {
      value: '{{autopilotSystemId}}',
      type: MessageFieldType.NUMBER,
      descriptionKey: 'target_system',
      required: true,
    },
    target_component: {
      value: 1,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'target_component',
      required: true,
    },
    command: {
      value: 'MAV_CMD_DO_REPOSITION',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      descriptionKey: 'command',
      required: true,
    },
    frame: {
      value: 'MAV_FRAME_GLOBAL',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      descriptionKey: 'frame',
      required: true,
    },
    current: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'current',
      required: true,
    },
    autocontinue: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'autocontinue',
      required: true,
    },
    param1: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param1',
      required: false,
    },
    param2: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param2',
      required: false,
    },
    param3: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param3',
      required: false,
    },
    param4: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param4',
      required: false,
    },
    x: {
      value: -275600000,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'x',
      required: false,
    },
    y: {
      value: -484500000,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'y',
      required: false,
    },
    z: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'z',
      required: false,
    },
  },
} as const
