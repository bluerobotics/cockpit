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

    const newValues = new JoystickValues()
    // Map Gamepad API inputs to known functions
    if (joystick.model === JoystickModel.DualSense) {
      newValues.leftAxisHorizontal = joystick.gamepad.axes[0]
      newValues.leftAxisVertical = joystick.gamepad.axes[1]
      newValues.rightAxisHorizontal = joystick.gamepad.axes[2]
      newValues.rightAxisVertical = joystick.gamepad.axes[3]
    } else {
      newValues.leftAxisHorizontal = joystick.gamepad.axes[2]
      newValues.leftAxisVertical = joystick.gamepad.axes[3]
      newValues.rightAxisHorizontal = joystick.gamepad.axes[0]
      newValues.rightAxisVertical = joystick.gamepad.axes[1]
    }

    newValues.directionalTopButton = joystick.gamepad.buttons[12]?.pressed
    newValues.directionalBottomButton = joystick.gamepad.buttons[13]?.pressed
    newValues.directionalLeftButton = joystick.gamepad.buttons[14]?.pressed
    newValues.directionalRightButton = joystick.gamepad.buttons[15]?.pressed

    newValues.rightClusterTopButton = joystick.gamepad.buttons[3]?.pressed
    newValues.rightClusterBottomButton = joystick.gamepad.buttons[0]?.pressed
    newValues.rightClusterLeftButton = joystick.gamepad.buttons[2]?.pressed
    newValues.rightClusterRightButton = joystick.gamepad.buttons[1]?.pressed

    newValues.leftShoulderButton = joystick.gamepad.buttons[4]?.pressed
    newValues.leftTriggerButton = joystick.gamepad.buttons[6]?.pressed
    newValues.leftStickerButton = joystick.gamepad.buttons[11]?.pressed

    newValues.rightShoulderButton = joystick.gamepad.buttons[5]?.pressed
    newValues.rightTriggerButton = joystick.gamepad.buttons[7]?.pressed
    newValues.rightStickerButton = joystick.gamepad.buttons[10]?.pressed

    newValues.extraButton1 = joystick.gamepad.buttons[8]?.pressed
    newValues.extraButton2 = joystick.gamepad.buttons[9]?.pressed
    newValues.extraButton3 = joystick.gamepad.buttons[16]?.pressed
    newValues.extraButton4 = joystick.gamepad.buttons[17]?.pressed
    newValues.extraButton5 = joystick.gamepad.buttons[18]?.pressed

    joystick.values = newValues

    let newControllerState: ProtocolControllerState | undefined
    if (mappingProtocol.value === JoystickProtocol.MAVLink) {
      const mavlinkMapping = mapping.value as MavlinkControllerMapping
      newControllerState = new MavlinkControllerState(joystick.gamepad, mavlinkMapping)
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
