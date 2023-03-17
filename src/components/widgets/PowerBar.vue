<template>
  <div class="flex items-center justify-evenly w-full backdrop-blur-sm bg-col-white p-0.5 min-w-fit">
    <v-icon
      v-tooltip.bottom="vehicleStore.isVehicleOnline ? 'Vehicle connected' : 'Vehicle disconnected'"
      class="m-2"
      :color="getColor(vehicleStore.isVehicleOnline)"
    >
      {{ vehicleIcon ?? 'mdi-help' }}
    </v-icon>

    <button
      class="relative flex items-center justify-center w-24 h-10 p-2 m-3 text-white rounded-md shadow-inner cursor-pointer bg-blue-grey-lighten-3 opacity-90"
      @click="vehicleStore.isArmed ? vehicleStore.disarm() : vehicleStore.arm()"
    >
      <div
        class="absolute top-auto flex items-center px-1 rounded-md shadow"
        :class="vehicleStore.isArmed ? 'bg-grey-darken-1 justify-end' : 'justify-start bg-blue-darken-2'"
        style="width: 70%; height: 80%; transition: all 0.2s ease-in-out"
        :style="vehicleStore.isArmed ? 'left: 23%' : 'left: 7%'"
      >
        <span class="inline-block font-extrabold align-middle">
          {{ vehicleStore.isArmed === undefined ? '...' : vehicleStore.isArmed ? 'Disarm' : 'Arm' }}
        </span>
      </div>
    </button>

    <Alerter class="max-w-sm min-w-fit" />

    <v-select
      v-model="vehicleStore.mode"
      :disabled="!vehicleStore.isVehicleOnline"
      :items="flightModes"
      bg-color="rgb(255, 255, 255, 0.5)"
      density="compact"
      variant="outlined"
      no-data-text="Waiting for available modes."
      hide-details
      class="flex items-center justify-center mx-1 min-w-fit mode-select"
      :loading="vehicleStore.mode === undefined"
      @update:model-value="(newMode: string) => vehicleStore.setFlightMode(newMode)"
    />
    <v-icon
      v-tooltip.bottom="joystickConnected ? 'Joystick connected' : 'Joystick disconnected'"
      class="m-2"
      :color="getColor(joystickConnected)"
    >
      mdi-controller
    </v-icon>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { joystickManager } from '@/libs/joystick/manager'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import Alerter from './Alerter.vue'

const vehicleStore = useMainVehicleStore()

const joystickConnected = ref<boolean>(false)

onMounted(() => {
  joystickManager.onJoystickUpdate((event) => {
    processJoystickEvent(event)
  })
})

const processJoystickEvent = (event: Map<number, Gamepad>): void => {
  joystickConnected.value = event.size !== 0
}

const getColor = (isGreen: boolean): string => {
  return `${isGreen ? 'green' : 'red'} darkden-2`
}

const vehicleIcon = computed(() => vehicleStore.icon)
const flightModes = computed(() => vehicleStore.modesAvailable())
</script>

<style scoped>
.bg-col-white {
  background-color: rgb(255, 255, 255, 0.1);
}
.arm-switch {
  max-width: 60px;
}
.mode-select {
  max-width: 180px;
}
</style>
