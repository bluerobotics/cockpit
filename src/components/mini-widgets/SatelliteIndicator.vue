<template>
  <div class="flex items-center w-fit min-w-[8rem] max-w-[9rem] h-12 p-1 text-white justify-center">
    <span class="relative w-[2.25rem] mdi mdi-satellite-variant text-4xl"></span>
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <span class="font-mono font-semibold leading-4 text-end w-fit">{{ store.statusGPS.visibleSatellites }} sats</span>
      <span class="font-mono text-sm font-semibold leading-4 text-end w-fit">{{ store.statusGPS.fixType }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { datalogger, DatalogVariable } from '@/libs/logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'

datalogger.registerUsage(DatalogVariable.gpsFixType)
datalogger.registerUsage(DatalogVariable.gpsVisibleSatellites)
const store = useMainVehicleStore()
</script>
