import { defineStore } from 'pinia'
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { useTextToSpeech } from '@/composables/useTextToSpeech'
import { nextAlertIndex } from '@/libs/alert-priority'

import { Alert, AlertLevel } from '../types/alert'

export const useAlertStore = defineStore('alert', () => {
  const alerts = reactive([new Alert(AlertLevel.Success, 'Cockpit started')])
  const enableVoiceAlerts = useBlueOsStorage('cockpit-enable-voice-alerts', true)
  const neverShowArmedMenuWarning = useBlueOsStorage('cockpit-never-show-armed-menu-warning', false)
  const skipArmedMenuWarningThisSession = ref(false)
  const { speak, waitUntilIdle, cancelSpeech } = useTextToSpeech()
  const enabledAlertLevels = useBlueOsStorage('cockpit-enabled-alert-levels', [
    { level: AlertLevel.Info, enabled: false },
    { level: AlertLevel.Success, enabled: true },
    { level: AlertLevel.Error, enabled: true },
    { level: AlertLevel.Warning, enabled: true },
    { level: AlertLevel.Critical, enabled: true },
  ])
  const alertVolume = useBlueOsStorage('cockpit-alert-volume', 1)
  const pendingAlerts: {
    /** Alert waiting for playback. */
    alert: Alert
    /** State group whose older pending announcement this alert supersedes. */
    replacementKey?: string
    /** Volume captured on arrival, or zero after voice alerts are disabled. */
    volume: number
  }[] = []
  const currentAlert = ref(alerts[0])
  const lastAlertPlaybackFinishedAt = ref(currentAlert.value.time_created)
  const isProcessingAlerts = ref(false)

  watch(
    enableVoiceAlerts,
    (enabled) => {
      if (!enabled) {
        pendingAlerts.forEach((pending) => (pending.volume = 0))
        cancelSpeech()
      }
    },
    { flush: 'sync' }
  )

  const sortedAlerts = computed(() => {
    return [...alerts].sort((a, b) => a.time_created.getTime() - b.time_created.getTime())
  })

  /**
   * Record an alert and queue its announcement.
   * @param {Alert} alert - Alert to retain in history.
   * @param {string} [replacementKey] - Supersede older pending announcements in this group.
   * Already playing speech and recorded history are kept.
   * @returns {void}
   */
  const pushAlert = (alert: Alert, replacementKey?: string): void => {
    alerts.push(alert)
    enqueueAlert(alert, replacementKey)

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

  const processPendingAlerts = async (): Promise<void> => {
    while (pendingAlerts.length > 0) {
      await waitUntilIdle()
      const index = nextAlertIndex(pendingAlerts.map((pending) => pending.alert))
      const [pending] = pendingAlerts.splice(index, 1)
      currentAlert.value = pending.alert
      await speak(pending.alert.message, pending.volume)
      lastAlertPlaybackFinishedAt.value = new Date()
    }
    isProcessingAlerts.value = false
  }

  const enqueueAlert = (alert: Alert, replacementKey?: string): void => {
    if (replacementKey !== undefined) {
      for (let index = pendingAlerts.length - 1; index >= 0; index--) {
        if (pendingAlerts[index].replacementKey === replacementKey) pendingAlerts.splice(index, 1)
      }
    }
    const alertLevelEnabled = enabledAlertLevels.value.find((enabledAlert) => enabledAlert.level === alert.level)
    const shouldMute =
      !enableVoiceAlerts.value ||
      ((alertLevelEnabled === undefined || !alertLevelEnabled.enabled) && !alert.message.startsWith('#'))
    const volume = shouldMute ? 0 : alertVolume.value
    pendingAlerts.push({ alert, replacementKey, volume })
    if (isProcessingAlerts.value) return
    isProcessingAlerts.value = true
    void nextTick().then(processPendingAlerts)
  }

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
    currentAlert,
    lastAlertPlaybackFinishedAt,
    isProcessingAlerts,
  }
})
