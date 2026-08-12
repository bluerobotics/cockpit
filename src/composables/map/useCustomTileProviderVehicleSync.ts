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
  // Every reconnect retries a failed upload, so the operator is told about each provider once per session
  // instead of on every attempt.
  const reportedFailureIds = new Set<string>()
  let failedNames: string[] = []

  const uploadPendingOnce = async (vehicleAddress: string): Promise<number> => {
    const skippedIds = new Set<string>()
    let synced = 0
    while (vehicleStore.isVehicleOnline) {
      const next = missionStore.customTileProviders.find(
        (provider) => provider.type === 'file' && provider.pendingVehicleSync && !skippedIds.has(provider.id)
      )
      if (!next) break
      try {
        const uploaded = await syncTileProviderToVehicle(next, vehicleAddress)
        // The provider list is vehicle-synced, so a pending entry imported on another topside computer arrives
        // here without its archive. That computer owns the upload; leave the flag for it to clear.
        if (!uploaded) {
          skippedIds.add(next.id)
          continue
        }
        missionStore.updateCustomTileProvider(next.id, { pendingVehicleSync: false })
        synced += 1
      } catch (error) {
        // Keep other pending providers moving; a failed one is retried on the next connect or import.
        skippedIds.add(next.id)
        if (!reportedFailureIds.has(next.id)) {
          reportedFailureIds.add(next.id)
          failedNames.push(next.name)
        }
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
    failedNames = []
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

    if (failedNames.length > 0) {
      const names = failedNames.map((name) => `"${name}"`).join(', ')
      const plural = failedNames.length > 1 ? 's' : ''
      const message = `Could not upload the ${names} map${plural} to the vehicle. Cockpit will try again on the next connection, and meanwhile ${
        plural ? 'they stay' : 'it stays'
      } available on this computer only.`
      openSnackbar({ message, variant: 'error', duration: 6000 })
    }
  }

  // Both watchers fire and forget, so a rejection has to be caught here rather than reaching the window.
  const runSync = (): void => {
    syncPendingProviders().catch((error) => console.error('Failed to sync custom map providers to the vehicle:', error))
  }

  watch(
    () => vehicleStore.isVehicleOnline,
    (isOnline) => {
      if (isOnline) runSync()
    },
    { immediate: true }
  )
  watch(
    () =>
      missionStore.customTileProviders.filter((provider) => provider.type === 'file' && provider.pendingVehicleSync)
        .length,
    (pendingCount) => {
      if (pendingCount > 0) runSync()
    }
  )
}
