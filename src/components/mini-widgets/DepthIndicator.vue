<template>
  <div class="h-12 p-1 min-w-[8.5rem] text-white transition-all relative scroll-container">
    <span class="h-full left-[0.5rem] bottom-[12%] absolute mdi text-[2.35rem] mdi-wave-arrow-up" />
    <div class="absolute left-[3rem] h-full select-none font-semibold scroll-container w-full">
      <div class="w-full">
        <span class="font-mono text-xl leading-6">{{ parsedState }}</span>
        <span class="text-xl leading-6">
          {{ String.fromCharCode(0x20) }} {{ unitAbbreviation[displayUnitPreferences.distance] }}
        </span>
      </div>
      <span class="w-full text-sm absolute bottom-[0.5rem] whitespace-nowrap text-ellipsis overflow-x-hidden">
        Depth
      </span>
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

const currentDepth = ref<undefined | number>(undefined)
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
const parsedState = computed(() => {
  const fDepth = currentDepth.value
  if (fDepth === undefined) return '--'
  const precision = fDepth < 10 ? 2 : fDepth >= 10 && fDepth < 1000 ? 1 : 0
  return fDepth.toFixed(precision)
})
</script>
