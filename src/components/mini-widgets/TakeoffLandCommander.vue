<template>
  <button
    class="relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9 bg-slate-800/60 hover:bg-slate-400/60"
    @click="vehicleStore.showTakeoff ? vehicleStore.takeoff() : vehicleStore.land()"
  >
    <span class="inline-block font-extrabold align-middle text-white">
      {{ vehicleStore.showTakeoff === undefined ? '...' : vehicleStore.showTakeoff ? 'Takeoff' : 'Land' }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()
</script>
