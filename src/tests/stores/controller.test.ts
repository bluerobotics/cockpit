import '@/libs/cosmos'

import { createPinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App, createApp, reactive } from 'vue'

import { cockpitStandardToProtocols } from '@/assets/joystick-profiles'
import { useSnackbar } from '@/composables/snackbar'
import { createDataLakeVariable, getDataLakeVariableInfo, setDataLakeVariableData } from '@/libs/actions/data-lake'
import { ensureCockpitTransformingFunction, updateTransformingFunction } from '@/libs/actions/data-lake-transformations'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { applyDeadband } from '@/libs/joystick/calibration'
import { joystickManager, JoystickStateEvent } from '@/libs/joystick/manager'
import {
  availableCockpitActions,
  registerActionCallback,
  unregisterActionCallback,
} from '@/libs/joystick/protocols/cockpit-actions'
import { useControllerStore } from '@/stores/controller'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { Joystick, JoystickProtocol } from '@/types/joystick'

vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: () => undefined, setKeyValue: () => undefined, registerListener: () => undefined },
}))
vi.mock('@/assets/defaults', () => ({ defaultJoystickCalibration: {} }))
vi.mock('@/libs/joystick/protocols', () => ({
  allAvailableAxes: () => [],
  allAvailableButtons: () => [],
  performJoystickMappingMigrations: (mappings: unknown[]) => mappings,
}))
vi.mock('@/migration/default-profile-importer', () => ({ isMappingBlank: () => false }))
vi.mock('@/migration/profile-migrations', () => ({ migrateLegacyJoystickMapping: () => undefined }))
vi.mock('@/composables/settingsSyncer', async () => {
  const { ref } = await import('vue')
  return { useBlueOsStorage: (_key: string, value: unknown) => ref(value) }
})
vi.mock('@/libs/communication/mavlink', () => ({
  sendMavlinkMessage: (): void => undefined,
  sendManualControl: (): void => undefined,
}))
vi.mock('@/stores/mainVehicle', () => ({ useMainVehicleStore: vi.fn() }))
vi.mock('@/libs/joystick/manager', async () => {
  const { JoystickModel } = await import('@/types/joystick-model-defs')
  return {
    JoystickModel,
    joystickCalibrationOptionsKey: 'cockpit-joystick-calibration-options',
    joystickManager: {
      onJoystickStateUpdate: vi.fn(),
      onJoystickConnectionUpdate: vi.fn(),
    },
  }
})
vi.mock('@/composables/interactionDialog', () => ({
  useInteractionDialog: () => ({ showDialog: vi.fn(), closeDialog: vi.fn() }),
}))

const vehicleState = reactive({
  isArmed: false as boolean | undefined,
  isVehicleOnline: true,
  vehicleType: MavType.MAV_TYPE_SUBMARINE as MavType | undefined,
})
const gamepad = {
  id: 'test joystick',
  index: 0,
  connected: true,
  mapping: '',
  timestamp: 0,
  axes: [0, 0, 0, 0],
  buttons: [],
  hapticActuators: [],
} as Gamepad
let onState: (event: JoystickStateEvent) => void
let store: ReturnType<typeof useControllerStore>
let app: App
const { snackbars, closeSnackbar } = useSnackbar()

beforeEach(() => {
  vi.useFakeTimers()
  registerActionCallback(availableCockpitActions.mavlink_arm, () => undefined)
  vi.mocked(useMainVehicleStore).mockReturnValue(vehicleState as ReturnType<typeof useMainVehicleStore>)
  vi.spyOn(joystickManager, 'onJoystickStateUpdate').mockImplementation((callback) => {
    onState = callback
  })
  vi.spyOn(joystickManager, 'onJoystickConnectionUpdate').mockImplementation(() => undefined)
  app = createApp({
    setup: () => {
      store = useControllerStore()
      return () => null
    },
  })
  app.use(createPinia())
  app.mount(document.createElement('div'))
  store.joysticks.set(0, new Joystick(gamepad))
  store.protocolMapping = structuredClone(cockpitStandardToProtocols[0])
  store.enableForwarding = true
  vehicleState.isArmed = false
  vehicleState.isVehicleOnline = true
  vehicleState.vehicleType = MavType.MAV_TYPE_SUBMARINE
  for (const axis of ['x', 'y', 'z', 'r', 's', 't']) {
    const inputId = `inputs/mavlink/axis-${axis}`
    if (!getDataLakeVariableInfo(inputId)) createDataLakeVariable({ id: inputId, name: axis, type: 'number' }, 0)
    ensureCockpitTransformingFunction({
      id: `outputs/mavlink/axis-${axis}`,
      name: axis,
      type: 'number',
      expression: `{{${inputId}}}`,
    })
    setDataLakeVariableData(`outputs/mavlink/axis-${axis}`, axis === 'z' ? 500 : 0)
  }
})

afterEach(() => {
  snackbars.slice().forEach(({ id }) => closeSnackbar(id))
  store.$dispose()
  app.unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  unregisterActionCallback(availableCockpitActions.mavlink_arm.id)
})

const move = (axes: number[], buttons: number[] = []): void => {
  onState({ index: 0, gamepad, calibratedState: { axes, buttons } } as JoystickStateEvent)
}

test('does not warn when pressing Arm with the default aerial sticks centered', () => {
  vehicleState.vehicleType = MavType.MAV_TYPE_QUADROTOR
  store.protocolMapping = structuredClone(cockpitStandardToProtocols[2])
  move([0, 0, 0, 0], [0, 1])
  expect(snackbars).toHaveLength(0)
  move([0, 0.5, 0, 0])
  expect(snackbars).toHaveLength(1)
})

test('does not invent a vertical rest value before vehicle type is known', () => {
  vehicleState.vehicleType = undefined
  move([0, 0, 0, 0])
  expect(snackbars).toHaveLength(0)
  move([0.5, 0, 0, 0])
  expect(snackbars).toHaveLength(1)
})

test('warns once when a motion axis is held while disarmed', () => {
  move([0.5, 0, 0, 0])
  move([0.6, 0, 0, 0])
  expect(snackbars).toHaveLength(1)
  expect(snackbars[0].variant).toBe('warning')
})

test('does not warn for centered sticks or small stick drift', () => {
  move([0, 0, 0, 0])
  move([applyDeadband(0.01, 0.05), 0, 0, 0])
  expect(snackbars).toHaveLength(0)
})

test('does not warn when armed, offline, or forwarding is paused', () => {
  vehicleState.isArmed = true
  move([0.5, 0, 0, 0])
  vehicleState.isArmed = false
  vehicleState.isVehicleOnline = false
  move([0.5, 0, 0, 0])
  vehicleState.isVehicleOnline = true
  store.enableForwarding = false
  move([0.5, 0, 0, 0])
  expect(snackbars).toHaveLength(0)
})

test('does not stack warnings when the stick is moved repeatedly', () => {
  move([0.5, 0, 0, 0])
  move([0, 0, 0, 0])
  move([0.5, 0, 0, 0])
  expect(snackbars).toHaveLength(1)
})

test('warns again for a new motion attempt after the previous notice expires', () => {
  move([0.5, 0, 0, 0])
  vi.advanceTimersByTime(5000)
  expect(snackbars).toHaveLength(0)
  move([0, 0, 0, 0])
  move([0.5, 0, 0, 0])
  expect(snackbars).toHaveLength(1)
})

test('ignores unrelated data-lake axes and constant output ranges', () => {
  store.protocolMapping.axesCorrespondencies[0].action = {
    protocol: JoystickProtocol.DataLakeVariable,
    id: 'camera/zoom',
    name: 'Zoom',
  }
  move([0.5, 0, 0, 0])
  store.protocolMapping.axesCorrespondencies[1].min = 0
  store.protocolMapping.axesCorrespondencies[1].max = 0
  move([0, 0.5, 0, 0])
  expect(snackbars).toHaveLength(0)
})

test('does not warn for a resting trigger whose mapped output is neutral', () => {
  store.protocolMapping.axesCorrespondencies[0].min = 0
  store.protocolMapping.axesCorrespondencies[0].max = 100
  move([-1, 0, 0, 0])
  expect(snackbars).toHaveLength(0)
})

test('warns for constant nonzero mapped motion even when the stick is centered', () => {
  store.protocolMapping.axesCorrespondencies[0].min = 100
  store.protocolMapping.axesCorrespondencies[0].max = 100
  move([0, 0, 0, 0])
  expect(snackbars).toHaveLength(1)
})

test('does not warn when a custom output transformation cancels the motion', () => {
  updateTransformingFunction({ id: 'outputs/mavlink/axis-y', name: 'Y', type: 'number', expression: '0' })
  vi.advanceTimersByTime(1000)
  move([0.5, 0, 0, 0])
  expect(snackbars).toHaveLength(0)
  updateTransformingFunction({
    id: 'outputs/mavlink/axis-y',
    name: 'Y',
    type: 'number',
    expression: '{{inputs/mavlink/axis-y}}',
  })
})
