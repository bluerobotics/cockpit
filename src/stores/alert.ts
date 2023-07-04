import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'

import { Alert, AlertLevel } from '../types/alert'

export const useAlertStore = defineStore('alert', () => {
  const alerts = reactive([new Alert(AlertLevel.Success, 'Cockpit started')])
  const enableVoiceAlerts = useStorage('cockpit-enable-voice-alerts', true)
  const enabledAlertLevels = useStorage('cockpit-enabled-alert-levels', [
    { level: AlertLevel.Success, enabled: true },
    { level: AlertLevel.Error, enabled: true },
    { level: AlertLevel.Info, enabled: true },
    { level: AlertLevel.Warning, enabled: true },
    { level: AlertLevel.Critical, enabled: true },
  ])

  const sortedAlerts = computed(() => {
    return alerts.sort((a, b) => a.time_created.getTime() - b.time_created.getTime())
  })

  const pushAlert = (alert: Alert): void => {
    alerts.push(alert)

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

  return { alerts, enableVoiceAlerts, enabledAlertLevels, sortedAlerts, pushAlert }
})
