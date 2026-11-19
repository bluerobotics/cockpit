import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  MAVLinkButtonFunction,
  MAVLinkManualControlButtonAction,
  MavlinkManualControlManager,
} from '@/libs/joystick/protocols/mavlink-manual-control'
import type { ArduPilot } from '@/libs/vehicle/ardupilot/ardupilot'
import { type JoystickProtocolActionsMapping, CockpitModifierKeyOption } from '@/types/joystick'

vi.mock('@/libs/communication/mavlink', () => ({ sendManualControl: vi.fn() }))
vi.mock('@/composables/interactionDialog', () => ({
  useInteractionDialog: () => ({ showDialog: vi.fn(), closeDialog: vi.fn() }),
}))

const buttonFunctionValues: [MAVLinkButtonFunction, number][] = [
  [MAVLinkButtonFunction.disabled, 0],
  [MAVLinkButtonFunction.shift, 1],
  [MAVLinkButtonFunction.arm, 3],
  [MAVLinkButtonFunction.disarm, 4],
  [MAVLinkButtonFunction.mount_center, 21],
  [MAVLinkButtonFunction.mount_tilt_up, 22],
  [MAVLinkButtonFunction.lights1_brighter, 32],
  [MAVLinkButtonFunction.lights1_dimmer, 33],
  [MAVLinkButtonFunction.lights2_brighter, 35],
  [MAVLinkButtonFunction.lights2_dimmer, 36],
]

const mappingFor = (
  regular: MAVLinkButtonFunction[],
  shift: MAVLinkButtonFunction[]
): JoystickProtocolActionsMapping => {
  const correspondencies = (
    functions: MAVLinkButtonFunction[]
  ): JoystickProtocolActionsMapping['buttonsCorrespondencies'][CockpitModifierKeyOption] =>
    Object.fromEntries(functions.map((f, button) => [button, { action: new MAVLinkManualControlButtonAction(f, f) }]))
  return {
    name: 'test',
    hash: 'test',
    axesCorrespondencies: {} as JoystickProtocolActionsMapping['axesCorrespondencies'],
    buttonsCorrespondencies: {
      [CockpitModifierKeyOption.regular]: correspondencies(regular),
      [CockpitModifierKeyOption.shift]: correspondencies(shift),
    },
  }
}

// The manager remaps every second on its own; the test calls the remap directly instead
beforeEach(() => {
  vi.spyOn(window, 'setInterval').mockReturnValue(0 as unknown as ReturnType<typeof setInterval>)
})
afterEach(() => {
  vi.restoreAllMocks()
})

test('puts each function on its own slot when it has to reuse slots holding unwanted functions', () => {
  const manager = new MavlinkManualControlManager()
  const setParameter = vi.fn()
  manager.vehicle = { setParameter } as unknown as ArduPilot
  manager.vehicleButtonParameterTable = buttonFunctionValues.map(([title, value]) => ({ title, value }))
  // No Disabled slot left, on either layer
  manager.currentVehicleParameters = {
    BTN0_FUNCTION: 1,
    BTN0_SFUNCTION: 1,
    BTN1_FUNCTION: 3,
    BTN1_SFUNCTION: 21,
    BTN2_FUNCTION: 4,
    BTN2_SFUNCTION: 22,
  }
  manager.vehicleTotalParametersCount = 6
  manager.currentActionsMapping = mappingFor(
    [MAVLinkButtonFunction.lights1_brighter, MAVLinkButtonFunction.lights1_dimmer],
    [MAVLinkButtonFunction.lights2_brighter, MAVLinkButtonFunction.lights2_dimmer]
  )

  manager.remapActionsToVehicleButtonParameters()

  const lightsWrites = setParameter.mock.calls.map(([parameter]) => parameter).filter((p) => p.value >= 32)
  // Slots are reused from the last one backwards
  expect(lightsWrites).toEqual([
    { id: 'BTN2_FUNCTION', value: 32 },
    { id: 'BTN1_FUNCTION', value: 33 },
    { id: 'BTN2_SFUNCTION', value: 35 },
    { id: 'BTN1_SFUNCTION', value: 36 },
  ])
})
