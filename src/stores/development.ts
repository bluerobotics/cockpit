import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'

export const systemLoggingEnablingKey = 'cockpit-enable-system-logging'
export const blueOsSettingsSyncEnablingKey = 'cockpit-enable-system-logging'

export const useDevelopmentStore = defineStore('development', () => {
  const developmentMode = ref(false)
  const widgetDevInfoBlurLevel = ref(3)
  const enableSystemLogging = useBlueOsStorage(systemLoggingEnablingKey, true)
  const enableBlueOsSettingsSync = useStorage(blueOsSettingsSyncEnablingKey, false)

  return { developmentMode, widgetDevInfoBlurLevel, enableSystemLogging, enableBlueOsSettingsSync }
})
