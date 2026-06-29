import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { defaultShareHardwareDetails, shareHardwareDetailsKey } from '@/libs/external-telemetry/event-tracking'
import { setPerformanceProfilingEnabled } from '@/libs/performance-monitoring'
import { settingsManager } from '@/libs/settings-management'

export const systemLoggingEnablingKey = 'cockpit-enable-system-logging'
export const blueOsSettingsSyncEnablingKey = 'cockpit-enable-blueos-settings-sync'
export const showSplashScreenOnStartupKey = 'cockpit-show-splash-screen-on-startup'
export const performanceProfilingEnablingKey = 'cockpit-enable-performance-profiling'

export const useDevelopmentStore = defineStore('development', () => {
  // Whether the floating console window is open. Kept here (not in a view) so the console stays alive while
  // the user navigates away from the Dev settings menu.
  const showConsole = ref(false)
  const enableSystemLogging = useBlueOsStorage(systemLoggingEnablingKey, true)
  const enableBlueOsSettingsSync = useStorage(blueOsSettingsSyncEnablingKey, true)
  const showSplashScreenOnStartup = useStorage(showSplashScreenOnStartupKey, true)

  // Tier-2 (opt-in) performance instrumentation. Off by default so the more intrusive User Timing
  // and self-profiling hooks only run while a user is actively diagnosing a stall.
  const enablePerformanceProfiling = useStorage(performanceProfilingEnablingKey, false)
  setPerformanceProfilingEnabled(enablePerformanceProfiling.value)
  watch(enablePerformanceProfiling, (newValue) => setPerformanceProfilingEnabled(newValue))

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
    showConsole,
    enableSystemLogging,
    enableBlueOsSettingsSync,
    shareHardwareDetails,
    showSplashScreenOnStartup,
    enablePerformanceProfiling,
  }
})
