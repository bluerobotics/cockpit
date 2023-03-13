import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { availableGamepadToCockpitMaps } from '@/assets/joystick-profiles'
import { type JoystickEvent, EventType, joystickManager, JoystickModel } from '@/libs/joystick/manager'
import {
  type MavlinkControllerMapping,
  MavlinkControllerState,
  protocolAvailableAxes,
  protocolAvailableButtons,
  protocolAxesLimits,
  protocolDefaultMapping,
} from '@/libs/joystick/protocols'
import { type ProtocolControllerState, Joystick, JoystickProtocol } from '@/types/joystick'

export type controllerUpdateCallback = (state: ProtocolControllerState) => void

export const useControllerStore = defineStore('controller', () => {
  const joysticks = ref<Map<number, Joystick>>(new Map())
  const updateCallbacks = ref<controllerUpdateCallback[]>([])
  const mappingProtocol = ref<JoystickProtocol>(JoystickProtocol.MAVLink)
  const protocolMapping = useStorage('cockpit-protocol-mapping', protocolDefaultMapping(mappingProtocol.value))
  const cockpitStdMappings = useStorage('cockpit-standard-mappings', availableGamepadToCockpitMaps)
  const availableAxes = protocolAvailableAxes(mappingProtocol.value)
  const availableButtons = protocolAvailableButtons(mappingProtocol.value)
  const axesLimits = protocolAxesLimits(mappingProtocol.value)

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

    let newControllerState: ProtocolControllerState | undefined
    if (mappingProtocol.value === JoystickProtocol.MAVLink) {
      const mavlinkMapping = protocolMapping.value as MavlinkControllerMapping
      newControllerState = new MavlinkControllerState(joystick.state, mavlinkMapping)
    }

    if (newControllerState === undefined) return
    for (const callback of updateCallbacks.value) {
      callback(newControllerState)
    }
  }

  return {
    registerControllerUpdateCallback,
    joysticks,
    protocolMapping,
    cockpitStdMappings,
    availableAxes,
    availableButtons,
    axesLimits,
  }
})
