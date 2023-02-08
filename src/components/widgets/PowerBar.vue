<template>
  <div class="flex items-center justify-evenly w-full backdrop-blur-sm bg-col-white p-0.5 min-w-fit">
    <v-icon
      v-tooltip.bottom="vehicleStore.isVehicleOnline ? 'Vehicle connected' : 'Vehicle disconnected'"
      class="m-2"
      :color="getColor(vehicleStore.isVehicleOnline)"
    >
      {{ vehicleIcon ?? 'mdi-help' }}
    </v-icon>

    <v-switch
      v-model="vehicleStore.isArmed"
      v-tooltip.bottom="vehicleStore.isArmed ? 'Disarm vehicle' : 'Arm vehicle'"
      :disabled="!vehicleStore.isVehicleOnline"
      class="mx-1 flex items-center justify-center min-w-fit arm-switch"
      color="red-darken-3"
      :loading="vehicleStore.isArmed === undefined"
      hide-details
      @update:model-value="vehicleStore.isArmed ? vehicleStore.arm() : vehicleStore.disarm()"
    />

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
      class="mx-1 flex items-center justify-center min-w-fit mode-select"
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
