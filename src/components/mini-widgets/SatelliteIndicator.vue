<template>
  <div class="flex h-12 w-fit min-w-[8rem] max-w-[9rem] items-center justify-center p-1 text-white">
    <span class="mdi mdi-satellite-variant relative w-[2.25rem] text-4xl"></span>
    <div class="ml-1 flex min-w-[4rem] max-w-[6rem] select-none flex-col items-start justify-center">
      <span class="w-fit text-end font-mono font-semibold leading-4">{{ store.statusGPS.visibleSatellites }} sats</span>
      <span class="w-fit text-end font-mono text-sm font-semibold leading-4">{{ store.statusGPS.fixType }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'

datalogger.registerUsage(DatalogVariable.gpsFixType)
datalogger.registerUsage(DatalogVariable.gpsVisibleSatellites)
const store = useMainVehicleStore()
</script>
