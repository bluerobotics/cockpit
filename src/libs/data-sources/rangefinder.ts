import { MavSensorOrientation } from '@/libs/connection/m2r/messages/mavlink2rest-enum'

/** A DISTANCE_SENSOR distance reading found in the data lake. */
export type RangefinderCandidate = {
  /** Data lake variable ID of the sensor's current distance. */
  variableId: string
  /** Whether the sensor is still publishing readings. */
  isPublishing: boolean
  /** Orientation reported by the sensor, when it is already in the data lake. */
  orientation?: string
}

// Matches the autopilot's own DISTANCE_SENSOR as well as the ones a companion computer driver publishes under its
// own system and component IDs.
const distanceVariableIdPattern = /^\/mavlink\/\d+\/\d+\/DISTANCE_SENSOR\/id=\d+\/current_distance$/

/**
 * Whether a data lake variable holds the current distance of a DISTANCE_SENSOR.
 * @param {string} variableId - Data lake variable ID
 * @returns {boolean} True when the ID is a DISTANCE_SENSOR current distance
 */
export const isRangefinderDistanceVariableId = (variableId: string): boolean =>
  distanceVariableIdPattern.test(variableId)

/**
 * Data lake variable ID of the orientation reported by the sensor behind a given distance variable.
 * @param {string} distanceVariableId - Data lake variable ID of the sensor's current distance
 * @returns {string} Data lake variable ID of the sensor's orientation
 */
export const rangefinderOrientationVariableId = (distanceVariableId: string): string =>
  distanceVariableId.replace(/current_distance$/, 'orientation')

/**
 * Pick which rangefinder measures the bottom. Only a downward-facing sensor qualifies, as one aimed elsewhere
 * reports an obstacle ahead, and no seafloor at all beats a seafloor drawn from the wrong quantity.
 * @param {RangefinderCandidate[]} candidates - Rangefinders found in the data lake
 * @returns {string | undefined} Variable ID of the chosen distance, or undefined when none is measuring the bottom
 */
export const selectRangefinderVariableId = (candidates: RangefinderCandidate[]): string | undefined =>
  candidates.find(
    (candidate) =>
      candidate.isPublishing && candidate.orientation === MavSensorOrientation.MAV_SENSOR_ROTATION_PITCH_270
  )?.variableId
