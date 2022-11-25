import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { degrees } from '@/libs/utils'
import { useAlertStore } from '@/stores/alert'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { Alert, AlertLevel } from '@/types/alert'

export const useVehicleAlerterStore = defineStore('vehicle-alerter', () => {
  const vehicleStore = useMainVehicleStore()
  const alertStore = useAlertStore()

  const pitchDegreeLimit = ref(30)

  watch(
    () => vehicleStore.isArmed,
    (isArmedNow) => {
      const state = isArmedNow ? 'armed' : 'disarmed'
      alertStore.pushAlert(new Alert(AlertLevel.Info, `Vehicle ${state}`))
    }
  )

  let lastPitch = 0
  watch(vehicleStore.attitude, (newAttitude) => {
    if (degrees(Math.abs(newAttitude.pitch - lastPitch)) < 0.1) return
    lastPitch = newAttitude.pitch

    const pitchDegrees = degrees(newAttitude.pitch)
    const parsedPitch = pitchDegrees.toFixed(2)
    if (pitchDegrees < -pitchDegreeLimit.value) {
      alertStore.pushAlert(
        new Alert(AlertLevel.Critical, `Pitch too low (${parsedPitch})`)
      )
    }
    if (pitchDegrees > pitchDegreeLimit.value) {
      alertStore.pushAlert(
        new Alert(AlertLevel.Critical, `Pitch too high (${parsedPitch})`)
      )
    }
  })
})
