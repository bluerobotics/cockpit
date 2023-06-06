<template>
  <div class="relative flex-grow mx-1 my-1.5">
    <div
      class="flex items-center justify-between p-1 overflow-hidden rounded cursor-pointer whitespace-nowrap bg-slate-800/75"
      @click="toggleExpandedAlerts()"
    >
      <p class="mx-1 overflow-hidden text-xl font-medium text-gray-100">{{ currentAlert.message }}</p>
      <p class="mx-1 text-gray-100">
        {{ formattedDate(currentAlert.time_created || new Date()) }}
      </p>
    </div>
    <div
      class="absolute w-full p-2 transition-all rounded top-12 max-h-[30vh] overflow-y-auto text-slate-50 scrollbar-hide bg-slate-800/75 select-none flex flex-col"
      :class="{ 'opacity-0': !isShowingExpandedAlerts }"
    >
      <div v-for="(alert, i) in alertStore.sortedAlerts.reverse()" :key="alert.time_created.toISOString()">
        <div class="flex items-center justify-between whitespace-nowrap">
          <p class="mx-1 overflow-hidden text-lg font-medium leading-none text-ellipsis">{{ alert.message }}</p>
          <p class="mx-1">
            {{ formattedDate(alert.time_created || new Date()) }}
          </p>
        </div>
        <div v-if="i !== alertStore.alerts.length - 1" class="h-px mx-1 mb-2 bg-slate-50/30" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTimestamp, useToggle } from '@vueuse/core'
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

const [isShowingExpandedAlerts, toggleExpandedAlerts] = useToggle()
</script>
