<template>
  <div class="flex h-12 w-[8.25rem] items-center justify-center p-1 text-white">
    <img src="@/assets/depth-icon.svg" class="h-full" :draggable="false" />
    <div class="ml-1 flex min-w-[4rem] max-w-[6rem] select-none flex-col items-start justify-center">
      <div>
        <span class="w-fit font-mono text-xl font-semibold leading-6">{{ finalDepth.toPrecision(precision) }}</span>
        <span class="w-fit text-xl font-semibold leading-6"> m</span>
      </div>
      <span class="w-full whitespace-nowrap text-sm font-semibold leading-4">Depth</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()
datalogger.registerUsage(DatalogVariable.depth)

const depth = ref(0)
watch(store.altitude, () => (depth.value = -store.altitude.msl))
const finalDepth = computed(() => (depth.value < 0.01 ? 0 : depth.value))
const precision = computed(() => {
  const fDepth = finalDepth.value
  if (fDepth < 0.1) return 1
  if (fDepth < 1) return 2
  if (fDepth >= 1 && fDepth < 100) return 3
  if (fDepth >= 10000) return 5
  return 4
})
</script>
