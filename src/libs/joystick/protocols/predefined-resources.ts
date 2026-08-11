import { getAllActionLinks, saveActionLink } from '@/libs/actions/action-links'
import { createDataLakeVariable, DataLakeVariableType } from '@/libs/actions/data-lake'
import { createTransformingFunction, getAllTransformingFunctions } from '@/libs/actions/data-lake-transformations'
import {
  getAllMavlinkMessageActionConfigs,
  registerMavlinkMessageActionConfig,
} from '@/libs/actions/mavlink-message-actions'
import { MavCmd, MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { getUnindentedString } from '@/libs/utils'
import { MessageFieldType } from '@/types/cockpit-actions'
import { customActionTypes } from '@/types/cockpit-actions'

import { DataLakeVariableAction } from './data-lake'

export let mavlinkCameraZoomActionId: string | undefined = undefined
export let mavlinkCameraFocusActionId: string | undefined = undefined

// Info required to map joystick axis inputs to MAVLink MANUAL_CONTROL outputs, via the data lake
const joystickAxisConfig = [
  { key: 'axis_x', name: 'Axis X', inputId: 'inputs/mavlink/axis-x', outputId: 'outputs/mavlink/axis-x' },
  { key: 'axis_y', name: 'Axis Y', inputId: 'inputs/mavlink/axis-y', outputId: 'outputs/mavlink/axis-y' },
  { key: 'axis_z', name: 'Axis Z', inputId: 'inputs/mavlink/axis-z', outputId: 'outputs/mavlink/axis-z' },
  { key: 'axis_r', name: 'Axis R', inputId: 'inputs/mavlink/axis-r', outputId: 'outputs/mavlink/axis-r' },
  { key: 'axis_s', name: 'Axis S', inputId: 'inputs/mavlink/axis-s', outputId: 'outputs/mavlink/axis-s' },
  { key: 'axis_t', name: 'Axis T', inputId: 'inputs/mavlink/axis-t', outputId: 'outputs/mavlink/axis-t' },
] as const

/**
 * Pre-built data lake variable actions for joystick axis inputs, used in joystick profile mappings
 */
export const joystickInputAxes: Record<(typeof joystickAxisConfig)[number]['key'], DataLakeVariableAction> =
  Object.fromEntries(
    joystickAxisConfig.map((axis) => [
      axis.key,
      new DataLakeVariableAction({
        id: axis.inputId,
        name: axis.name,
        type: 'number' as DataLakeVariableType,
      }),
    ])
  ) as Record<(typeof joystickAxisConfig)[number]['key'], DataLakeVariableAction>

const setupMavlinkCameraResources = (): void => {
  const commonVariableConfig = { type: 'number' as DataLakeVariableType, allowUserToChangeValue: true }
  // Initialize camera zoom variables
  createDataLakeVariable({ id: 'camera-zoom-decrease', name: 'Camera Zoom Decrease', ...commonVariableConfig }, 0)
  createDataLakeVariable({ id: 'camera-zoom-increase', name: 'Camera Zoom Increase', ...commonVariableConfig }, 0)
  createDataLakeVariable({ id: 'camera-zoom-speed', name: 'Camera Zoom Speed', ...commonVariableConfig }, 3)

  // Initialize camera focus variables
  createDataLakeVariable({ id: 'camera-focus-decrease', name: 'Camera Focus Decrease', ...commonVariableConfig }, 0)
  createDataLakeVariable({ id: 'camera-focus-increase', name: 'Camera Focus Increase', ...commonVariableConfig }, 0)
  createDataLakeVariable({ id: 'camera-focus-speed', name: 'Camera Focus Speed', ...commonVariableConfig }, 3)

  // Initialize camera zoom transforming function
  try {
    const func = getAllTransformingFunctions().find((f) => f.id === 'camera-zoom')
    if (!func) {
      createTransformingFunction(
        'camera-zoom',
        'Camera Zoom',
        'number',
        getUnindentedString(`
          const zoom = ({{camera-zoom-increase}} - {{camera-zoom-decrease}}) * {{camera-zoom-speed}}
          return zoom < 0.05 && zoom > -0.05 ? 0 : Math.max(Math.min(1, zoom), -1)
        `),
        'Used to control the camera zoom. The value is the difference between {{camera-zoom-increase}} and {{camera-zoom-decrease}}, multiplied by {{camera-zoom-speed}}.'
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
          const focus = ({{camera-focus-increase}} - {{camera-focus-decrease}}) * {{camera-focus-speed}}
          return focus < 0.05 && focus > -0.05 ? 0 : Math.max(Math.min(1, focus), -1)
        `),
        'Used to control the camera focus. The value is the difference between {{camera-focus-increase}} and {{camera-focus-decrease}}, multiplied by {{camera-focus-speed}}.'
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

const setupJoystickAxesResources = (): void => {
  const commonVariableConfig = { type: 'number' as DataLakeVariableType, allowUserToChangeValue: true }

  for (const axis of joystickAxisConfig) {
    createDataLakeVariable({ id: axis.inputId, name: axis.name, ...commonVariableConfig }, 0)

    try {
      const existing = getAllTransformingFunctions().find((f) => f.id === axis.outputId)
      if (!existing) {
        createTransformingFunction(
          axis.outputId,
          `${axis.name} Output`,
          'number',
          `{{${axis.inputId}}}`,
          `Output value for MANUAL_CONTROL ${axis.name}.`
        )
      }
    } catch (error) {
      console.error(`Error creating transforming function for ${axis.name}:`, error)
    }
  }
}

type PressureAltitudeCompoundVariable = {
  /** Data-lake / transforming-function ID exposed to the rest of Cockpit. */
  id: string
  /** Human-readable name shown in the data-lake browser. */
  name: string
  /** Ground-pressure autopilot parameter that pairs with the chosen barometer. */
  groundPressureParam: string
  /** MAVLink message that streams the barometer's absolute pressure. */
  pressureMessage: string
}

export const setupPressureAltitudeResources = (): void => {
  const pressureAltitudeVariables: PressureAltitudeCompoundVariable[] = [
    {
      id: 'baro2.pressure_alt',
      name: 'baro2.pressure_alt — Pressure-based altitude [m]',
      groundPressureParam: 'BARO2_GND_PRESS',
      pressureMessage: 'SCALED_PRESSURE2',
    },
    {
      id: 'baro3.pressure_alt',
      name: 'baro3.pressure_alt — Pressure-based altitude [m]',
      groundPressureParam: 'BARO3_GND_PRESS',
      pressureMessage: 'SCALED_PRESSURE3',
    },
  ]

  pressureAltitudeVariables.forEach(({ id, name, groundPressureParam, pressureMessage }) => {
    try {
      if (getAllTransformingFunctions().find((f) => f.id === id)) return

      // Nested `{{autopilotSystemId}}` references are resolved by the data-lake
      // template engine, so the expression always tracks whichever autopilot is
      // currently connected. Missing references substitute to `NaN`, which keeps
      // the result `NaN` until every dependency has been received.
      const expression = getUnindentedString(`
        ({{vehicle/{{autopilotSystemId}}/parameters/${groundPressureParam}}} - {{/mavlink/{{autopilotSystemId}}/1/${pressureMessage}/press_abs}} * 100)
        / 9800
        / {{vehicle/{{autopilotSystemId}}/parameters/BARO_SPEC_GRAV}}
        + {{vehicle/{{autopilotSystemId}}/parameters/BARO_ALT_OFFSET}}
      `)
      const description = getUnindentedString(`
        Pressure-based altitude (meters) computed from ${pressureMessage}.press_abs together with
        the ${groundPressureParam}, BARO_SPEC_GRAV and BARO_ALT_OFFSET autopilot parameters,
        mirroring ArduSub's underwater depth formula. Returns NaN until all dependencies are
        available.
      `)

      createTransformingFunction(id, name, 'number', expression, description)
    } catch (error) {
      console.error(`Error creating compound variable '${id}':`, error)
    }
  })
}

export const setupPredefinedLakeAndActionResources = (): void => {
  setupMavlinkCameraResources()
  setupJoystickAxesResources()
  setupPressureAltitudeResources()
}
