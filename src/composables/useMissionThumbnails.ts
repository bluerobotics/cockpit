import { type VehicleFileMeta, createVehicleFileStorage } from '@/composables/useVehicleFileStorage'

// Singleton so every call site shares the same reactive cache. The SVG bytes are cached in IndexedDB
// and synced to the vehicle as real files; only the `{ id, createdAt }` index rides in settings.
const thumbnailStorage = createVehicleFileStorage<VehicleFileMeta>({
  settingsKey: 'cockpit-mission-thumbnails-v1',
  indexedDbStoreName: 'cockpit-mission-thumbnails',
  vehicleSubfolder: 'mission-thumbnails',
  mimeType: 'image/svg+xml',
  fileExtension: 'svg',
})

/**
 * Reactive API for the saved missions' thumbnail bytes, synced to the vehicle via BlueOS.
 */
export interface MissionThumbnailsApi {
  /**
   * Resolves a saved mission's thumbnail to a renderable URL.
   * @param {string} missionId - The saved mission's id.
   * @returns {string | undefined} The thumbnail's `blob:` object URL (must not be persisted), or `undefined` if its bytes aren't cached yet.
   */
  urlFor: (missionId: string) => string | undefined
  /**
   * Stores (creating or overwriting) a mission's thumbnail.
   * @param {string} missionId - The saved mission's id.
   * @param {string} svg - The thumbnail's raw SVG markup.
   * @returns {Promise<void>} Resolves once the local write has been attempted; failures are logged, not thrown.
   */
  setThumbnail: (missionId: string, svg: string) => Promise<void>
  /**
   * Removes a mission's thumbnail.
   * @param {string} missionId - The saved mission's id.
   * @returns {Promise<void>} Resolves once the local removal has been attempted; failures are logged, not thrown.
   */
  removeThumbnail: (missionId: string) => Promise<void>
}

/**
 * Provides reactive access to the saved missions' thumbnails, kept local-first in IndexedDB and synced
 * to the vehicle's File Browser so they are shared across control stations without bloating the settings.
 * @returns {MissionThumbnailsApi} Thumbnail URL resolver plus set/remove helpers.
 */
export function useMissionThumbnails(): MissionThumbnailsApi {
  const setThumbnail = async (missionId: string, svg: string): Promise<void> => {
    // Preserve the original creation time when re-saving an existing mission's thumbnail.
    const createdAt = thumbnailStorage.entries.value.find((entry) => entry.id === missionId)?.createdAt ?? Date.now()
    // Callers fire-and-forget, so swallow local-write failures here instead of leaking a rejection.
    try {
      await thumbnailStorage.add({ id: missionId, createdAt }, svg)
    } catch (error) {
      console.error(`Could not store thumbnail for mission '${missionId}'. ${error}`)
    }
  }

  const removeThumbnail = async (missionId: string): Promise<void> => {
    try {
      await thumbnailStorage.remove(missionId)
    } catch (error) {
      console.error(`Could not remove thumbnail for mission '${missionId}'. ${error}`)
    }
  }

  return {
    urlFor: thumbnailStorage.urlFor,
    setThumbnail,
    removeThumbnail,
  }
}
