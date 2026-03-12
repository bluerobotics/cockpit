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
import { onBeforeMount, ref, toRefs, watch } from 'vue'

import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { round } from '@/libs/utils'
import type { MiniWidget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Mini widget reference
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const defaultOptions = {
  altitudeVariableId: '/mavlink/1/1/GLOBAL_POSITION_INT/relative_alt',
}

onBeforeMount(() => {
  miniWidget.value.options = { ...defaultOptions, ...miniWidget.value.options }
})

const { value: rawAlt } = useDataLakeVariable(() => miniWidget.value.options.altitudeVariableId)

const altitude = ref(0)
watch(rawAlt, (newAlt) => {
  if (newAlt === undefined) return
  altitude.value = (newAlt as number) / 1000
})
</script>
