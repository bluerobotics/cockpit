import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const systemLoggingEnablingKey = 'cockpit-enable-system-logging'
export const useDevelopmentStore = defineStore('development', () => {
  const developmentMode = ref(false)
  const widgetDevInfoBlurLevel = ref(3)
  const enableSystemLogging = useStorage(systemLoggingEnablingKey, true)

  return { developmentMode, widgetDevInfoBlurLevel, enableSystemLogging }
})
