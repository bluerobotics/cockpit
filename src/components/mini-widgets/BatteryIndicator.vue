<template>
  <div
    v-tooltip="'Your vehicle does not provide state-of-charge. Displaying voltage and current instead.'"
    class="flex h-12 w-[5.5rem] items-center justify-center text-white"
  >
    <span class="mdi battery-icon relative w-[1.5rem]" :class="[batteryIconClass]">
      <span class="mdi mdi-alert-circle absolute -bottom-[2px] -right-[7px] text-sm text-yellow-400"></span>
    </span>
    <div class="flex w-[4rem] select-none flex-col text-end text-sm font-semibold leading-4">
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
  if (store?.powerSupply?.voltage === undefined) return NaN
  return Math.abs(store.powerSupply.voltage) >= 100
    ? store.powerSupply.voltage.toFixed(0)
    : store.powerSupply.voltage.toFixed(1)
})

const currentDisplayValue = computed(() => {
  if (store?.powerSupply?.current === undefined) return NaN
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
