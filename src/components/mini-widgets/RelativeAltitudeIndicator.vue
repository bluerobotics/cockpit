<template>
  <div class="flex h-12 w-fit min-w-[8rem] max-w-[9rem] items-center justify-center p-1 text-white">
    <img src="@/assets/altitude-icon.svg" class="h-full" :draggable="false" />
    <div class="ml-1 flex min-w-[4rem] max-w-[6rem] select-none flex-col items-start justify-center">
      <div>
        <span class="w-fit font-mono text-xl font-semibold leading-6">{{ round(altitude, 2).toFixed(2) }}</span>
        <span class="w-fit text-xl font-semibold leading-6"> m</span>
      </div>
      <span class="w-full whitespace-nowrap text-sm font-semibold leading-4">Alt (Rel)</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { round } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'

const store = useMainVehicleStore()

const altitude = ref(0)
watch(store.altitude, () => (altitude.value = store.altitude.rel))
</script>
