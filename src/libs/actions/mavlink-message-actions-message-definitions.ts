import { MAVLinkType } from '../connection/m2r/messages/mavlink2rest-enum'
import { MessageFieldType } from './mavlink-message-actions'

/* eslint-disable jsdoc/require-jsdoc */
interface MessageField {
  value: number | string | boolean
  type: MessageFieldType
  /**
   * i18n key suffix used to look up a translation under
   * `views.ConfigurationActionsView.mavlinkAction.fieldDescriptions.<descriptionKey>`.
   * Falls back to {@link description} when the key is not found in the active locale.
   */
  descriptionKey: string
  /** English description shown as fallback when no translation is available */
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
      descriptionKey: 'target_system',
      description: 'System ID of target system',
      required: true,
    },
    target_component: {
      value: 1,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'target_component',
      description: 'Component ID of target component',
      required: true,
    },
    command: {
      value: 'MAV_CMD_COMPONENT_ARM_DISARM',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      descriptionKey: 'command',
      description: 'Command ID',
      required: true,
    },
    confirmation: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'confirmation',
      description: 'Confirmation value (0: first transmission, 1-255: confirmations)',
      required: true,
    },
    param1: {
      value: 1,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param1',
      description: 'Parameter 1',
      required: false,
    },
    param2: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param2',
      description: 'Parameter 2',
      required: false,
    },
    param3: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param3',
      description: 'Parameter 3',
      required: false,
    },
    param4: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param4',
      description: 'Parameter 4',
      required: false,
    },
    param5: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param5',
      description: 'Parameter 5',
      required: false,
    },
    param6: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param6',
      description: 'Parameter 6',
      required: false,
    },
    param7: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param7',
      description: 'Parameter 7',
      required: false,
    },
  },
  [MAVLinkType.COMMAND_INT]: {
    target_system: {
      value: '{{autopilotSystemId}}',
      type: MessageFieldType.NUMBER,
      descriptionKey: 'target_system',
      description: 'System ID of target system',
      required: true,
    },
    target_component: {
      value: 1,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'target_component',
      description: 'Component ID of target component',
      required: true,
    },
    command: {
      value: 'MAV_CMD_DO_REPOSITION',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      descriptionKey: 'command',
      description: 'Command ID',
      required: true,
    },
    frame: {
      value: 'MAV_FRAME_GLOBAL',
      type: MessageFieldType.TYPE_STRUCT_ENUM,
      descriptionKey: 'frame',
      description: 'Coordinate frame',
      required: true,
    },
    current: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'current',
      description: 'Current sequence number',
      required: true,
    },
    autocontinue: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'autocontinue',
      description: 'Autocontinue bit',
      required: true,
    },
    param1: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param1',
      description: 'Parameter 1',
      required: false,
    },
    param2: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param2',
      description: 'Parameter 2',
      required: false,
    },
    param3: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param3',
      description: 'Parameter 3',
      required: false,
    },
    param4: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'param4',
      description: 'Parameter 4',
      required: false,
    },
    x: {
      value: -275600000,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'x',
      description: 'Latitude',
      required: false,
    },
    y: {
      value: -484500000,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'y',
      description: 'Longitude',
      required: false,
    },
    z: {
      value: 0,
      type: MessageFieldType.NUMBER,
      descriptionKey: 'z',
      description: 'Altitude',
      required: false,
    },
  },
} as const
