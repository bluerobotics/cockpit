import localforage from 'localforage'
import { t } from 'ttag'

import type { WaypointCoordinates } from '@/types/mission'

import type { TerrainVehicleClass } from './mission-profile'

/**
 * Measurements of the ground or seabed that fell in one cell.
 */
export interface MeasuredCell {
  /**
   * Sum of the measured heights, meters above sea level.
   */
  sum: number
  /**
   * Sum of their squares, for the spread.
   */
  sumSquares: number
  /**
   * Number of measurements.
   */
  count: number
  /**
   * Time of the latest measurement, in milliseconds since the epoch.
   */
  lastMs: number
}

/**
 * Measured cells, keyed by {@link measuredCellKey}.
 */
export type MeasuredTerrain = Map<string, MeasuredCell>

/**
 * What a downward rangefinder or sonar reading needs to become a ground height.
 */
export interface RangeReading {
  /**
   * How the vehicle meets the terrain.
   */
  vehicleClass: TerrainVehicleClass
  /**
   * Vehicle altitude above sea level, in meters; ignored for vessels, which sit on the water.
   */
  vehicleAmslM: number
  /**
   * Measured range to the ground or seabed, in meters.
   */
  rangeM: number
  /**
   * Vehicle roll, in radians.
   */
  rollRad: number
  /**
   * Vehicle pitch, in radians.
   */
  pitchRad: number
  /**
   * Water surface height.
   */
  waterLevelM: number
  /**
   * Depth of the sonar below the waterline, for vessels.
   */
  transducerDepthM: number
}

// About 11 m north to south, close to the model's own resolution and coarse enough to average GPS noise.
export const CELL_DEG = 0.0001
// A single reading can be a fish, a wave or a bird, so a cell only counts once it has a few.
export const MIN_TRUSTED_COUNT = 3

const measuredDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Measured Terrain',
  storeName: 'cockpit-measured-terrain',
  version: 1.0,
  description: 'Ground and bottom heights measured by the vehicle.',
})
const STORAGE_KEY = 'cells-v1'

/**
 * Key of the cell holding a position.
 * @param {WaypointCoordinates} coordinates Position.
 * @returns {string} The cell key.
 */
export const measuredCellKey = ([lat, lng]: WaypointCoordinates): string =>
  `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`

/**
 * Center of a cell.
 * @param {string} key Cell key.
 * @returns {WaypointCoordinates} The center as [latitude, longitude].
 */
export const measuredCellCenter = (key: string): WaypointCoordinates => {
  const [row, column] = key.split(':').map(Number)
  return [(row + 0.5) * CELL_DEG, (column + 0.5) * CELL_DEG]
}

/**
 * Turns a downward range reading into the height of the ground or seabed under the vehicle.
 * @param {RangeReading} reading The reading and the vehicle state.
 * @returns {number | null} Height above sea level, or null when the reading cannot be used.
 */
export const groundFromRange = (reading: RangeReading): number | null => {
  const { vehicleClass, rangeM, rollRad, pitchRad } = reading
  // Past this tilt the beam no longer points at the ground under the vehicle.
  if (!(rangeM > 0) || Math.abs(rollRad) > 0.35 || Math.abs(pitchRad) > 0.35) return null
  const vertical = rangeM * Math.cos(rollRad) * Math.cos(pitchRad)
  if (vehicleClass === 'surface') return reading.waterLevelM - reading.transducerDepthM - vertical
  if (vehicleClass === 'ground') return null
  return reading.vehicleAmslM - vertical
}

/**
 * Adds one measurement.
 * @param {MeasuredTerrain} terrain Cells to add to.
 * @param {WaypointCoordinates} coordinates Where it was measured.
 * @param {number} heightM Measured height above sea level.
 * @param {number} timeMs When it was measured.
 */
export const addMeasurement = (
  terrain: MeasuredTerrain,
  coordinates: WaypointCoordinates,
  heightM: number,
  timeMs: number
): void => {
  const key = measuredCellKey(coordinates)
  const cell = terrain.get(key) ?? { sum: 0, sumSquares: 0, count: 0, lastMs: 0 }
  cell.sum += heightM
  cell.sumSquares += heightM * heightM
  cell.count += 1
  cell.lastMs = timeMs
  terrain.set(key, cell)
}

/**
 * Adds another set of cells to the measured ones, so an imported dataset counts as measurements of its own.
 * @param {MeasuredTerrain} target Cells to add to, changed in place.
 * @param {MeasuredTerrain} incoming Cells to add.
 */
export const mergeMeasuredTerrain = (target: MeasuredTerrain, incoming: MeasuredTerrain): void => {
  // ponytail: importing the same dataset twice weighs it twice; track imported dataset ids to drop repeats.
  incoming.forEach((cell, key) => {
    const existing = target.get(key)
    if (!existing) {
      target.set(key, { ...cell })
      return
    }
    existing.sum += cell.sum
    existing.sumSquares += cell.sumSquares
    existing.count += cell.count
    existing.lastMs = Math.max(existing.lastMs, cell.lastMs)
  })
}

/**
 * Mean measured height of a cell, once it holds enough measurements to trust.
 * @param {MeasuredTerrain} terrain Measured cells.
 * @param {WaypointCoordinates} coordinates Position to read.
 * @returns {number | null} The mean, or null when the cell is not measured well enough.
 */
export const measuredHeightAt = (terrain: MeasuredTerrain, coordinates: WaypointCoordinates): number | null => {
  const cell = terrain.get(measuredCellKey(coordinates))
  return cell && cell.count >= MIN_TRUSTED_COUNT ? cell.sum / cell.count : null
}

/**
 * Spread of a cell's measurements.
 * @param {MeasuredCell} cell Cell to read.
 * @returns {number} Standard deviation in meters.
 */
export const measuredSpreadM = ({ sum, sumSquares, count }: MeasuredCell): number =>
  count < 2 ? 0 : Math.sqrt(Math.max(0, sumSquares / count - (sum / count) ** 2))

/**
 * Cells measured well enough to trust.
 * @param {MeasuredTerrain} terrain Measured cells.
 * @returns {[string, MeasuredCell][]} Their keys and contents.
 */
export const trustedCells = (terrain: MeasuredTerrain): [string, MeasuredCell][] =>
  [...terrain].filter(([, cell]) => cell.count >= MIN_TRUSTED_COUNT)

/**
 * Whether any cell is measured well enough to trust.
 * @param {MeasuredTerrain} terrain Measured cells.
 * @returns {boolean} True once a cell holds enough measurements.
 */
export const hasTrustedCells = (terrain: MeasuredTerrain): boolean => {
  for (const cell of terrain.values()) if (cell.count >= MIN_TRUSTED_COUNT) return true
  return false
}

/**
 * What a measured cell shows the operator: the depth under a vessel, the ground height otherwise.
 * @param {MeasuredCell} cell Cell to describe.
 * @param {TerrainVehicleClass} vehicleClass How the vehicle meets the terrain.
 * @param {number} waterLevelM Water surface height, to report depths against.
 * @returns {string} One line with the value and how many readings it averages.
 */
export const measuredCellLabel = (
  cell: MeasuredCell,
  vehicleClass: TerrainVehicleClass,
  waterLevelM: number
): string => {
  const height = cell.sum / cell.count
  const depthM = Math.max(0, waterLevelM - height).toFixed(1)
  const heightM = height.toFixed(1)
  return vehicleClass === 'surface'
    ? t`Measured depth ${depthM} m, from ${cell.count} readings`
    : t`Measured ground ${heightM} m above sea level, from ${cell.count} readings`
}

/**
 * Median difference between measurements and the model, positive when the real ground is higher.
 * @param {number[]} measuredM Measured heights.
 * @param {(number | null)[]} modelM Model heights at the same places.
 * @returns {number | null} The median offset, or null with nothing to compare.
 */
export const medianOffsetM = (measuredM: number[], modelM: (number | null)[]): number | null => {
  const offsets = measuredM.flatMap((measured, index) => (modelM[index] === null ? [] : [measured - modelM[index]!]))
  if (offsets.length === 0) return null
  offsets.sort((a, b) => a - b)
  const middle = Math.floor(offsets.length / 2)
  return offsets.length % 2 ? offsets[middle] : (offsets[middle - 1] + offsets[middle]) / 2
}

/**
 * Measured cells as CSV, one row per trusted cell, for bathymetry or ground survey archives.
 * @param {MeasuredTerrain} terrain Measured cells.
 * @param {number} waterLevelM Water surface height, to report depths against.
 * @returns {string} CSV text with a header row.
 */
export const measuredTerrainCsv = (terrain: MeasuredTerrain, waterLevelM: number): string => {
  const rows = trustedCells(terrain).map(([key, cell]) => {
    const [lat, lng] = measuredCellCenter(key)
    const height = cell.sum / cell.count
    const depth = Math.max(0, waterLevelM - height)
    const time = new Date(cell.lastMs).toISOString()
    return [
      lat.toFixed(6),
      lng.toFixed(6),
      height.toFixed(2),
      depth.toFixed(2),
      cell.count,
      measuredSpreadM(cell).toFixed(2),
      time,
    ].join(',')
  })
  return ['latitude,longitude,height_m,depth_m,samples,spread_m,last_measured_utc', ...rows].join('\n')
}

/**
 * Loads the measured cells kept on this computer.
 * @returns {Promise<MeasuredTerrain | null>} The cells, empty when none are kept, or null when they
 * cannot be read, so the caller does not save over them.
 */
export const loadMeasuredTerrain = async (): Promise<MeasuredTerrain | null> => {
  try {
    const stored = await measuredDB.getItem<[string, MeasuredCell][]>(STORAGE_KEY)
    if (stored === null) return new Map()
    return Array.isArray(stored) ? new Map(stored) : null
  } catch (error) {
    console.warn('Could not read the measured terrain:', error)
    return null
  }
}

/**
 * Keeps the measured cells on this computer.
 * @param {MeasuredTerrain} terrain Cells to keep.
 * @returns {Promise<void>}
 */
export const saveMeasuredTerrain = async (terrain: MeasuredTerrain): Promise<void> => {
  await measuredDB.setItem(STORAGE_KEY, [...terrain])
}
