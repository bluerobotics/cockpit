import { defineStore } from 'pinia'
import { watch } from 'vue'

import i18n from '@/plugins/i18n'
import { useAlertStore } from '@/stores/alert'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { Alert, AlertLevel } from '@/types/alert'

export const useVehicleAlerterStore = defineStore('vehicle-alerter', () => {
  const vehicleStore = useMainVehicleStore()
  const alertStore = useAlertStore()

  watch(vehicleStore.statusText, () => {
    if (!vehicleStore.statusText.text) return
    alertStore.pushAlert(new Alert(vehicleStore.statusText.severity, vehicleStore.statusText.text))
  })

  watch(
    () => vehicleStore.mode,
    () =>
      alertStore.pushAlert(
        new Alert(AlertLevel.Info, i18n.global.t('stores.mainVehicle.modeChanged', { mode: vehicleStore.mode }))
      )
  )

  watch(
    () => vehicleStore.isArmed,
    (isArmedNow) => {
      const state = isArmedNow ? 'armed' : 'disarmed'
      alertStore.pushAlert(new Alert(AlertLevel.Info, i18n.global.t(`vehicle.${state}`)))
    }
  )

  watch(
    () => vehicleStore.isVehicleOnline,
    (isOnlineNow) => {
      const alertLevel = isOnlineNow ? AlertLevel.Success : AlertLevel.Error
      const alertMessage = isOnlineNow ? 'connected' : 'disconnected'
      alertStore.pushAlert(new Alert(alertLevel, i18n.global.t(`vehicle.${alertMessage}`)))
    }
  )
})
