<template>
  <div>
    <div v-tooltip="tooltipText" class="relative cursor-pointer" :class="indicatorClass" @click="showDialog = true">
      <FontAwesomeIcon icon="fa-solid fa-gamepad" size="xl" />
      <FontAwesomeIcon
        v-if="!joystickConnected || !controllerStore.enableForwarding"
        icon="fa-solid fa-slash"
        size="xl"
        class="absolute left-0"
      />
    </div>

    <InteractionDialog
      v-model="showDialog"
      :title="joystickConnected ? 'Joystick connected' : 'Joystick disconnected'"
      max-width="400px"
      variant="text-only"
    >
      <template #content>
        <div class="flex items-center justify-center mb-4 flex-col">
          <span class="mr-2"></span>
          <v-switch
            v-model="controllerStore.enableForwarding"
            hide-details
            :label="switchLabel"
            color="white"
            :disabled="!joystickConnected"
          />
        </div>
      </template>
      <template #actions>
        <v-btn @click="showDialog = false">Close</v-btn>
      </template>
    </InteractionDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { joystickManager } from '@/libs/joystick/manager'
import { useControllerStore } from '@/stores/controller'

const controllerStore = useControllerStore()
const joystickConnected = ref(false)
const showDialog = ref(false)

onMounted(() => {
  joystickManager.onJoystickUpdate((event) => {
    processJoystickEvent(event)
  })
})

const processJoystickEvent = (event: Map<number, Gamepad>): void => {
  joystickConnected.value = event.size !== 0
}

const indicatorClass = computed(() => {
  if (!joystickConnected.value) return 'text-gray-700'
  if (!controllerStore.enableForwarding) return 'text-yellow-500'
  return 'text-slate-50'
})

const tooltipText = computed(() => {
  if (!joystickConnected.value) return 'Joystick disconnected'
  if (!controllerStore.enableForwarding) return 'Joystick connected but disabled'
  return 'Joystick connected and enabled'
})

const switchLabel = computed(() => {
  if (controllerStore.enableForwarding) return 'Joystick commands enabled'
  return 'Joystick commands paused'
})
</script>
