import { IndexedDbStore } from '@/libs/indexed-db-store'
import type { WaypointCoordinates } from '@/types/mission'

const db = new IndexedDbStore({
  name: 'Cockpit - Vehicle Position History',
  storeName: 'cockpit-vehicle-position-history',
  description: 'Vehicle position history, as packed latitude/longitude pairs.',
})
const historyKey = 'history'

/**
 * @returns {Promise<WaypointCoordinates[] | null>} The stored history, or null when none was stored yet
 */
export const loadVehiclePositionHistory = async (): Promise<WaypointCoordinates[] | null> => {
  const packed = await db.getItem<unknown>(historyKey)
  if (!(packed instanceof Float64Array)) return null
  const points: WaypointCoordinates[] = []
  for (let i = 0; i + 1 < packed.length; i += 2) points.push([packed[i], packed[i + 1]])
  return points
}

/**
 * Stores the whole history in one IndexedDB write, which either fully succeeds or leaves the previous one in place.
 * Packing it into a typed array keeps it out of JSON and makes cloning it into IndexedDB a plain memory copy.
 * @param {WaypointCoordinates[]} points - The history to store
 */
export const saveVehiclePositionHistory = async (points: WaypointCoordinates[]): Promise<void> => {
  // ponytail: rewrites the whole history, ~8 ms at 100k points and ~45 ms at the 500k cap on a 6x throttled CPU;
  // switch to appending fixed-size chunks if that shows up as a stall.
  const packed = new Float64Array(points.length * 2)
  points.forEach(([latitude, longitude], i) => {
    packed[2 * i] = latitude
    packed[2 * i + 1] = longitude
  })
  await db.setItem(historyKey, packed)
}
