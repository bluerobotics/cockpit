import { expect, test } from 'vitest'

import {
  type JoystickProtocolActionsMapping,
  CockpitModifierKeyOption,
  JoystickAxis,
  JoystickButton,
  JoystickProtocol,
  trackTriggerPulls,
} from '@/types/joystick'

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

test('a trigger pulled with Shift held belongs to Shift only if it has a Shift action', () => {
  const pulls = trackTriggerPulls(new Map(), [0, 0, 0, 0, 0.8, 0.9], mapping, true)
  expect(pulls).toEqual(
    new Map([
      [JoystickAxis.A4, false],
      [JoystickAxis.A5, true],
    ])
  )
})

test('a pull keeps its owner until the trigger is let go, whatever Shift does', () => {
  const shiftPull = trackTriggerPulls(new Map(), [0, 0, 0, 0, 0, 1], mapping, true)
  expect(trackTriggerPulls(shiftPull, [0, 0, 0, 0, 0, 1], mapping, false).get(JoystickAxis.A5)).toBe(true)
  expect(trackTriggerPulls(shiftPull, [0, 0, 0, 0, 0, 0], mapping, false).size).toBe(0)

  const regularPull = trackTriggerPulls(new Map(), [0, 0, 0, 0, 0, 1], mapping, false)
  expect(trackTriggerPulls(regularPull, [0, 0, 0, 0, 0, 1], mapping, true).get(JoystickAxis.A5)).toBe(false)
})

test('a mapping without a Shift layout does not throw', () => {
  const noShift = {
    ...mapping,
    buttonsCorrespondencies: { [CockpitModifierKeyOption.regular]: {} },
  } as unknown as JoystickProtocolActionsMapping
  expect(trackTriggerPulls(new Map(), [0, 0, 0, 0, 1, 1], noShift, true)).toEqual(
    new Map([
      [JoystickAxis.A4, false],
      [JoystickAxis.A5, false],
    ])
  )
})
