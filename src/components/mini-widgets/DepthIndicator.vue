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
import { computed, onBeforeMount, ref, toRefs, watch } from 'vue'

import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { unitAbbreviation } from '@/libs/units'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { MiniWidget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Mini widget reference
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const defaultOptions = {
  depthVariableId: '/mavlink/1/1/AHRS2/altitude',
}

onBeforeMount(() => {
  miniWidget.value.options = { ...defaultOptions, ...miniWidget.value.options }
})

const { displayUnitPreferences } = useAppInterfaceStore()
datalogger.registerUsage(DatalogVariable.depth)

const { value: rawAltitude } = useDataLakeVariable(() => miniWidget.value.options.depthVariableId)

const currentDepth = ref<undefined | number>(undefined)
watch(rawAltitude, (newAlt) => {
  if (newAlt === undefined) return
  const altMeters = newAlt as number
  const depth = unit(-altMeters, 'm')
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
