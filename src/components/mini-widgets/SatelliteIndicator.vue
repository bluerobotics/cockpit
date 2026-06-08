<template>
  <div class="flex items-center w-fit min-w-[8rem] max-w-[9rem] h-12 p-1 text-white justify-center">
    <span class="relative w-[2.25rem] mdi mdi-satellite-variant text-4xl"></span>
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <span class="font-mono font-semibold leading-4 text-end w-fit">{{ satellitesDisplay }} sats</span>
      <span class="font-mono text-sm font-semibold leading-4 text-end w-fit">{{ fixTypeDisplay }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, toRefs } from 'vue'

import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import type { MiniWidget } from '@/types/widgets'

const gpsFixTypeLabels: Record<string, string> = {
  GPS_FIX_TYPE_NO_GPS: 'No GPS',
  GPS_FIX_TYPE_NO_FIX: 'No fix',
  GPS_FIX_TYPE_2D_FIX: '2D fix',
  GPS_FIX_TYPE_3D_FIX: '3D fix',
  GPS_FIX_TYPE_DGPS: 'DGPS fix',
  GPS_FIX_TYPE_RTK_FLOAT: 'RTK float',
  GPS_FIX_TYPE_RTK_FIXED: 'RTK fix',
  GPS_FIX_TYPE_STATIC: 'Static',
  GPS_FIX_TYPE_PPP: 'PPP fix',
}

const props = defineProps<{
  /**
   * Mini widget reference
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const defaultOptions = {
  satellitesVariableId: '/mavlink/1/1/GPS_RAW_INT/satellites_visible',
  fixTypeVariableId: '/mavlink/1/1/GPS_RAW_INT/fix_type',
}

onBeforeMount(() => {
  miniWidget.value.options = { ...defaultOptions, ...miniWidget.value.options }
})

datalogger.registerUsage(DatalogVariable.gpsFixType)
datalogger.registerUsage(DatalogVariable.gpsVisibleSatellites)

const { value: rawSatellites } = useDataLakeVariable(() => miniWidget.value.options.satellitesVariableId)
const { value: rawFixType } = useDataLakeVariable(() => miniWidget.value.options.fixTypeVariableId)

const satellitesDisplay = computed(() => rawSatellites.value ?? '--')
const fixTypeDisplay = computed(() => {
  if (rawFixType.value === undefined) return '--'
  return gpsFixTypeLabels[rawFixType.value as string] ?? rawFixType.value
})
</script>
