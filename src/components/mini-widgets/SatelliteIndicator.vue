<template>
  <div class="flex items-center w-fit min-w-[8rem] max-w-[9rem] h-12 p-1 text-white justify-center">
    <span class="relative w-[2.25rem] mdi mdi-satellite-variant text-4xl"></span>
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <span class="font-mono font-semibold leading-4 text-end w-fit">{{ t`${satellitesDisplay} sats` }}</span>
      <span class="font-mono text-sm font-semibold leading-4 text-end w-fit">{{ fixTypeDisplay }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, toRefs } from 'vue'

import { useDataLakeVariable } from '@/composables/useDataLakeVariable'
import { useResolvedDataLakeTemplate } from '@/composables/useResolvedDataLakeTemplate'
import type { GpsFixType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { gpsFixTypeLabels } from '@/libs/vehicle/types'
import type { MiniWidget } from '@/types/widgets'

const props = defineProps<{
  /**
   * Mini widget reference
   */
  miniWidget: MiniWidget
}>()
const miniWidget = toRefs(props).miniWidget

const defaultOptions = {
  satellitesVariableId: '/mavlink/{{autopilotSystemId}}/1/GPS_RAW_INT/satellites_visible',
  fixTypeVariableId: '/mavlink/{{autopilotSystemId}}/1/GPS_RAW_INT/fix_type',
}

onBeforeMount(() => {
  miniWidget.value.options = { ...defaultOptions, ...miniWidget.value.options }
})

datalogger.registerUsage(DatalogVariable.gpsFixType)
datalogger.registerUsage(DatalogVariable.gpsVisibleSatellites)

const resolvedSatellitesVariableId = useResolvedDataLakeTemplate(() => miniWidget.value.options.satellitesVariableId)
const resolvedFixTypeVariableId = useResolvedDataLakeTemplate(() => miniWidget.value.options.fixTypeVariableId)
const { value: rawSatellites } = useDataLakeVariable(resolvedSatellitesVariableId)
const { value: rawFixType } = useDataLakeVariable(resolvedFixTypeVariableId)

const satellitesDisplay = computed(() => rawSatellites.value ?? '--')
const fixTypeDisplay = computed(() => {
  if (rawFixType.value === undefined) return '--'
  return gpsFixTypeLabels[rawFixType.value as GpsFixType] ?? rawFixType.value
})
</script>
