import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'

import { Alert, AlertLevel } from '../types/alert'

export const useAlertStore = defineStore('alert', () => {
  const alerts = reactive([new Alert(AlertLevel.Success, 'Cockpit started')])
  const enableVoiceAlerts = useStorage('cockpit-enable-voice-alerts', true)
  // eslint-disable-next-line jsdoc/require-jsdoc
  const availableAlertSpeechVoices = reactive<SpeechSynthesisVoice[]>([])
  const selectedAlertSpeechVoiceName = useStorage<string | undefined>('cockpit-selected-alert-speech-voice', undefined)
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

  // Alert speech syntesis routine
  const synth = window.speechSynthesis

  // We need to cache these otherwise they get garbage collected...
  const utterance_cache: SpeechSynthesisUtterance[] = []

  synth.onvoiceschanged = () => {
    synth.getVoices().forEach((voice) => {
      availableAlertSpeechVoices.push(voice)
      if (selectedAlertSpeechVoiceName.value === undefined && voice.default) {
        selectedAlertSpeechVoiceName.value = voice.name
      }
    })
  }

  const availableAlertSpeechVoiceNames = computed(() =>
    availableAlertSpeechVoices.map((v) => ({ value: v.name, name: `${v.name} (${v.lang})` }))
  )

  /**
   * Speaks a text out loud using the browsers TTS engine
   * @param {string} text string
   */
  function speak(text: string): void {
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = availableAlertSpeechVoices.find((v) => v.name === selectedAlertSpeechVoiceName.value)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
    utterance_cache.push(utterance)
    utterance.onend = function () {
      delete utterance_cache[utterance_cache.indexOf(utterance)]
    }
    utterance.onerror = function (event) {
      console.error(`SpeechSynthesisUtterance error: ${event.error}`)
    }
    synth.speak(utterance)
  }

  watch(alerts, () => {
    const lastAlert = alerts.slice(-1)[0]
    const alertLevelEnabled = enabledAlertLevels.value.find((enabledAlert) => enabledAlert.level === lastAlert.level)
    if (alertLevelEnabled === undefined || !enableVoiceAlerts.value || !alertLevelEnabled.enabled) return
    speak(lastAlert.level)
    speak(lastAlert.message)
  })

  return {
    alerts,
    enableVoiceAlerts,
    enabledAlertLevels,
    selectedAlertSpeechVoiceName,
    availableAlertSpeechVoiceNames,
    sortedAlerts,
    pushAlert,
  }
})
