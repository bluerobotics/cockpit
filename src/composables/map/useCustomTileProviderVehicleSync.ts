import { watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { syncTileProviderToVehicle } from '@/libs/map/tile-provider-import'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

/**
 * App-level orchestration that uploads custom tile-provider archives imported while offline to the vehicle once
 * it is online. Watches vehicle connectivity and the pending-provider count, draining pending uploads on connect
 * and whenever a new offline import is added while already connected. Intended to be called once at app scope.
 */
export const useCustomTileProviderVehicleSync = (): void => {
  const missionStore = useMissionStore()
  const vehicleStore = useMainVehicleStore()

  let syncing = false
  let rerunRequested = false

  const uploadPendingOnce = async (vehicleAddress: string): Promise<number> => {
    const failedIds = new Set<string>()
    let synced = 0
    while (vehicleStore.isVehicleOnline) {
      const next = missionStore.customTileProviders.find(
        (provider) => provider.type === 'file' && provider.pendingVehicleSync && !failedIds.has(provider.id)
      )
      if (!next) break
      try {
        await syncTileProviderToVehicle(next, vehicleAddress)
        missionStore.updateCustomTileProvider(next.id, { pendingVehicleSync: false })
        synced += 1
      } catch (error) {
        // Keep other pending providers moving; a failed one is retried on the next connect or import.
        failedIds.add(next.id)
        console.error(`Failed to sync custom map provider "${next.name}" to the vehicle:`, error)
      }
    }
    return synced
  }

  const syncPendingProviders = async (): Promise<void> => {
    if (syncing) {
      rerunRequested = true
      return
    }
    const vehicleAddress = vehicleStore.globalAddress
    if (!vehicleAddress || !vehicleStore.isVehicleOnline) return
    const hasPending = missionStore.customTileProviders.some(
      (provider) => provider.type === 'file' && provider.pendingVehicleSync
    )
    if (!hasPending) return

    syncing = true
    let synced = 0
    try {
      do {
        rerunRequested = false
        synced += await uploadPendingOnce(vehicleAddress)
      } while (rerunRequested && vehicleStore.isVehicleOnline)
    } finally {
      syncing = false
    }

    if (synced > 0) {
      const plural = synced > 1 ? 's' : ''
      openSnackbar({
        message: `${synced} custom map provider${plural} synced to the vehicle.`,
        variant: 'success',
        duration: 3000,
      })
    }
  }

  watch(
    () => vehicleStore.isVehicleOnline,
    (isOnline) => {
      if (isOnline) syncPendingProviders()
    },
    { immediate: true }
  )
  watch(
    () =>
      missionStore.customTileProviders.filter((provider) => provider.type === 'file' && provider.pendingVehicleSync)
        .length,
    (pendingCount) => {
      if (pendingCount > 0) syncPendingProviders()
    }
  )
}
