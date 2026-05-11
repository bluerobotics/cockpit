import { IndexedDbStore } from '@/libs/indexed-db-store'

/**
 * Distances a vehicle has traveled, in meters.
 */
export interface VehicleOdometers {
  /**
   * Distance across the vehicle's whole history
   */
  totalMeters: number
  /**
   * Distance since the current mission started from its first waypoint
   */
  missionMeters: number
}

const db = new IndexedDbStore({
  name: 'Cockpit - Vehicle Odometers',
  storeName: 'cockpit-vehicle-odometers',
  description: 'Distances traveled by each vehicle, keyed by vehicle id.',
})

const isDistance = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/**
 * @param {string} vehicleId - Id of the vehicle the odometers belong to
 * @returns {Promise<VehicleOdometers | null>} The stored odometers, or null when none valid were stored yet
 */
export const loadVehicleOdometers = async (vehicleId: string): Promise<VehicleOdometers | null> => {
  const stored = await db.getItem<Record<string, unknown>>(vehicleId)
  const totalMeters = stored?.totalMeters
  const missionMeters = stored?.missionMeters
  if (!isDistance(totalMeters) || !isDistance(missionMeters)) return null
  return { totalMeters, missionMeters }
}

/**
 * @param {string} vehicleId - Id of the vehicle the odometers belong to
 * @param {VehicleOdometers} odometers - The odometers to store
 */
export const saveVehicleOdometers = async (vehicleId: string, odometers: VehicleOdometers): Promise<void> => {
  await db.setItem(vehicleId, odometers)
}
