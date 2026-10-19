import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { defaultShareHardwareDetails, shareHardwareDetailsKey } from '@/libs/external-telemetry/event-tracking'
import { blueOsSettingsSyncEnablingKey, settingsManager } from '@/libs/settings-management'

export const systemLoggingEnablingKey = 'cockpit-enable-system-logging'
export const showSplashScreenOnStartupKey = 'cockpit-show-splash-screen-on-startup'

export const useDevelopmentStore = defineStore('development', () => {
  // Whether the floating console window is open. Kept here (not in a view) so the console stays alive while
  // the user navigates away from the Dev settings menu.
  const showConsole = ref(false)
  const enableSystemLogging = useBlueOsStorage(systemLoggingEnablingKey, true)
  const enableBlueOsSettingsSync = useStorage(blueOsSettingsSyncEnablingKey, true)
  const showSplashScreenOnStartup = useStorage(showSplashScreenOnStartupKey, true)

  // The switch did nothing for a while, so a computer where it was turned off long ago is told once per session.
  let syncOffNoticeShown = false
  window.addEventListener('vehicle-sync-complete', () => {
    if (enableBlueOsSettingsSync.value || syncOffNoticeShown) return
    syncOffNoticeShown = true
    openSnackbar({
      message:
        'BlueOS settings sync is off on this computer, so settings are not shared through the vehicle. ' +
        'It can be turned back on in Settings > Dev.',
      variant: 'info',
      duration: 8000,
    })
  })

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
  }
})
