<template>
  <v-sheet class="topbar" color="rgba(0, 0, 0, 0.05)">
    <v-btn
      :icon="vehicleIcon ?? 'mdi-help'"
      :color="getColor(vehicleStore.isVehicleOnline())"
      variant="text"
    />

    <v-switch
      v-model="armSwitch"
      :disabled="!vehicleStore.isVehicleOnline()"
      class="v-input--horizontal"
      color="red-darken-3"
      :label="`${armSwitch ? 'Armed' : 'Disarmed'}`"
      :loading="vehicleStore.isArmed !== armSwitch ? 'warning' : undefined"
    />

    <v-select
      v-model="flightMode"
      :disabled="!vehicleStore.isVehicleOnline()"
      :items="flightModes"
      density="compact"
      variant="outlined"
      no-data-text="Waiting for available modes."
      hide-details
      :loading="vehicleStore.mode !== flightMode"
    />

    <v-spacer></v-spacer>

    <v-btn
      :icon="'mdi-controller'"
      :color="getColor(joystickConnected)"
      variant="text"
    />
  </v-sheet>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { joystickManager } from '@/libs/joystick/manager'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()

const armSwitch = ref<boolean>(vehicleStore.isArmed)
const flightMode = ref()
const joystickConnected = ref<boolean>(false)

onMounted(() => {
  joystickManager.onJoystickUpdate((event) => {
    processJoystickEvent(event)
  })
})

const processJoystickEvent = (event: Array<Gamepad>): void => {
  joystickConnected.value = event.length !== 0
}

const getColor = (isGreen: boolean): string => {
  return `${isGreen ? 'green' : 'red'} darkden-2`
}

const vehicleIcon = computed(() => vehicleStore.icon)
const flightModes = computed(() => vehicleStore.modesAvailable())

watch(armSwitch, async (newValue) => {
  if (newValue) {
    vehicleStore.arm()
  } else {
    vehicleStore.disarm()
  }
})

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
  armSwitch.value = vehicleStore.isArmed
  flightMode.value = vehicleStore.mode
  vehicleUnsubscribe()
})
</script>

<style scoped>
.topbar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(1px);
}

.v-input--horizontal {
  grid-template-areas: none;
  grid-template-columns: none;
  grid-template-rows: none;
}
</style>
