<template>
    <div class="flex items-center w-fit min-w-[8rem] max-w-[9rem] h-12 p-1 text-white justify-center">
        <img src="@/assets/altitude-icon.svg" class="h-full" :draggable="false" />
        <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
            <div>
                <span class="font-mono text-xl font-semibold leading-6 w-fit">{{ round(altitude, 2).toFixed(2) }}</span>
                <span class="text-xl font-semibold leading-6 w-fit"> m</span>
            </div>
            <span class="w-full text-sm font-semibold leading-4 whitespace-nowrap">Alt (Rel)</span>
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
  