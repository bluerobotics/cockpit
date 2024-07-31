import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'

import { Alert, AlertLevel } from '../types/alert'

export const useAlertStore = defineStore('alert', () => {
  const alerts = reactive([new Alert(AlertLevel.Success, 'Cockpit started')])
  const enableVoiceAlerts = useBlueOsStorage('cockpit-enable-voice-alerts', true)
  // eslint-disable-next-line jsdoc/require-jsdoc
  const availableAlertSpeechVoices = reactive<SpeechSynthesisVoice[]>([])
  const selectedAlertSpeechVoiceName = useBlueOsStorage<string | undefined>(
    'cockpit-selected-alert-speech-voice',
    undefined
  )
  const enabledAlertLevels = useBlueOsStorage('cockpit-enabled-alert-levels', [
    { level: AlertLevel.Info, enabled: false },
    { level: AlertLevel.Success, enabled: true },
    { level: AlertLevel.Error, enabled: true },
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

  // Alert speech syntesis routine
  const synth = window.speechSynthesis

  // We need to cache these otherwise they get garbage collected...
  const utterance_cache: SpeechSynthesisUtterance[] = []

  // By default we use the platform language over the default speech text,
  // it appears that browsers like chrome fail to have it correctly based on the system.
  // The default speech langauge _should_ be the same as platform language.
  if (synth) {
    synth.onvoiceschanged = () => {
      let default_speech: undefined | string = undefined
      let default_speech_by_language: undefined | string = undefined
      synth.getVoices().forEach((voice) => {
        availableAlertSpeechVoices.push(voice)

        if (voice.default) {
          default_speech = voice.name
        }

        if (voice.lang === navigator.language) {
          default_speech_by_language = voice.name
        }
      })

      if (selectedAlertSpeechVoiceName.value === undefined) {
        if (default_speech_by_language !== undefined) {
          selectedAlertSpeechVoiceName.value = default_speech_by_language
          return
        }

        if (default_speech) {
          selectedAlertSpeechVoiceName.value = default_speech
        }
      }
    }
  }

  const availableAlertSpeechVoiceNames = computed(() =>
    availableAlertSpeechVoices.map((v) => ({ value: v.name, name: `${v.name} (${v.lang})` }))
  )

  /**
   * Speaks a text out loud using the browsers TTS engine
   * @param {string} text string
   */
  function speak(text: string): void {
    if (!synth) {
      console.warn('No speechSynthesis available')
      return
    }
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
    if (
      !enableVoiceAlerts.value ||
      ((alertLevelEnabled === undefined || !alertLevelEnabled.enabled) && !lastAlert.message.startsWith('#'))
    )
      return
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
    pushSuccessAlert,
    pushErrorAlert,
    pushInfoAlert,
    pushWarningAlert,
    pushCriticalAlert,
  }
})
