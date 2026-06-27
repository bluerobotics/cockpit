<template>
  <div>
    <Dropdown
      :model-value="currentMode"
      :options="vehicleStore.modesAvailable()"
      class="min-w-[128px]"
      @update:model-value="onModeSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import Dropdown from '../Dropdown.vue'

datalogger.registerUsage(DatalogVariable.mode)
const vehicleStore = useMainVehicleStore()
const currentMode = ref()

// Bound to the dropdown's user-selection event (not a watch on currentMode) so that automated mode changes
// reflected by the polling below don't get logged or re-issued as if the user changed the mode.
const onModeSelected = (newMode: unknown): void => {
  currentMode.value = newMode
  if (newMode === undefined || newMode === vehicleStore.mode) return
  logUserAction(`Changed flight mode to '${newMode}'`)
  vehicleStore.setFlightMode(newMode as string)
}

// eslint-disable-next-line no-undef
let modeUpdateInterval: NodeJS.Timer | undefined = undefined
onMounted(() => (modeUpdateInterval = setInterval(() => (currentMode.value = vehicleStore.mode), 500)))
onUnmounted(() => clearInterval(modeUpdateInterval))
</script>
