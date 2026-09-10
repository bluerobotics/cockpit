import { expect, test, vi } from 'vitest'

import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import { updateDataLakeFromJoystick } from '@/libs/joystick/protocols/data-lake'
import { joystickInputAxes } from '@/libs/joystick/protocols/predefined-resources'
import {
  type JoystickProtocolActionsMapping,
  type ProtocolAction,
  CockpitModifierKeyOption,
  JoystickProtocol,
} from '@/types/joystick'

// The data lake reaches the settings manager at import time, and constructing the real one needs a working
// localStorage that this environment does not provide.
vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: () => undefined, setKeyValue: () => undefined, registerListener: () => undefined },
}))

// MAVLink message actions pull the wasm parser, which this environment cannot instantiate.
vi.mock('@/libs/communication/mavlink', () => ({
  sendMavlinkMessage: (): void => undefined,
  sendManualControl: (): void => undefined,
}))

test('predefined joystick axis actions are initialized', () => {
  expect(joystickInputAxes.axis_x.id).toBe('inputs/mavlink/axis-x')
  expect(joystickInputAxes.axis_y.id).toBe('inputs/mavlink/axis-y')
})

const dataLakeAction = (id: string): ProtocolAction => ({
  protocol: JoystickProtocol.DataLakeVariable,
  id,
  name: id,
})

test('mapped joystick inputs write into data-lake variables', () => {
  const buttonAction = dataLakeAction('test/joystick/button')
  const axisAction = dataLakeAction('test/joystick/axis')
  const mapping: JoystickProtocolActionsMapping = {
    name: 'test',
    hash: 'test',
    axesCorrespondencies: {
      0: { action: axisAction, min: -1000, max: 1000 },
    },
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: { 0: { action: buttonAction } },
      [CockpitModifierKeyOption.shift]: {},
    },
  }

  updateDataLakeFromJoystick({ buttons: [1], axes: [1] }, mapping, [])

  expect(getDataLakeVariableData('test/joystick/button')).toBe(1)
  expect(getDataLakeVariableData('test/joystick/axis')).toBe(1000)
})
