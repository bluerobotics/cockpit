import { getAllActionLinks, saveActionLink } from '@/libs/actions/action-links'
import {
  createDataLakeVariable,
  DataLakeVariableType,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import { createTransformingFunction, getAllTransformingFunctions } from '@/libs/actions/data-lake-transformations'
import {
  getAllMavlinkMessageActionConfigs,
  MessageFieldType,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { MavCmd, MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { getUnindentedString } from '@/libs/utils'
import { customActionTypes } from '@/types/cockpit-actions'

import { availableCockpitActions, registerActionCallback } from './cockpit-actions'
import { DataLakeVariableAction } from './data-lake'

export let mavlinkCameraZoomActionId: string | undefined = undefined
export let mavlinkCameraFocusActionId: string | undefined = undefined

const joystickAxisConfig = [
  { key: 'axis_x', reverseVehicleTypes: ['copter', 'sub'], translationVehicleTypes: ['sub'] },
  { key: 'axis_y', reverseVehicleTypes: ['copter', 'sub'], translationVehicleTypes: ['sub'] },
  { key: 'axis_z', reverseVehicleTypes: ['rover'], translationVehicleTypes: ['copter', 'sub', 'rover', 'plane'] },
  { key: 'axis_r', reverseVehicleTypes: [] as string[], translationVehicleTypes: [] as string[] },
  { key: 'axis_s', reverseVehicleTypes: ['sub'], translationVehicleTypes: [] as string[] },
  { key: 'axis_t', reverseVehicleTypes: ['sub'], translationVehicleTypes: [] as string[] },
] as const

const axisInputId = (key: string): string => `joystick/inputs/${key.replace('_', '-')}`
const axisName = (key: string): string =>
  key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/**
 * Generates a JavaScript expression that evaluates to -1 when the vehicle type matches
 * one of the given types and reverse is active, or 1 otherwise
 * @param {string[]} vehicleTypes - Vehicle types that should trigger reversal
 * @returns {string} A data-lake expression string
 */
const getReverseExpression = (vehicleTypes: readonly string[]): string => {
  if (vehicleTypes.length === 0) return '1'
  if (vehicleTypes.length === 1) {
    return `('{{cockpit/vehicle/type}}' === '${vehicleTypes[0]}' && {{joystick/inputs/reverse}}) ? -1 : 1`
  }
  return `([${vehicleTypes
    .map((t) => `'${t}'`)
    .join(', ')}].includes('{{cockpit/vehicle/type}}') && {{joystick/inputs/reverse}}) ? -1 : 1`
}

/**
 * Generates a JavaScript expression that evaluates to the pilot gain value when the
 * vehicle type matches one of the given translation types, or 1 otherwise
 * @param {string[]} vehicleTypes - Vehicle types for which this axis is a translation axis
 * @returns {string} A data-lake expression string
 */
const getGainExpression = (vehicleTypes: readonly string[]): string => {
  if (vehicleTypes.length === 0) return '1'
  if (vehicleTypes.length === 1) {
    return `('{{cockpit/vehicle/type}}' === '${vehicleTypes[0]}') ? {{joystick/inputs/gain}} : 1`
  }
  return `([${vehicleTypes
    .map((t) => `'${t}'`)
    .join(', ')}].includes('{{cockpit/vehicle/type}}')) ? {{joystick/inputs/gain}} : 1`
}

/**
 * Pre-built data lake variable actions for joystick axis inputs, used in joystick profile mappings
 */
export const joystickInputAxes: Record<(typeof joystickAxisConfig)[number]['key'], DataLakeVariableAction> =
  Object.fromEntries(
    joystickAxisConfig.map((axis) => [
      axis.key,
      new DataLakeVariableAction({
        id: axisInputId(axis.key),
        name: axisName(axis.key),
        type: 'number' as DataLakeVariableType,
      }),
    ])
  ) as Record<(typeof joystickAxisConfig)[number]['key'], DataLakeVariableAction>

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

export const setupJoystickAxesResources = (): void => {
  const commonVariableConfig = { type: 'number' as DataLakeVariableType, allowUserToChangeValue: true }

  for (const axis of joystickAxisConfig) {
    const id = axisInputId(axis.key)
    const name = axisName(axis.key)
    const outputId = id.replace('/inputs/', '/outputs/')
    const scaleId = `${outputId}-scale`

    createDataLakeVariable({ id, name, ...commonVariableConfig }, 0)

    try {
      const existingScale = getAllTransformingFunctions().find((f) => f.id === scaleId)
      if (!existingScale) {
        createTransformingFunction(
          scaleId,
          `${name} Scale`,
          'number',
          `(${getReverseExpression(axis.reverseVehicleTypes)}) * (${getGainExpression(axis.translationVehicleTypes)})`,
          `Scale factor for ${name} combining reverse direction and pilot gain.`
        )
      }
    } catch (error) {
      console.error(`Error creating scale transforming function for ${name}:`, error)
    }

    try {
      const existingOutput = getAllTransformingFunctions().find((f) => f.id === outputId)
      if (!existingOutput) {
        createTransformingFunction(
          outputId,
          `${name} Output`,
          'number',
          `{{${scaleId}}} * {{${id}}}`,
          `Output value for MANUAL_CONTROL ${name}.`
        )
      }
    } catch (error) {
      console.error(`Error creating output transforming function for ${name}:`, error)
    }
  }
}

const reverseVariableId = 'joystick/inputs/reverse'

export const setupReverseResources = (): void => {
  createDataLakeVariable(
    {
      id: reverseVariableId,
      name: 'Reverse',
      type: 'boolean' as DataLakeVariableType,
      description: 'Trigger for user-specified reversing functionality',
      allowUserToChangeValue: true,
    },
    false
  )

  registerActionCallback(availableCockpitActions.start_reversing, () => {
    setDataLakeVariableData(reverseVariableId, true)
  })
  registerActionCallback(availableCockpitActions.stop_reversing, () => {
    setDataLakeVariableData(reverseVariableId, false)
  })
  registerActionCallback(availableCockpitActions.toggle_reversing, () => {
    setDataLakeVariableData(reverseVariableId, !getDataLakeVariableData(reverseVariableId))
  })
}

const gainVariableId = 'joystick/inputs/gain'
const gainStepsVariableId = 'joystick/inputs/gain-steps'

export const setupPilotGainResources = (): void => {
  if (!getDataLakeVariableInfo(gainVariableId)) {
    createDataLakeVariable(
      {
        id: gainVariableId,
        name: 'Pilot Gain',
        type: 'number' as DataLakeVariableType,
        description:
          'Pilot gain multiplier applied to manual control axes (0 to 1). By default only applied to vehicle translation axes.',
        allowUserToChangeValue: true,
        persistent: true,
        persistValue: true,
      },
      1
    )
  }
  if (!getDataLakeVariableInfo(gainStepsVariableId)) {
    createDataLakeVariable(
      {
        id: gainStepsVariableId,
        name: 'Pilot Gain Steps',
        type: 'number' as DataLakeVariableType,
        description: 'Number of steps from minimum to maximum pilot gain',
        allowUserToChangeValue: true,
        persistent: true,
        persistValue: true,
      },
      4
    )
  }

  registerActionCallback(availableCockpitActions.increase_pilot_gain, () => {
    const gain = Number(getDataLakeVariableData(gainVariableId))
    const steps = Number(getDataLakeVariableData(gainStepsVariableId))
    setDataLakeVariableData(gainVariableId, Math.min(1, gain + 1 / steps))
  })
  registerActionCallback(availableCockpitActions.reduce_pilot_gain, () => {
    const gain = Number(getDataLakeVariableData(gainVariableId))
    const steps = Number(getDataLakeVariableData(gainStepsVariableId))
    setDataLakeVariableData(gainVariableId, Math.max(0, gain - 1 / steps))
  })
}

export const setupPredefinedLakeAndActionResources = (): void => {
  setupMavlinkCameraResources()
  setupReverseResources()
  setupPilotGainResources()
  setupJoystickAxesResources()
}
