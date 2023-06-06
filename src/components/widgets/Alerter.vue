<template>
  <div
    class="flex items-center justify-between flex-grow p-2 mx-1 my-1.5 overflow-hidden rounded whitespace-nowrap bg-slate-800/75"
  >
    <p class="mx-1 overflow-hidden text-xl font-medium text-gray-100">{{ currentAlert.message }}</p>
    <p class="mx-1 text-gray-100">
      {{ formattedDate(currentAlert.time_created || new Date()) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { format } from 'date-fns'
import { computed } from 'vue'

import { useAlertStore } from '@/stores/alert'
import { useVehicleAlerterStore } from '@/stores/vehicleAlerter'
import { Alert, AlertLevel } from '@/types/alert'

useVehicleAlerterStore()
const alertStore = useAlertStore()
const timeNow = useTimestamp({ interval: 1000 })
const alertPersistencyInterval = 10 // in seconds

const formattedDate = (datetime: Date): string => format(datetime, 'HH:mm:ss')

const currentAlert = computed((): Alert => {
  const secsNow = new Date(timeNow.value).getSeconds()
  const secsLastAlert = alertStore.alerts.last()?.time_created.getSeconds() || secsNow - alertPersistencyInterval - 1
  if (secsNow - secsLastAlert > alertPersistencyInterval) {
    return new Alert(AlertLevel.Info, 'No recent alerts.')
  }
  return alertStore.alerts.last()!
})
</script>
