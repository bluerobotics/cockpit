<template>
  <v-sheet rounded class="main-sheet" :color="levelColor(currentAlert.level)">
    <p class="text-h5">{{ currentAlert.message }}</p>
    <p class="text-h7">
      {{ formattedDate(currentAlert.time_created || new Date()) }}
    </p>
  </v-sheet>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import { computed } from 'vue'

import { useAlertStore } from '@/stores/alert'
import { useVehicleAlerterStore } from '@/stores/vehicleAlerter'
import { Alert, AlertLevel } from '@/types/alert'

useVehicleAlerterStore()
const alertStore = useAlertStore()

const formattedDate = (datetime: Date): string => format(datetime, 'HH:mm:ss')

const currentAlert = computed(
  () => alertStore.alerts.last() || new Alert(AlertLevel.Info, 'No alerts.')
)

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
  width: 400px;
  height: 84%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 10px;
  padding: 6px;
  white-space: nowrap;
}
.main-sheet p {
  color: rgb(60, 60, 60);
}
</style>
