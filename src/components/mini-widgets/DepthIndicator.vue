<template>
  <div class="flex items-center w-[8.25rem] h-12 p-1 text-white justify-center">
    <img src="@/assets/depth-icon.svg" class="h-full" :draggable="false" />
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <div>
        <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ averageDepth.toPrecision(precision) }}</span>
        <span class="text-xl font-semibold leading-6 w-fit"> m</span>
      </div>
      <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">Depth</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRefHistory } from '@vueuse/core'
import { useAverage } from '@vueuse/math'
import { ref, watch } from 'vue'
import { computed } from 'vue'

import { datalogger, DatalogVariable } from '@/libs/logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()
datalogger.registerUsage(DatalogVariable.depth)

// Calculate depth time-average (50 values window)
const depth = ref(0)
watch(store.altitude, () => (depth.value = -store.altitude.msl))
const { history: depthHistory } = useRefHistory(depth, { capacity: 50 })
const averageDepth = useAverage(() => depthHistory.value.map((depthHistoryValue) => depthHistoryValue.snapshot))
const precision = computed(() => {
  const avDepth = averageDepth.value
  if (avDepth < 1) return 2
  if (avDepth >= 1 && avDepth < 100) return 3
  if (avDepth >= 10000) return 5
  return 4
})
</script>
