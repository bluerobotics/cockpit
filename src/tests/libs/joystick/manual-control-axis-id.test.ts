import { expect, test } from 'vitest'

import { manualControlAxisDisplayName, manualControlAxisId } from '@/libs/joystick/protocols/manual-control-axis-id'
import { JoystickProtocol } from '@/types/joystick'

test('turns 1.19 data-lake manual-control axes back into MAVLink axis ids', () => {
  const dataLakeX = {
    protocol: JoystickProtocol.DataLakeVariable,
    id: 'inputs/mavlink/axis-x',
    name: 'Axis X',
  }
  const mavlinkX = { protocol: JoystickProtocol.MAVLinkManualControl, id: 'axis_x', name: 'Axis X' }
  expect(manualControlAxisId(dataLakeX)).toBe('axis_x')
  expect(manualControlAxisId(dataLakeX)).toBe(manualControlAxisId(mavlinkX))
  expect(manualControlAxisDisplayName(dataLakeX)).toBe('MAVLink Axis X')
  expect(manualControlAxisDisplayName(mavlinkX)).toBeUndefined()
  expect(
    manualControlAxisId({ protocol: JoystickProtocol.DataLakeVariable, id: 'inputs/mavlink/axis-y', name: 'Axis Y' })
  ).toBe('axis_y')
})

test('leaves already-MAVLink axes and unrelated data-lake axes alone', () => {
  expect(manualControlAxisId({ protocol: JoystickProtocol.MAVLinkManualControl, id: 'axis_x', name: 'Axis X' })).toBe(
    'axis_x'
  )
  expect(
    manualControlAxisId({ protocol: JoystickProtocol.DataLakeVariable, id: 'camera-zoom', name: 'Camera Zoom' })
  ).toBeUndefined()
  expect(
    manualControlAxisDisplayName({
      protocol: JoystickProtocol.DataLakeVariable,
      id: 'camera-zoom',
      name: 'Camera Zoom',
    })
  ).toBeUndefined()
})
