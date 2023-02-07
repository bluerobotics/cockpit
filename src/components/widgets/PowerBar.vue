<template>
  <v-sheet class="topbar flex-centered" color="rgba(255, 255, 255, 0.1)">
    <v-row align="center" justify="center" no-gutters>
      <v-col class="flex-shrink-1">
        <div class="col-container">
          <v-icon class="ma-2" :color="getColor(vehicleStore.isVehicleOnline)">{{ vehicleIcon ?? 'mdi-help' }}</v-icon>

          <v-switch
            v-model="vehicleStore.isArmed"
            :disabled="!vehicleStore.isVehicleOnline"
            class="mx-1 arm-switch"
            color="red-darken-3"
            :loading="vehicleStore.isArmed === undefined"
            hide-details
            @update:model-value="vehicleStore.isArmed ? vehicleStore.arm() : vehicleStore.disarm()"
          />
        </div>
      </v-col>
      <v-col class="flex-grow-1">
        <Alerter />
      </v-col>
      <v-col class="flex-shrink-1">
        <div class="col-container">
          <v-select
            v-model="vehicleStore.mode"
            :disabled="!vehicleStore.isVehicleOnline"
            :items="flightModes"
            bg-color="rgb(255, 255, 255, 0.5)"
            density="compact"
            variant="outlined"
            no-data-text="Waiting for available modes."
            hide-details
            class="mx-1 mode-select"
            @update:model-value="(newMode: string) => vehicleStore.setFlightMode(newMode)"
          />
          <v-icon class="ma-2" :color="getColor(joystickConnected)">mdi-controller</v-icon>
        </div>
      </v-col>
    </v-row>
  </v-sheet>
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
.topbar {
  min-width: 650px;
  width: 100%;
  backdrop-filter: blur(1px);
}
.v-col {
  display: flex;
  align-items: center;
  justify-content: space-around;
}
.col-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  padding: 7px;
}

.v-input--horizontal {
  grid-template-areas: none;
  grid-template-columns: none;
  grid-template-rows: none;
}
.mode-select {
  min-width: 19ch;
  max-width: 20ch;
  display: flex;
  align-items: center;
  justify-content: center;
}
.arm-switch {
  max-width: 7ch;
  max-height: 3ch;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
