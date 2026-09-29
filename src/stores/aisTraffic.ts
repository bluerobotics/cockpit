import { defineStore } from 'pinia'
import { watch } from 'vue'

import { type AisVessel, parseAisVessel } from '@/libs/ais'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { useMainVehicleStore } from '@/stores/mainVehicle'

// Class A vessels report every few seconds and anchored ones every few minutes, so silence past this
// means the vessel is gone or out of range.
const AIS_STALE_AFTER_MS = 10 * 60 * 1000

export const useAisTrafficStore = defineStore('ais-traffic', () => {
  const vehicleStore = useMainVehicleStore()

  // Deliberately not reactive: a busy harbour reports many times a second, and the map reads it on its own timer.
  const vessels = new Map<number, AisVessel>()

  const onAisVessel = (pack: Package): void => {
    const vessel = parseAisVessel(pack.message as Message.AisVessel, Date.now())
    if (vessel) vessels.set(vessel.mmsi, vessel)
  }

  // The data lake keeps one value per field, so reports from several vessels would overwrite each other there.
  watch(
    () => vehicleStore.mainVehicle,
    (vehicle, previous) => {
      previous?.onIncomingMAVLinkMessage.remove(MAVLinkType.AIS_VESSEL, onAisVessel)
      vessels.clear()
      vehicle?.onIncomingMAVLinkMessage.add(MAVLinkType.AIS_VESSEL, onAisVessel)
    },
    { immediate: true }
  )

  /**
   * Vessels the vehicle's AIS receiver has heard recently, forgetting the ones gone silent.
   * @returns {AisVessel[]} The vessels, one per MMSI.
   */
  const currentVessels = (): AisVessel[] => {
    const now = Date.now()
    vessels.forEach((vessel, mmsi) => {
      if (now - vessel.lastHeardAtMs > AIS_STALE_AFTER_MS) vessels.delete(mmsi)
    })
    return [...vessels.values()]
  }

  return { currentVessels }
})
