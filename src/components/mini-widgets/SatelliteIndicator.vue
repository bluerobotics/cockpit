<template>
  <div class="flex items-center w-fit min-w-[8rem] max-w-[9rem] h-12 p-1 text-white justify-center">
    <span class="relative w-[2.25rem] mdi mdi-satellite-variant text-4xl"></span>
    <div class="flex flex-col items-start justify-center ml-1 min-w-[4rem] max-w-[6rem] select-none">
      <span class="font-mono font-semibold leading-4 text-end w-fit"
        >{{ store.statusGPS.visibleSatellites }} {{ $t('indicators.sats') }}</span
      >
      <span class="font-mono text-sm font-semibold leading-4 text-end w-fit">
        {{ tFixType }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { useMainVehicleStore } from '@/stores/mainVehicle'

datalogger.registerUsage(DatalogVariable.gpsFixType)
datalogger.registerUsage(DatalogVariable.gpsVisibleSatellites)
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const store = useMainVehicleStore()
const { t } = useI18n()

const tFixType = computed(() => {
  const map: Record<string, string> = {
    'No GPS': 'NO_GPS',
    'No fix': 'NO_FIX',
    '2D fix': 'FIX_2D',
    '3D fix': 'FIX_3D',
    'DGPS fix': 'DGPS',
    'RTK float': 'RTK_FLOAT',
    'RTK fix': 'RTK_FIXED',
    'Static': 'STATIC',
    'PPP fix': 'PPP',
  }

  const v = store.statusGPS.fixType
  const key = map[v]
  if (key) {
    return t(`indicators.fixTypes.${key}`)
  }

  // Fallback to raw value
  return v
})
</script>
