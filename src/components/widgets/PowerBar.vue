<template>
  <v-sheet class="topbar" color="rgba(255, 255, 255, 0.8)">
    <v-row align="center" justify="center" no-gutters>
      <v-col class="flex-shrink-1">
        <div class="col-container">
          <v-btn :icon="vehicleIcon ?? 'mdi-help'" :color="getColor(vehicleStore.isVehicleOnline)" variant="text" />

          <v-switch
            v-model="vehicleStore.isArmed"
            :disabled="!vehicleStore.isVehicleOnline"
            class="mx-1"
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
            v-model="flightMode"
            :disabled="!vehicleStore.isVehicleOnline"
            :items="flightModes"
            density="compact"
            variant="outlined"
            no-data-text="Waiting for available modes."
            hide-details
            class="mx-1 mode-select"
            :loading="vehicleStore.mode !== flightMode"
          />
          <v-btn :icon="'mdi-controller'" :color="getColor(joystickConnected)" variant="text" />
        </div>
      </v-col>
    </v-row>
  </v-sheet>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { joystickManager } from '@/libs/joystick/manager'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import Alerter from './Alerter.vue'

const vehicleStore = useMainVehicleStore()

const flightMode = ref()
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

watch(flightMode, async (newMode) => {
  if (newMode === vehicleStore.mode) {
    return
  }

  vehicleStore.setFlightMode(newMode)
})

// Deal with initial vehicle state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let vehicleUnsubscribe: any = undefined
vehicleUnsubscribe = vehicleStore.$subscribe(() => {
  flightMode.value = vehicleStore.mode
  vehicleUnsubscribe()
})
</script>

<style scoped>
.topbar {
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
  padding: 5px;
}

.v-input--horizontal {
  grid-template-areas: none;
  grid-template-columns: none;
  grid-template-rows: none;
}
.mode-select {
  min-width: 190px;
}
</style>
