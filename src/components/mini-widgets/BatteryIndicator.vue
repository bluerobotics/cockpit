<template>
  <div
    v-tooltip="'Your vehicle does not provide state-of-charge. Displaying voltage and current instead.'"
    class="flex items-center w-[5.5rem] h-12 text-white justify-center"
  >
    <span class="relative w-[1.5rem] mdi battery-icon" :class="[batteryIconClass]">
      <span class="absolute text-sm text-yellow-400 -bottom-[2px] -right-[7px] mdi mdi-alert-circle"></span>
    </span>
    <div class="flex flex-col w-[4rem] select-none text-sm font-semibold leading-4 text-end">
      <div class="w-full">
        <span class="font-mono">{{ voltageDisplayValue }}</span>
        <span> V</span>
      </div>
      <div class="w-full">
        <span class="font-mono">{{ currentDisplayValue }}</span>
        <span> A</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()

const voltageDisplayValue = computed(() => {
  if (store.powerSupply.voltage === undefined) return NaN
  return Math.abs(store.powerSupply.voltage) >= 100
    ? store.powerSupply.voltage.toFixed(0)
    : store.powerSupply.voltage.toFixed(1)
})

const currentDisplayValue = computed(() => {
  if (store.powerSupply.current === undefined) return NaN
  return Math.abs(store.powerSupply.current) >= 100
    ? store.powerSupply.current.toFixed(0)
    : store.powerSupply.current.toFixed(1)
})

// TODO: With a proper percentage model in hand, we should use different icons for each battery level.
// TODO: We can also allow the user to set it's 100% and 0% voltages and use a linear fit accordingly
const batteryIconClass = computed(() => {
  return 'mdi-battery'
})
</script>

<style>
.battery-icon {
  font-size: 2.25rem;
  line-height: 2.25rem;
}
</style>
