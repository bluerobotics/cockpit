<template>
  <div class="flex items-center w-fit min-w-[8rem] max-w-[9rem] h-12 p-1 text-white justify-center">
    <img src="@/assets/depth-icon.svg" class="h-full" :draggable="false" />
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <div>
        <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ round(averageDepth, 2) }}</span>
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

import { round } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()

// Calculate depth time-average (50 values window)
const depth = ref(0)
watch(store.altitude, () => (depth.value = -store.altitude.msl))
const { history: depthHistory } = useRefHistory(depth, { capacity: 50 })
const averageDepth = useAverage(() => depthHistory.value.map((depthHistoryValue) => depthHistoryValue.snapshot))
</script>
