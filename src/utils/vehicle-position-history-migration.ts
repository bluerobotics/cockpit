import type { WaypointCoordinates } from '@/types/mission'

// Where versions before the IndexedDB storage kept the whole history, as one JSON array.
const legacyVehiclePositionHistoryKey = 'cockpit-vehicle-position-history'

const isCoordinate = (value: unknown): value is WaypointCoordinates =>
  Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v))

/**
 * Reads the history stored by previous versions. The key is left untouched, so downgrading still finds it.
 * @returns {WaypointCoordinates[] | null} The valid stored points, or null when there are none or they are unreadable
 */
export const readLegacyVehiclePositionHistory = (): WaypointCoordinates[] | null => {
  try {
    const stored = localStorage.getItem(legacyVehiclePositionHistoryKey)
    if (stored === null) return null
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter(isCoordinate) : null
  } catch (error) {
    console.error('Could not read the vehicle position history stored by a previous version.', error)
    return null
  }
}

/**
 * Empties the history stored by previous versions, so downgrading after a clear does not bring the trail back.
 */
export const clearLegacyVehiclePositionHistory = (): void => {
  try {
    if (localStorage.getItem(legacyVehiclePositionHistoryKey) !== null) {
      localStorage.setItem(legacyVehiclePositionHistoryKey, '[]')
    }
  } catch (error) {
    console.error('Could not clear the vehicle position history stored by a previous version.', error)
  }
}
