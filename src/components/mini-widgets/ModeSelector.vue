<template>
  <div>
    <Dropdown v-model="currentMode" :options="vehicleStore.modesAvailable()" class="min-w-[128px]" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import Dropdown from '../Dropdown.vue'

datalogger.registerUsage(DatalogVariable.mode)
const vehicleStore = useMainVehicleStore()
const currentMode = ref()

watch(currentMode, (newVal) => {
  if (currentMode.value === undefined) return
  // Fetch the current mode directly from the store to ensure it's different
  if (newVal === vehicleStore.mode) {
    console.log('New mode is the same as the current one. No mode-change commands will be issued.')
    return
  }
  vehicleStore.setFlightMode(currentMode.value)
})

// eslint-disable-next-line no-undef
let modeUpdateInterval: NodeJS.Timer | undefined = undefined
onMounted(() => (modeUpdateInterval = setInterval(() => (currentMode.value = vehicleStore.mode), 500)))
onUnmounted(() => clearInterval(modeUpdateInterval))
</script>
