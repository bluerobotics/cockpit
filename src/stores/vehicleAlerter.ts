import { defineStore } from 'pinia'
import { t } from 'ttag'
import { watch } from 'vue'

import { useAlertStore } from '@/stores/alert'
import { useGeoFenceStore } from '@/stores/geoFence'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { Alert, AlertLevel } from '@/types/alert'

export const useVehicleAlerterStore = defineStore('vehicle-alerter', () => {
  const vehicleStore = useMainVehicleStore()
  const alertStore = useAlertStore()
  const fenceStore = useGeoFenceStore()

  watch(vehicleStore.statusText, () => {
    if (!vehicleStore.statusText.text) return
    alertStore.pushAlert(new Alert(vehicleStore.statusText.severity, vehicleStore.statusText.text))
  })

  watch(
    () => vehicleStore.mode,
    (newMode) => {
      if (newMode === undefined) return
      const modeName = vehicleStore.flightModeDisplayName(newMode)
      alertStore.pushAlert(new Alert(AlertLevel.Info, t`Vehicle mode changed to ${modeName}.`))
    }
  )

  watch(
    () => vehicleStore.isArmed,
    (isArmedNow) => {
      alertStore.pushAlert(new Alert(AlertLevel.Info, isArmedNow ? t`Vehicle armed` : t`Vehicle disarmed`))
    }
  )

  watch(
    () => fenceStore.fenceBreached,
    (breached, wasBreached) => {
      if (breached === true && wasBreached !== true) {
        alertStore.pushAlert(new Alert(AlertLevel.Critical, t`Vehicle is outside the geofence.`))
      } else if (breached === false && wasBreached === true) {
        alertStore.pushAlert(new Alert(AlertLevel.Success, t`Vehicle is back inside the geofence.`))
      }
    }
  )

  watch(
    () => vehicleStore.isVehicleOnline,
    (isOnlineNow) => {
      const alertLevel = isOnlineNow ? AlertLevel.Success : AlertLevel.Error
      alertStore.pushAlert(new Alert(alertLevel, isOnlineNow ? t`Vehicle connected` : t`Vehicle disconnected`))
    }
  )
})
