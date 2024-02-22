<template>
  <button
    :class="[
      'relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9',
      vehicleStore.flying ? 'bg-slate-800/60 hover:bg-slate-400/60' : 'bg-slate-400/60 cursor-not-allowed',
    ]"
    :disabled="!vehicleStore.flying"
    @click="vehicleStore.changeAlt()"
  >
    <span class="inline-block font-extrabold align-middle text-white"> Change Alt </span>
  </button>
</template>

<script setup lang="ts">
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()
</script>
