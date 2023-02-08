<template>
  <div
    :class="`bg-${levelColor(currentAlert.level)}`"
    class="flex items-center justify-between rounded p-2 whitespace-nowrap overflow-hidden flex-grow m-1"
  >
    <p class="mx-1 text-xl font-medium text-gray-100 overflow-hidden">{{ currentAlert.message }}</p>
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

const levelColor = (level: AlertLevel): string => {
  switch (level) {
    case AlertLevel.Critical:
      return 'critical'
    case AlertLevel.Error:
      return 'error'
    case AlertLevel.Info:
      return 'info'
    case AlertLevel.Success:
      return 'success'
    case AlertLevel.Warning:
      return 'warning'
    default:
      return 'info'
  }
}
</script>
