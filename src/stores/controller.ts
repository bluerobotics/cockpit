import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { type JoystickEvent, EventType, joystickManager, JoystickModel } from '@/libs/joystick/manager'
import {
  type MavlinkControllerMapping,
  MavlinkControllerState,
  protocolAvailableAxes,
  protocolAvailableButtons,
  protocolAxesLimits,
  protocolDefaultMapping,
} from '@/libs/joystick/protocols'
import { type ProtocolControllerState, Joystick, JoystickProtocol, JoystickValues } from '@/types/joystick'

export type controllerUpdateCallback = (state: ProtocolControllerState) => void

export const useControllerStore = defineStore('controller', () => {
  const joysticks = ref<Map<number, Joystick>>(new Map())
  const updateCallbacks = ref<controllerUpdateCallback[]>([])
  const mappingProtocol = ref<JoystickProtocol>(JoystickProtocol.MAVLink)
  const mapping = useStorage('cockpit-controller-mapping', protocolDefaultMapping(mappingProtocol.value))
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
      joysticks.value.set(index, joystick)
    }

    // Remove joysticks that doesn't not exist anymore
    for (const key of joysticks.value.keys()) {
      if (event.has(key)) continue
      joysticks.value.delete(key)
    }
  }

  const processJoystickStateEvent = (event: JoystickEvent): void => {
    if (event.type !== EventType.Axis && event.type !== EventType.Button) return
    const index = event.detail.index
    const gamepad = event.detail.gamepad

    // Map not updated by manager yet
    if (!joysticks.value.has(index)) return

    joysticks.value.get(index)!.gamepad = gamepad

    const model = joystickManager.getModel(gamepad)
    joysticks.value.get(index)!.model = model

    const newValues = new JoystickValues()
    // Map Gamepad API inputs to known functions
    if (model === JoystickModel.DualSense) {
      newValues.leftAxisHorizontal = gamepad.axes[0]
      newValues.leftAxisVertical = gamepad.axes[1]
      newValues.rightAxisHorizontal = gamepad.axes[2]
      newValues.rightAxisVertical = gamepad.axes[3]
    } else {
      newValues.leftAxisHorizontal = gamepad.axes[2]
      newValues.leftAxisVertical = gamepad.axes[3]
      newValues.rightAxisHorizontal = gamepad.axes[0]
      newValues.rightAxisVertical = gamepad.axes[1]
    }

    newValues.directionalTopButton = gamepad.buttons[12]?.pressed
    newValues.directionalBottomButton = gamepad.buttons[13]?.pressed
    newValues.directionalLeftButton = gamepad.buttons[14]?.pressed
    newValues.directionalRightButton = gamepad.buttons[15]?.pressed

    newValues.rightClusterTopButton = gamepad.buttons[3]?.pressed
    newValues.rightClusterBottomButton = gamepad.buttons[0]?.pressed
    newValues.rightClusterLeftButton = gamepad.buttons[2]?.pressed
    newValues.rightClusterRightButton = gamepad.buttons[1]?.pressed

    newValues.leftShoulderButton = gamepad.buttons[4]?.pressed
    newValues.leftTriggerButton = gamepad.buttons[6]?.pressed
    newValues.leftStickerButton = gamepad.buttons[11]?.pressed

    newValues.rightShoulderButton = gamepad.buttons[5]?.pressed
    newValues.rightTriggerButton = gamepad.buttons[7]?.pressed
    newValues.rightStickerButton = gamepad.buttons[10]?.pressed

    newValues.extraButton1 = gamepad.buttons[8]?.pressed
    newValues.extraButton2 = gamepad.buttons[9]?.pressed
    newValues.extraButton3 = gamepad.buttons[16]?.pressed
    newValues.extraButton4 = gamepad.buttons[17]?.pressed
    newValues.extraButton5 = gamepad.buttons[18]?.pressed

    joysticks.value.get(index)!.values = newValues

    let newControllerState: ProtocolControllerState | undefined
    if (mappingProtocol.value === JoystickProtocol.MAVLink) {
      const mavlinkMapping = mapping.value as MavlinkControllerMapping
      newControllerState = new MavlinkControllerState(gamepad, mavlinkMapping)
    }

    if (newControllerState === undefined) return
    for (const callback of updateCallbacks.value) {
      callback(newControllerState)
    }
  }

  return {
    registerControllerUpdateCallback,
    joysticks,
    mapping,
    availableAxes,
    availableButtons,
    axesLimits,
  }
})
