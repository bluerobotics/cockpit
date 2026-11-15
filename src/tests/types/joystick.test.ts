import { expect, test } from 'vitest'

import {
  type JoystickProtocolActionsMapping,
  CockpitModifierKeyOption,
  JoystickButton,
  JoystickProtocol,
  withShiftTriggerAxesReleased,
} from '@/types/joystick'

test('only a trigger with a Shift action reads as released on its axis', () => {
  const mapping: JoystickProtocolActionsMapping = {
    name: 'test',
    hash: 'test',
    axesCorrespondencies: {},
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: {},
      [CockpitModifierKeyOption.shift]: {
        [JoystickButton.B6]: { action: { protocol: JoystickProtocol.Other, id: 'no_function', name: 'No function' } },
        [JoystickButton.B7]: { action: { protocol: JoystickProtocol.DataLakeVariable, id: 'focus', name: 'Focus' } },
      },
    },
  }

  expect(withShiftTriggerAxesReleased([0.1, 0.2, 0.3, 0.4, 0.8, 0.9], mapping)).toEqual([0.1, 0.2, 0.3, 0.4, 0.8, 0])
})
