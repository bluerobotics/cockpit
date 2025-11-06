import { getAllActionLinks, saveActionLink } from '@/libs/actions/action-links'
import { createDataLakeVariable, DataLakeVariableType } from '@/libs/actions/data-lake'
import { createTransformingFunction, getAllTransformingFunctions } from '@/libs/actions/data-lake-transformations'
import {
  getAllMavlinkMessageActionConfigs,
  MessageFieldType,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { MavCmd, MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { getUnindentedString } from '@/libs/utils'
import { customActionTypes } from '@/types/cockpit-actions'

export let mavlinkCameraZoomActionId: string | undefined = undefined
export let mavlinkCameraFocusActionId: string | undefined = undefined

export const setupMavlinkCameraResources = (): void => {
  const commonVariableConfig = { type: 'number' as DataLakeVariableType, allowUserToChangeValue: true }
  // Initialize camera zoom variables
  createDataLakeVariable({ id: 'camera-zoom-decrease', name: 'Camera Zoom Decrease', ...commonVariableConfig }, 0)
  createDataLakeVariable({ id: 'camera-zoom-increase', name: 'Camera Zoom Increase', ...commonVariableConfig }, 0)

  // Initialize camera focus variables
  createDataLakeVariable({ id: 'camera-focus-decrease', name: 'Camera Focus Decrease', ...commonVariableConfig }, 0)
  createDataLakeVariable({ id: 'camera-focus-increase', name: 'Camera Focus Increase', ...commonVariableConfig }, 0)

  // Initialize camera zoom transforming function
  try {
    const func = getAllTransformingFunctions().find((f) => f.id === 'camera-zoom')
    if (!func) {
      createTransformingFunction(
        'camera-zoom',
        'Camera Zoom',
        'number',
        getUnindentedString(`
          const zoom = {{camera-zoom-increase}} - {{camera-zoom-decrease}}
          return zoom < 0.05 && zoom > -0.05 ? 0 : Math.max(Math.min(1, zoom), -1)
        `),
        'Used to control the camera zoom. The value is the difference between {{camera-zoom-increase}} and {{camera-zoom-decrease}}.'
      )
    }
  } catch (error) {
    console.error('Error creating camera zoom transforming function:', error)
  }

  // Initialize camera focus transforming function
  try {
    const func = getAllTransformingFunctions().find((f) => f.id === 'camera-focus')
    if (!func) {
      createTransformingFunction(
        'camera-focus',
        'Camera Focus',
        'number',
        getUnindentedString(`
          const focus = {{camera-focus-increase}} - {{camera-focus-decrease}}
          return focus < 0.05 && focus > -0.05 ? 0 : Math.max(Math.min(1, focus), -1)
        `),
        'Used to control the camera focus. The value is the difference between {{camera-focus-increase}} and {{camera-focus-decrease}}.'
      )
    }
  } catch (error) {
    console.error('Error creating camera focus transforming function:', error)
  }

  const existingActions = getAllMavlinkMessageActionConfigs()

  // Create MAVLink message action for camera zoom (if not already registered)
  const cameraZoomAction = {
    name: 'Camera Zoom (MAVLink)',
    messageType: MAVLinkType.COMMAND_LONG,
    messageConfig: {
      target_system: { value: '{{autopilotSystemId}}', type: MessageFieldType.NUMBER },
      target_component: { value: 1, type: MessageFieldType.NUMBER },
      command: { value: MavCmd.MAV_CMD_SET_CAMERA_ZOOM, type: MessageFieldType.TYPE_STRUCT_ENUM },
      confirmation: { value: 0, type: MessageFieldType.NUMBER },
      param1: { value: 1, type: MessageFieldType.NUMBER }, // Continously send up/down/stop commands
      param2: { value: '{{camera-zoom}}', type: MessageFieldType.NUMBER }, // Zoom value, from -1 to +1
      param3: { value: 0, type: MessageFieldType.NUMBER }, // Control all cameras (ID = 0)
      param4: { value: 0, type: MessageFieldType.NUMBER }, // Unused
      param5: { value: 0, type: MessageFieldType.NUMBER }, // Unused
      param6: { value: 0, type: MessageFieldType.NUMBER }, // Unused
      param7: { value: 0, type: MessageFieldType.NUMBER }, // Unused
    },
  }

  const existingCameraZoomAction = Object.entries(existingActions).find(([, a]) => a.name === cameraZoomAction.name)
  if (existingCameraZoomAction) {
    mavlinkCameraZoomActionId = existingCameraZoomAction[0]
  } else {
    mavlinkCameraZoomActionId = registerMavlinkMessageActionConfig(cameraZoomAction)
  }

  // Create MAVLink message action for camera focus (if not already registered)
  const cameraFocusAction = {
    name: 'Camera Focus (MAVLink)',
    messageType: MAVLinkType.COMMAND_LONG,
    messageConfig: {
      target_system: { value: '{{autopilotSystemId}}', type: MessageFieldType.NUMBER },
      target_component: { value: 1, type: MessageFieldType.NUMBER },
      command: { value: MavCmd.MAV_CMD_SET_CAMERA_FOCUS, type: MessageFieldType.TYPE_STRUCT_ENUM },
      confirmation: { value: 0, type: MessageFieldType.NUMBER },
      param1: { value: 1, type: MessageFieldType.NUMBER }, // Continously send up/down/stop commands
      param2: { value: '{{camera-focus}}', type: MessageFieldType.NUMBER }, // Focus value, from -1 to +1
      param3: { value: 0, type: MessageFieldType.NUMBER }, // Control all cameras (ID = 0)
      param4: { value: 0, type: MessageFieldType.NUMBER }, // Unused
      param5: { value: 0, type: MessageFieldType.NUMBER }, // Unused
      param6: { value: 0, type: MessageFieldType.NUMBER }, // Unused
      param7: { value: 0, type: MessageFieldType.NUMBER }, // Unused
    },
  }

  const existingCameraFocusAction = Object.entries(existingActions).find(([, a]) => a.name === cameraFocusAction.name)
  if (existingCameraFocusAction) {
    mavlinkCameraFocusActionId = existingCameraFocusAction[0]
  } else {
    mavlinkCameraFocusActionId = registerMavlinkMessageActionConfig(cameraFocusAction)
  }

  // Link the camera zoom and focus actions to the camera zoom and focus variables (if not already linked)
  // Enforce a minimum interval of 100ms between consecutive executions so we don't overload the autopilot
  const existingLinks = getAllActionLinks()
  if (!existingLinks[mavlinkCameraZoomActionId] || existingLinks[mavlinkCameraZoomActionId].minInterval < 100) {
    saveActionLink(mavlinkCameraZoomActionId, customActionTypes.mavlinkMessage, ['camera-zoom'], 100)
  }
  if (!existingLinks[mavlinkCameraFocusActionId] || existingLinks[mavlinkCameraFocusActionId].minInterval < 100) {
    saveActionLink(mavlinkCameraFocusActionId, customActionTypes.mavlinkMessage, ['camera-focus'], 100)
  }
}

export const setupPredefinedLakeAndActionResources = (): void => {
  setupMavlinkCameraResources()
}
