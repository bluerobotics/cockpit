import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { availableGamepadToCockpitMaps, cockpitStandardToProtocols } from '@/assets/joystick-profiles'
import { type JoystickEvent, EventType, joystickManager, JoystickModel } from '@/libs/joystick/manager'
import { type InputWithPrettyName, allAvailableAxes, allAvailableButtons } from '@/libs/joystick/protocols'
import { type JoystickState, type ProtocolControllerMapping, Joystick, JoystickProtocol } from '@/types/joystick'

export type controllerUpdateCallback = (state: JoystickState, protocolMapping: ProtocolControllerMapping) => void

export const useControllerStore = defineStore('controller', () => {
  const joysticks = ref<Map<number, Joystick>>(new Map())
  const updateCallbacks = ref<controllerUpdateCallback[]>([])
  const protocolMapping = useStorage('cockpit-v0.0.7-protocol-mapping', cockpitStandardToProtocols)
  const cockpitStdMappings = useStorage('cockpit-standard-mappings', availableGamepadToCockpitMaps)
  const availableAxes = allAvailableAxes
  const availableButtons = allAvailableButtons
  const allPrettyButtonNames = ref<InputWithPrettyName[]>([])
  const enableForwarding = ref(true)

  const registerControllerUpdateCallback = (callback: controllerUpdateCallback): void => {
    updateCallbacks.value.push(callback)
  }

  joystickManager.onJoystickUpdate((event) => processJoystickEvent(event))
  joystickManager.onJoystickStateUpdate((event) => processJoystickStateEvent(event))

  const processJoystickEvent = (event: Map<number, Gamepad>): void => {
    const newMap = new Map(Array.from(event).map(([index, gamepad]) => [index, new Joystick(gamepad)]))

    // Add new joysticks
    for (const [index, joystick] of newMap) {
      if (joysticks.value.has(index)) continue
      joystick.model = joystickManager.getModel(joystick.gamepad)
      joysticks.value.set(index, joystick)
    }

    // Remove joysticks that doesn't not exist anymore
    for (const key of joysticks.value.keys()) {
      if (event.has(key)) continue
      joysticks.value.delete(key)
    }
  }

  const processJoystickStateEvent = (event: JoystickEvent): void => {
    const joystick = joysticks.value.get(event.detail.index)
    if (joystick === undefined || (event.type !== EventType.Axis && event.type !== EventType.Button)) return
    joystick.gamepad = event.detail.gamepad

    const joystickModel = joystick.model || JoystickModel.Unknown
    joystick.gamepadToCockpitMap = cockpitStdMappings.value[joystickModel]

    for (const callback of updateCallbacks.value) {
      callback(joystick.state, protocolMapping.value)
    }
  }

  const updateCockpitActionButtonsPrettyNames = (): void => {
    const cockpitActionButtonsWithPrettyNames: InputWithPrettyName[] = protocolMapping.value.buttons
      .filter((btn) => btn.protocol === JoystickProtocol.CockpitAction)
      .map((btn) => ({ input: btn, prettyName: btn.value?.toString() || 'No function' }))
    allPrettyButtonNames.value = allPrettyButtonNames.value.concat(cockpitActionButtonsWithPrettyNames)
  }
  updateCockpitActionButtonsPrettyNames()

  // If there's a mapping in our database that is not on the user storage, add it to the user
  // This will happen whenever a new joystick profile is added to Cockpit's database
  Object.entries(availableGamepadToCockpitMaps).forEach(([k, v]) => {
    if (Object.keys(cockpitStdMappings.value).includes(k)) return
    cockpitStdMappings.value[k as JoystickModel] = v
  })

  return {
    registerControllerUpdateCallback,
    enableForwarding,
    joysticks,
    protocolMapping,
    cockpitStdMappings,
    availableAxes,
    availableButtons,
    allPrettyButtonNames,
  }
})
