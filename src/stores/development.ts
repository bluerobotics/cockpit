import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { defaultShareHardwareDetails, shareHardwareDetailsKey } from '@/libs/external-telemetry/event-tracking'
import { settingsManager } from '@/libs/settings-management'

export const systemLoggingEnablingKey = 'cockpit-enable-system-logging'
export const blueOsSettingsSyncEnablingKey = 'cockpit-enable-blueos-settings-sync'
export const showSplashScreenOnStartupKey = 'cockpit-show-splash-screen-on-startup'

export const useDevelopmentStore = defineStore('development', () => {
  const developmentMode = ref(false)
  const widgetDevInfoBlurLevel = ref(3)
  const enableSystemLogging = useBlueOsStorage(systemLoggingEnablingKey, true)
  const enableBlueOsSettingsSync = useStorage(blueOsSettingsSyncEnablingKey, true)
  const showSplashScreenOnStartup = useStorage(showSplashScreenOnStartupKey, true)

  const shareHardwareDetails = ref<boolean>(
    settingsManager.getKeyValue<boolean>(shareHardwareDetailsKey) ?? defaultShareHardwareDetails
  )
  watch(shareHardwareDetails, (newValue) => {
    settingsManager.setKeyValue(shareHardwareDetailsKey, newValue, Date.now())
  })
  settingsManager.registerListener(shareHardwareDetailsKey, (newSetting) => {
    const newValue = newSetting.value as boolean
    if (newValue !== shareHardwareDetails.value) shareHardwareDetails.value = newValue
  })

  return {
    developmentMode,
    widgetDevInfoBlurLevel,
    enableSystemLogging,
    enableBlueOsSettingsSync,
    shareHardwareDetails,
    showSplashScreenOnStartup,
  }
})
