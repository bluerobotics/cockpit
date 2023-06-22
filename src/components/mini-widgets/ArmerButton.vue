<template>
  <button
    class="relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9 bg-slate-800/60"
    @click="vehicleStore.isArmed ? vehicleStore.disarm() : vehicleStore.arm()"
  >
    <div
      class="absolute top-auto flex items-center px-1 rounded-[4px] shadow hover:bg-slate-400/60 transition-all w-[70%] h-[80%]"
      :class="
        vehicleStore.isArmed
          ? 'bg-slate-900/60 text-slate-50 justify-end left-[26%]'
          : 'justify-start bg-slate-800/60 text-slate-400 left-[4%]'
      "
    >
      <span class="inline-block font-extrabold align-middle">
        {{ vehicleStore.isArmed === undefined ? '...' : vehicleStore.isArmed ? 'Armed' : 'Disarmed' }}
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()
</script>
