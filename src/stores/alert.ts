import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useTextToSpeech } from '@/composables/useTextToSpeech'

import { Alert, AlertLevel } from '../types/alert'

export const useAlertStore = defineStore('alert', () => {
  const alerts = reactive([new Alert(AlertLevel.Success, 'Cockpit started')])
  const enableVoiceAlerts = useBlueOsStorage('cockpit-enable-voice-alerts', true)
  const neverShowArmedMenuWarning = useBlueOsStorage('cockpit-never-show-armed-menu-warning', false)
  const skipArmedMenuWarningThisSession = ref(false)
  const { speak } = useTextToSpeech()
  const enabledAlertLevels = useBlueOsStorage('cockpit-enabled-alert-levels', [
    { level: AlertLevel.Info, enabled: false },
    { level: AlertLevel.Success, enabled: true },
    { level: AlertLevel.Error, enabled: true },
    { level: AlertLevel.Warning, enabled: true },
    { level: AlertLevel.Critical, enabled: true },
  ])
  const alertVolume = useBlueOsStorage('cockpit-alert-volume', 1)

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

  const pushSuccessAlert = (message: string, time_created: Date = new Date()): void => {
    pushAlert(new Alert(AlertLevel.Success, message, time_created))
  }
  const pushErrorAlert = (message: string, time_created: Date = new Date()): void => {
    pushAlert(new Alert(AlertLevel.Error, message, time_created))
  }
  const pushInfoAlert = (message: string, time_created: Date = new Date()): void => {
    pushAlert(new Alert(AlertLevel.Info, message, time_created))
  }
  const pushWarningAlert = (message: string, time_created: Date = new Date()): void => {
    pushAlert(new Alert(AlertLevel.Warning, message, time_created))
  }
  const pushCriticalAlert = (message: string, time_created: Date = new Date()): void => {
    pushAlert(new Alert(AlertLevel.Critical, message, time_created))
  }

  // Track the index of the last alert that finished being spoken.
  const lastSpokenAlertIndex = ref(0)

  watch(alerts, () => {
    const lastAlertIndex = alerts.length - 1
    const lastAlert = alerts[lastAlertIndex]
    const alertLevelEnabled = enabledAlertLevels.value.find((enabledAlert) => enabledAlert.level === lastAlert.level)
    const shouldMute =
      !enableVoiceAlerts.value ||
      ((alertLevelEnabled === undefined || !alertLevelEnabled.enabled) && !lastAlert.message.startsWith('#'))
    const volume = shouldMute ? 0 : alertVolume.value
    speak(lastAlert.message, volume).finally(() => {
      lastSpokenAlertIndex.value = lastAlertIndex
    })
  })

  return {
    alerts,
    enableVoiceAlerts,
    enabledAlertLevels,
    sortedAlerts,
    pushAlert,
    pushSuccessAlert,
    pushErrorAlert,
    pushInfoAlert,
    pushWarningAlert,
    pushCriticalAlert,
    neverShowArmedMenuWarning,
    skipArmedMenuWarningThisSession,
    alertVolume,
    lastSpokenAlertIndex,
  }
})
