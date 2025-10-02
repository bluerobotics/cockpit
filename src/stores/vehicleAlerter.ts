import { defineStore } from 'pinia'
import { watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { listenDataLakeVariable } from '@/libs/actions/data-lake'
import { blueOsVariables } from '@/libs/blueos/definitions'
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

  // BlueOS alerts
  const blueOsAlertsConfig = useBlueOsStorage('cockpit-blueos-alerts-config', {
    'cpu-temperature': { enabled: true, minInterval: 60000, threshold: 85, level: AlertLevel.Warning },
    'cpu-usage': { enabled: true, minInterval: 60000, threshold: 80, level: AlertLevel.Warning },
  })

  // BlueOS CPU Temperature Alert
  let lastBlueOsCpuTemperatureAlertTimestamp = 0
  listenDataLakeVariable(blueOsVariables.cpuTemp.id, (data) => {
    const tempConfig = blueOsAlertsConfig.value['cpu-temperature']
    const thresholdExceeded = Number(data) > tempConfig.threshold
    const minIntervalReached = Date.now() - lastBlueOsCpuTemperatureAlertTimestamp >= tempConfig.minInterval
    if (tempConfig.enabled && thresholdExceeded && minIntervalReached) {
      alertStore.pushAlert(new Alert(tempConfig.level, `BlueOS CPU Temperature threshold exceeded: ${data} °C`))
      lastBlueOsCpuTemperatureAlertTimestamp = Date.now()
    }
  })

  // BlueOS CPU Usage Alert
  let lastBlueOsCpuUsageAlertTimestamp = 0
  listenDataLakeVariable(blueOsVariables.cpuUsageAverage.id, (data) => {
    const usageConfig = blueOsAlertsConfig.value['cpu-usage']
    const thresholdExceeded = Number(data) > usageConfig.threshold
    const minIntervalReached = Date.now() - lastBlueOsCpuUsageAlertTimestamp >= usageConfig.minInterval
    if (usageConfig.enabled && thresholdExceeded && minIntervalReached) {
      alertStore.pushAlert(new Alert(usageConfig.level, `BlueOS CPU Usage threshold exceeded: ${data} %`))
      lastBlueOsCpuUsageAlertTimestamp = Date.now()
    }
  })

  return {
    blueOsAlertsConfig,
  }
})
