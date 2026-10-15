import '@/libs/cosmos'

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { cockpitStandardToProtocols } from '@/assets/joystick-profiles'
import { createDataLakeVariable, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { hasJoystickMotionInput } from '@/libs/joystick/protocols/manual-control-axes'
import { MavlinkManualControlManager } from '@/libs/joystick/protocols/mavlink-manual-control'

vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: () => undefined, setKeyValue: () => undefined, registerListener: () => undefined },
}))
vi.mock('@/composables/interactionDialog', () => ({
  useInteractionDialog: () => ({ showDialog: vi.fn(), closeDialog: vi.fn() }),
}))
vi.mock('@/libs/communication/mavlink', () => ({
  sendMavlinkMessage: (): void => undefined,
  sendManualControl: (): void => undefined,
}))

beforeEach(() => {
  vi.useFakeTimers()
  for (const axis of ['x', 'y', 'z', 'r', 's', 't']) {
    const id = `outputs/mavlink/axis-${axis}`
    if (!getDataLakeVariableInfo(id)) createDataLakeVariable({ id, name: axis, type: 'number' }, 0)
    setDataLakeVariableData(id, axis === 'z' ? 500 : 0)
  }
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

test('uses the shared rounded outputs in the outgoing control state', () => {
  const values = { x: NaN, y: 12.6, z: 500.2, r: '-9.8', s: 2.4, t: 0 }
  Object.entries(values).forEach(([axis, value]) => setDataLakeVariableData(`outputs/mavlink/axis-${axis}`, value))
  const manager = new MavlinkManualControlManager()
  manager.updateControllerData({ axes: [], buttons: [] }, cockpitStandardToProtocols[0], [])
  expect(manager.manualControlState).toMatchObject({ x: 0, y: 13, z: 500, r: -10, s: 2, t: 0 })
})

test('does not treat unsupported ArduSub ignore values as neutral', () => {
  setDataLakeVariableData('outputs/mavlink/axis-y', 32767)
  expect(hasJoystickMotionInput(MavType.MAV_TYPE_SUBMARINE)).toBe(true)
  setDataLakeVariableData('outputs/mavlink/axis-z', 0)
  expect(hasJoystickMotionInput(MavType.MAV_TYPE_SURFACE_BOAT)).toBe(false)
})
