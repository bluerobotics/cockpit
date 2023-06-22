<template>
  <div
    v-tooltip="joystickConnected ? 'Joystick connected' : 'Joystick disconnected'"
    class="relative"
    :class="joystickConnected ? 'text-slate-50' : 'text-gray-700'"
  >
    <FontAwesomeIcon icon="fa-solid fa-gamepad" size="xl" />
    <FontAwesomeIcon v-if="!joystickConnected" icon="fa-solid fa-slash" size="xl" class="absolute left-0" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { joystickManager } from '@/libs/joystick/manager'

const joystickConnected = ref<boolean>(false)

onMounted(() => {
  joystickManager.onJoystickUpdate((event) => {
    processJoystickEvent(event)
  })
})

const processJoystickEvent = (event: Map<number, Gamepad>): void => {
  joystickConnected.value = event.size !== 0
}
</script>
