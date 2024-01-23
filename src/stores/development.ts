import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'

export const systemLoggingEnablingKey = 'cockpit-enable-system-logging'
export const useDevelopmentStore = defineStore('development', () => {
  const developmentMode = ref(false)
  const widgetDevInfoBlurLevel = ref(3)
  const enableSystemLogging = useBlueOsStorage(systemLoggingEnablingKey, true)

  return { developmentMode, widgetDevInfoBlurLevel, enableSystemLogging }
})
