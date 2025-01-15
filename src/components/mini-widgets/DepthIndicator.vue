<template>
  <div class="w-[8.5rem] h-12 p-1 text-white relative">
    <v-icon class="h-full left-[0.5rem] bottom-[7%] absolute text-[2.25rem]">mdi-wave-arrow-up</v-icon>
    <div class="absolute left-[3rem] flex flex-col items-start justify-center select-none">
      <div>
        <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ currentDepth.toFixed(precision) }}</span>
        <span class="text-xl font-semibold leading-6 w-fit">
          {{ String.fromCharCode(0x20) }}{{ unitAbbreviation[displayUnitPreferences.distance] }}
        </span>
      </div>
      <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">Depth</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { unit } from 'mathjs'
import { computed, ref, watch } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { unitAbbreviation } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const vehicleStore = useMainVehicleStore()
const { displayUnitPreferences } = useAppInterfaceStore()
datalogger.registerUsage(DatalogVariable.depth)

const currentDepth = ref(0)
watch(vehicleStore.altitude, () => {
  const altitude = vehicleStore.altitude.msl
  const depth = unit(-altitude.value, altitude.toJSON().unit)
  if (depth.value < 0.01) {
    currentDepth.value = 0
    return
  }

  const depthConverted = depth.to(displayUnitPreferences.distance)
  currentDepth.value = depthConverted.toJSON().value
})
const precision = computed(() => {
  const fDepth = currentDepth.value
  if (fDepth < 10) return 2
  if (fDepth >= 10 && fDepth < 1000) return 1
  return 0
})
</script>
