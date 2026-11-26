import { useEventListener } from '@vueuse/core'
import { msgid, ngettext, t } from 'ttag'
import { watch } from 'vue'

import { closeSnackbar, openSnackbar } from '@/composables/snackbar'
import { deleteFileFromVehicle, listVehicleFiles } from '@/libs/blueos-files'
import {
  removedTileArchiveFileNames,
  syncTileProviderToVehicle,
  tileArchiveFileName,
  tileProviderSubfolder,
} from '@/libs/map/tile-provider-import'
import { cachedTileArchiveIds, getCachedTileArchive } from '@/libs/map/tile-provider-storage'
import { isBlueOsSettingsSyncEnabled } from '@/libs/settings-management'
import { formatBytes } from '@/libs/utils'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'
import type { CustomTileProviderMeta } from '@/types/mission'

/**
 * App-level orchestration that uploads custom tile-provider archives imported while offline to the vehicle once
 * it is online, and the archives this computer holds that the connected vehicle lacks, since the provider list is
 * shared by every vehicle of the user. Runs after each settings sync with the vehicle, and whenever a new offline
 * import is added while already connected. Intended to be called once at app scope.
 */
export const useCustomTileProviderVehicleSync = (): void => {
  const missionStore = useMissionStore()
  const vehicleStore = useMainVehicleStore()

  let syncing = false
  let rerunRequested = false
  // Set from the upload snackbar and cleared when the vehicle reconnects, so a Stop holds for the whole connection.
  let uploadsStopped = false
  let uploadAnnouncementId: number | undefined
  // Every reconnect retries a failed upload, so the operator is told about each provider once per session
  // instead of on every attempt.
  const reportedFailureIds = new Set<string>()
  let failedNames: string[] = []

  const needsUpload = (provider: CustomTileProviderMeta, vehicleFiles?: Set<string>): boolean =>
    provider.type === 'file' &&
    (provider.pendingVehicleSync || (vehicleFiles !== undefined && !vehicleFiles.has(tileArchiveFileName(provider))))

  // The announcement stays open while uploads run, so its Stop action is available until they end.
  const announceUploads = async (vehicleFiles?: Set<string>): Promise<void> => {
    const cachedIds = new Set(await cachedTileArchiveIds())
    const toUpload = missionStore.customTileProviders.filter(
      (provider) => cachedIds.has(provider.id) && needsUpload(provider, vehicleFiles)
    )
    if (toUpload.length === 0) return
    const archives = await Promise.all(toUpload.map((provider) => getCachedTileArchive(provider.id)))
    const size = formatBytes(archives.reduce((total, archive) => total + (archive?.size ?? 0), 0))
    const count = toUpload.length
    uploadAnnouncementId = openSnackbar({
      message: ngettext(
        msgid`Uploading ${count} map archive (${size}) to the vehicle.`,
        `Uploading ${count} map archives (${size}) to the vehicle.`,
        count
      ),
      variant: 'info',
      persistent: true,
      action: {
        label: t`Stop`,
        handler: () => {
          uploadsStopped = true
          logUserAction('Stopped the map archive uploads to the vehicle')
          const message = t`The remaining map archives will be uploaded the next time the vehicle connects.`
          openSnackbar({ message, variant: 'info', duration: 4000 })
        },
      },
    })
  }

  // Archives removed on this computer are deleted from each vehicle still holding a copy, unless a provider uses it.
  const deleteRemovedArchives = async (vehicleAddress: string, vehicleFiles: Set<string>): Promise<void> => {
    const inUse = new Set(
      missionStore.customTileProviders
        .filter((provider) => provider.type === 'file')
        .map((provider) => tileArchiveFileName(provider))
    )
    const stale = removedTileArchiveFileNames().filter((name) => vehicleFiles.has(name) && !inUse.has(name))
    for (const name of stale) {
      await deleteFileFromVehicle(vehicleAddress, tileProviderSubfolder, name)
        .then(() => vehicleFiles.delete(name))
        .catch((error) => console.warn(`Could not delete the removed map archive ${name} from the vehicle:`, error))
    }
  }

  const uploadPendingOnce = async (vehicleAddress: string, vehicleFiles?: Set<string>): Promise<number> => {
    const skippedIds = new Set<string>()
    let synced = 0
    while (vehicleStore.isVehicleOnline && !uploadsStopped) {
      const next = missionStore.customTileProviders.find(
        (provider) => needsUpload(provider, vehicleFiles) && !skippedIds.has(provider.id)
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
        vehicleFiles?.add(tileArchiveFileName(next))
        if (next.pendingVehicleSync) missionStore.updateCustomTileProvider(next.id, { pendingVehicleSync: false })
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
    // Pending archives stay pending with the sync off, so they upload once it is turned back on.
    if (!vehicleAddress || !vehicleStore.isVehicleOnline || !isBlueOsSettingsSyncEnabled()) return
    const hasFileProviders = missionStore.customTileProviders.some((provider) => provider.type === 'file')
    if (!hasFileProviders && removedTileArchiveFileNames().length === 0) return

    syncing = true
    let synced = 0
    failedNames = []
    try {
      // Without a listing, only archives never uploaded anywhere are sent, rather than every archive this computer holds.
      const vehicleFiles = await listVehicleFiles(vehicleAddress, tileProviderSubfolder)
        .then((names) => new Set(names))
        .catch((error) => {
          console.warn('Could not list the map archives on the vehicle. Uploading only new ones:', error)
          return undefined
        })
      if (vehicleFiles !== undefined) await deleteRemovedArchives(vehicleAddress, vehicleFiles)
      await announceUploads(vehicleFiles)
      do {
        rerunRequested = false
        synced += await uploadPendingOnce(vehicleAddress, vehicleFiles)
      } while (rerunRequested && vehicleStore.isVehicleOnline)
    } finally {
      syncing = false
      if (uploadAnnouncementId !== undefined) closeSnackbar(uploadAnnouncementId)
      uploadAnnouncementId = undefined
    }

    if (synced > 0) {
      openSnackbar({
        message: ngettext(
          msgid`${synced} custom map provider synced to the vehicle.`,
          `${synced} custom map providers synced to the vehicle.`,
          synced
        ),
        variant: 'success',
        duration: 3000,
      })
    }

    if (failedNames.length > 0) {
      const names = failedNames.map((name) => `"${name}"`).join(', ')
      const message = ngettext(
        msgid`Could not upload the ${names} map to the vehicle. Cockpit will try again on the next connection, and meanwhile it stays available on this computer only.`,
        `Could not upload the ${names} maps to the vehicle. Cockpit will try again on the next connection, and meanwhile they stay available on this computer only.`,
        failedNames.length
      )
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
      if (isOnline) uploadsStopped = false
    }
  )
  // Waits for the settings sync, so the provider list is already merged with the vehicle's before archives are
  // uploaded or deleted.
  useEventListener(window, 'vehicle-sync-complete', runSync)
  watch(
    () =>
      missionStore.customTileProviders.filter((provider) => provider.type === 'file' && provider.pendingVehicleSync)
        .length,
    (pendingCount) => {
      if (pendingCount > 0) runSync()
    }
  )
}
