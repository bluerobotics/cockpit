<template>
  <v-sheet rounded class="main-sheet" :color="levelColor(currentAlert.level)">
    <p class="text-h5">{{ currentAlert.message }}</p>
    <p class="text-h7">
      {{ formattedDate(currentAlert.time_created || new Date()) }}
    </p>
  </v-sheet>
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
      return 'rgb(127, 52, 207)'
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

<style scoped>
.main-sheet {
  min-width: 300px;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0.5ch;
  padding: 0.3ch;
  white-space: nowrap;
  overflow: hidden;
}
.main-sheet p {
  color: rgb(60, 60, 60);
}
</style>
