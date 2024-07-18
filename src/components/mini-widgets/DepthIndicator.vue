<template>
  <div class="w-[8.5rem] h-12 p-1 text-white relative">
    <img src="@/assets/depth-icon.svg" class="h-[80%] left-[0.5rem] top-[13%] absolute" :draggable="false" />
    <div class="absolute left-[3rem] flex flex-col items-start justify-center select-none">
      <div>
        <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ finalDepth.toFixed(precision) }}</span>
        <span class="text-xl font-semibold leading-6 w-fit"> m</span>
      </div>
      <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">Depth</span>
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
  if (fDepth < 10) return 2
  if (fDepth >= 10 && fDepth < 1000) return 1
  return 0
})
</script>
