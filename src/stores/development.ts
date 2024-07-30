import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'

export const systemLoggingEnablingKey = 'cockpit-enable-system-logging'
export const blueOsSettingsSyncEnablingKey = 'cockpit-enable-blueos-settings-sync'
export const enableUsageStatisticsTelemetryKey = 'cockpit-enable-usage-statistics-telemetry'

export const useDevelopmentStore = defineStore('development', () => {
  const developmentMode = ref(false)
  const widgetDevInfoBlurLevel = ref(3)
  const enableSystemLogging = useBlueOsStorage(systemLoggingEnablingKey, true)
  const enableBlueOsSettingsSync = useStorage(blueOsSettingsSyncEnablingKey, true)
  const enableUsageStatisticsTelemetry = useStorage(enableUsageStatisticsTelemetryKey, true)

  return {
    developmentMode,
    widgetDevInfoBlurLevel,
    enableSystemLogging,
    enableBlueOsSettingsSync,
    enableUsageStatisticsTelemetry,
  }
})
