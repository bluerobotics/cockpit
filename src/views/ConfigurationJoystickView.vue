<template>
  <v-card style="height: 100%">
    <v-card-title class="center">Joystick configuration</v-card-title>
    <v-divider />
    <v-card-text class="center">
      <JoystickPS5
        :left-axis="leftAxis"
        :right-axis="rightAxis"
        :up="button_up"
        :down="button_down"
        :right="button_right"
        :left="button_left"
        :ps="button_ps"
        :t="button_t"
        :l1="button_l1"
        :l2="button_l2"
        :l3="button_l3"
        :r1="button_r1"
        :r2="button_r2"
        :r3="button_r3"
        :triangle="button_triangle"
        :circle="button_circle"
        :square="button_square"
        :x="button_x"
        :create="button_create"
        :options="button_options"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import JoystickPS5 from '@/components/joysticks/JoystickPS5.vue'
import {
  type JoystickEvent,
  EventType,
  joystickManager,
} from '@/libs/joystick/manager'

const joysticks = ref<Array<Gamepad>>([])
const leftAxis = ref<[number, number]>([0, 0])
const rightAxis = ref<[number, number]>([0, 0])
const button_up = ref(false)
const button_down = ref(false)
const button_right = ref(false)
const button_left = ref(false)
const button_ps = ref(false)
const button_t = ref(false)
const button_l1 = ref(false)
const button_l2 = ref(false)
const button_l3 = ref(false)
const button_r1 = ref(false)
const button_r2 = ref(false)
const button_r3 = ref(false)
const button_triangle = ref(false)
const button_circle = ref(false)
const button_square = ref(false)
const button_x = ref(false)
const button_create = ref(false)
const button_options = ref(false)

onMounted(() => {
  joystickManager.onJoystickUpdate((event) => {
    processJoystickEvent(event)
  })
  joystickManager.onJoystickStateUpdate((event) => {
    processJoystickStateEvent(event)
  })
})

const processJoystickEvent = (event: Array<Gamepad>): void => {
  joysticks.value = event
}

const processJoystickStateEvent = (event: JoystickEvent): void => {
  const gamepad = event?.detail?.gamepad
  if (gamepad == undefined) {
    return
  }

  joysticks.value[event.detail.index] = gamepad
  switch (event.type) {
    case EventType.Axis: {
      leftAxis.value = [gamepad?.axes[0], gamepad?.axes[1]]
      rightAxis.value = [gamepad?.axes[2], gamepad?.axes[3]]
      break
    }
    case EventType.Button: {
      const buttons = gamepad?.buttons
      if (buttons == undefined) {
        return
      }

      const ps5Map = [
        /* 0 */ button_x,
        /* 1 */ button_circle,
        /* 2 */ button_square,
        /* 3 */ button_triangle,
        /* 4 */ button_l1,
        /* 5 */ button_r1,
        /* 6 */ button_l2, // float
        /* 7 */ button_r2, // float
        /* 8 */ button_create,
        /* 9 */ button_options,
        /* 10 */ button_l3,
        /* 11 */ button_r3,
        /* 12 */ button_up,
        /* 13 */ button_down,
        /* 14 */ button_left,
        /* 15 */ button_right,
        /* 16 */ button_ps,
        /* 17 */ button_t,
      ]

      for (const [index, control] of (gamepad?.buttons ?? []).entries()) {
        ps5Map[index].value = control.value > 0.5
      }
    }
  }
}
</script>

<style>
.center {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
