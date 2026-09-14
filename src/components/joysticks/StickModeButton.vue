<template>
  <v-btn
    v-tooltip:top="'Select the stick mode (RC standard layouts)'"
    variant="elevated"
    size="small"
    prepend-icon="mdi-tune-variant"
    class="bg-[#FFFFFF22]"
    @click="open"
  >
    {{ currentStickModeLabel }}
  </v-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { detectStickMode } from '@/libs/joystick/stick-modes'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useControllerStore } from '@/stores/controller'

const interfaceStore = useAppInterfaceStore()
const controllerStore = useControllerStore()

const currentStickModeLabel = computed(() => {
  const mode = detectStickMode(controllerStore.protocolMapping.axesCorrespondencies)
  return mode === null ? 'Custom' : `Mode ${mode}`
})

const open = (): void => {
  logUserAction('Opened the joystick stick mode selector')
  interfaceStore.isJoystickStickModeModalVisible = true
}
</script>
