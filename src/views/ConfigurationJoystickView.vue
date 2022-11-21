<template>
  <v-card style="height: 100%">
    <v-card-title class="center-flex">Joystick configuration</v-card-title>
    <v-divider />
    <v-card-text class="center">
      <div v-if="joysticks && !joysticks.size">
        <h2 class="warning center-flex">
          No joystick detected.<br />
          Make sure that a joystick is connected. You can hit any key to test
          the joystick connection.
        </h2>
      </div>
      <div
        v-for="[key, joystick] in joysticks"
        :key="key"
        class="center-flex pa-8"
      >
        <JoystickPS
          style="width: 700px"
          :model="joystick.model"
          :left-axis="joystick.values.leftAxis"
          :right-axis="joystick.values.rightAxis"
          :up="joystick.values.button_up"
          :down="joystick.values.button_down"
          :right="joystick.values.button_right"
          :left="joystick.values.button_left"
          :ps="joystick.values.button_ps"
          :t="joystick.values.button_t"
          :l1="joystick.values.button_l1"
          :l2="joystick.values.button_l2"
          :l3="joystick.values.button_l3"
          :r1="joystick.values.button_r1"
          :r2="joystick.values.button_r2"
          :r3="joystick.values.button_r3"
          :triangle="joystick.values.button_triangle"
          :circle="joystick.values.button_circle"
          :square="joystick.values.button_square"
          :x="joystick.values.button_x"
          :create="joystick.values.button_create"
          :options="joystick.values.button_options"
        />
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import JoystickPS from '@/components/joysticks/JoystickPS.vue'
import {
  type JoystickEvent,
  EventType,
  joystickManager,
  JoystickModel,
} from '@/libs/joystick/manager'

/**
 * Joystick control mapping
 */
class JoystickValues {
  leftAxis: [number, number] = [0, 0]
  rightAxis: [number, number] = [0, 0]
  button_up = false
  button_down = false
  button_right = false
  button_left = false
  button_ps = false
  button_t = false
  button_l1 = false
  button_l2 = false
  button_l3 = false
  button_r1 = false
  button_r2 = false
  button_r3 = false
  button_triangle = false
  button_circle = false
  button_square = false
  button_x = false
  button_create = false
  button_options = false
}

/**
 * Joystick abstraction for widget
 */
class Joystick {
  gamepad: Gamepad
  values = new JoystickValues()
  model = 'PS5'

  /**
   * Create joystick component
   *
   * @param {Gamepad} gamepad Axis to be set
   */
  constructor(gamepad: Gamepad) {
    this.gamepad = gamepad
  }
}

const joysticks = ref<Map<number, Joystick>>(new Map())

onMounted(() => {
  joystickManager.onJoystickUpdate((event) => {
    processJoystickEvent(event)
  })
  joystickManager.onJoystickStateUpdate((event) => {
    processJoystickStateEvent(event)
  })
})

const processJoystickEvent = (event: Map<number, Gamepad>): void => {
  const newMap = new Map(
    Array.from(event).map(([index, gamepad]) => [index, new Joystick(gamepad)])
  )

  // Add new joysticks
  for (const [index, joystick] of newMap) {
    if (joysticks.value.has(index)) {
      continue
    }
    joysticks.value.set(index, joystick)
  }

  // Remove joysticks that doesn't not exist anymore
  for (const key of joysticks.value.keys()) {
    if (event.has(key)) {
      continue
    }

    joysticks.value.delete(key)
  }
}

const getJoystickModel = (gamepad: Gamepad): string => {
  switch (joystickManager.getModel(gamepad)) {
    case JoystickModel.DualShock4:
      return 'PS4'
    case JoystickModel.DualSense:
    default:
      return 'PS5'
  }
}

const processJoystickStateEvent = (event: JoystickEvent): void => {
  const gamepad = event?.detail?.gamepad
  if (gamepad == undefined) {
    return
  }

  const index = event.detail.index

  // Map not updated by manager yet
  if (!joysticks.value.has(index)) {
    return
  }

  joysticks.value.get(index)!.gamepad = gamepad
  const values = joysticks.value.get(index)!.values

  const model = getJoystickModel(gamepad)
  joysticks.value.get(index)!.model = model

  switch (event.type) {
    case EventType.Axis: {
      if (model == 'PS5') {
        values.leftAxis = [gamepad?.axes[0], gamepad?.axes[1]]
        values.rightAxis = [gamepad?.axes[2], gamepad?.axes[3]]
      } else {
        values.rightAxis = [gamepad?.axes[0], gamepad?.axes[1]]
        values.leftAxis = [gamepad?.axes[2], gamepad?.axes[3]]
      }
      break
    }
    case EventType.Button: {
      const buttons = gamepad?.buttons
      if (buttons == undefined) {
        return
      }

      /**
       * Accessing this values by a reference list does not work with vue,
       * it was necessary to set each button individually.
       *
       * The idea of the map is also to track the order depending of the browser
       * that is being used, by default we use the buttons order provide by chrome.
       */
      values.button_x = buttons?.[0]?.value > 0.5 ?? false
      values.button_circle = buttons?.[1]?.value > 0.5 ?? false
      values.button_square = buttons?.[2]?.value > 0.5 ?? false
      values.button_triangle = buttons?.[3]?.value > 0.5 ?? false
      values.button_l1 = buttons?.[4]?.value > 0.5 ?? false
      values.button_r1 = buttons?.[5]?.value > 0.5 ?? false
      values.button_l2 = buttons?.[6]?.value > 0.5 ?? false
      values.button_r2 = buttons?.[7]?.value > 0.5 ?? false
      values.button_create = buttons?.[8]?.value > 0.5 ?? false
      values.button_options = buttons?.[9]?.value > 0.5 ?? false
      values.button_r3 = buttons?.[10]?.value > 0.5 ?? false
      values.button_l3 = buttons?.[11]?.value > 0.5 ?? false
      values.button_up = buttons?.[12]?.value > 0.5 ?? false
      values.button_down = buttons?.[13]?.value > 0.5 ?? false
      values.button_left = buttons?.[14]?.value > 0.5 ?? false
      values.button_right = buttons?.[15]?.value > 0.5 ?? false
      values.button_ps = buttons?.[16]?.value > 0.5 ?? false
      values.button_t = buttons?.[17]?.value > 0.5 ?? false
    }
  }
}
</script>

<style>
.center {
  align-items: center;
  display: flex;
  justify-content: center;
}

.center-flex {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
