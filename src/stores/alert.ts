import { defineStore } from 'pinia'
import { type Ref, ref } from 'vue'

import { Alert, AlertLevel } from '../types/alert'

export const useAlertStore = defineStore('alert', () => {
  const alerts: Ref<Alert[]> = ref([
    new Alert(AlertLevel.Success, 'Cockpit started'),
  ])

  const pushAlert = (alert: Alert): void => {
    alerts.value.push(alert)

    switch (alert.level) {
      case AlertLevel.Success:
        console.log(alert.message)
        break
      case AlertLevel.Error:
        console.error(alert.message)
        break
      case AlertLevel.Info:
        console.info(alert.message)
        break
      case AlertLevel.Warning:
        console.warn(alert.message)
        break
      case AlertLevel.Critical:
        console.error(alert.message)
        break
      default:
        unimplemented(`A new alert level was added but we have not updated
        this part of the code. Regardless of that, here's the alert message: ${alert.message}`)
        break
    }
  }

  return { alerts, pushAlert }
})
