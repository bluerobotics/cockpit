import { defineStore } from 'pinia'
import { watch } from 'vue'

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
    () => alertStore.pushAlert(new Alert(AlertLevel.Info, `Vehicle mode changed to ${vehicleStore.mode}.`))
  )

  watch(
    () => vehicleStore.isArmed,
    (isArmedNow) => {
      const state = isArmedNow ? 'armed' : 'disarmed'
      alertStore.pushAlert(new Alert(AlertLevel.Info, `Vehicle ${state}`))
    }
  )

  watch(
    () => vehicleStore.isVehicleOnline,
    (isOnlineNow) => {
      const alertLevel = isOnlineNow ? AlertLevel.Success : AlertLevel.Error
      const alertMessage = isOnlineNow ? 'connected' : 'disconnected'
      alertStore.pushAlert(new Alert(alertLevel, `Vehicle ${alertMessage}`))
    }
  )
})
