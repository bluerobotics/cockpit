<template>
    <button
      class="relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9 bg-slate-800/60"
      @click="vehicleStore.takeoff()"
    >
      <div
        class="absolute top-auto flex items-center px-1 rounded-[4px] shadow hover:bg-slate-400/60 transition-all w-[70%] h-[80%]"
        :class="{
          'bg-slate-900/60 text-slate-50 justify-end left-[26%]': vehicleStore.isReady,
          'justify-start bg-slate-800/60 text-slate-400 left-[4%]': !vehicleStore.isReady
        }"
      >
        <span class="inline-block font-extrabold align-middle">
          Takeoff
          <!-- {{ vehicleStore.isReady === undefined ? '...' : vehicleStore.isReady ? 'Ready' : 'Not Ready' }} -->
        </span>
      </div>
    </button>
  </template>
  
  <script setup lang="ts">
  import { useMainVehicleStore } from '@/stores/mainVehicle'
  
  const vehicleStore = useMainVehicleStore()
  
  // You can define additional logic or computed properties here if needed
  </script>
  