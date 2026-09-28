import type { TransformingFunction } from '@/libs/actions/data-lake-transformations'
import { MavSensorOrientation } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { getUnindentedString } from '@/libs/utils'

/** A DISTANCE_SENSOR distance reading found in the data lake. */
export type RangefinderCandidate = {
  /** Data lake variable ID of the sensor's current distance. */
  variableId: string
  /** Whether the sensor is still publishing readings. */
  isPublishing: boolean
  /** Orientation reported by the sensor, when it is already in the data lake. */
  orientation?: string
}

/** Data lake variables a seafloor depth is derived from. */
export type RangefinderSeafloorDepthSources = {
  /** Data lake variable ID of the downward rangefinder's current distance, in centimeters. */
  rangefinderVariableId: string
  /** Data lake variable ID of the vehicle's altitude, positive up. */
  altitudeVariableId: string
  /** Meters in one unit of the altitude variable. */
  metersPerAltitudeUnit: number
  /** Data lake path of the autopilot's ATTITUDE message, whose roll and pitch tilt the rangefinder. */
  attitudePath: string
}

// Matches the autopilot's own DISTANCE_SENSOR as well as the ones a companion computer driver publishes under its
// own system and component IDs.
const distanceVariableIdPattern = /^\/mavlink\/\d+\/\d+\/DISTANCE_SENSOR\/id=\d+\/current_distance$/

const seafloorDepthVariableIdPrefix = 'seafloor-depth/'

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

/**
 * Whether a data lake variable is a seafloor depth Cockpit derived from a rangefinder, rather than one the user chose.
 * @param {string} variableId - Data lake variable ID
 * @returns {boolean} True when the variable was built by {@link rangefinderSeafloorDepthFunction}
 */
export const isRangefinderSeafloorDepthVariableId = (variableId: string): boolean =>
  variableId.startsWith(seafloorDepthVariableIdPrefix)

/**
 * Compound variable holding the depth of the seafloor, in meters: the vehicle's depth plus the rangefinder distance,
 * projected on the vertical since the sensor tilts with the vehicle. It is not a number while the sensor reports no
 * distance, which is how a lost bottom reads.
 * @param {RangefinderSeafloorDepthSources} sources - Data lake variables the seafloor depth is derived from
 * @returns {TransformingFunction} Transforming function backing the seafloor depth variable
 */
export const rangefinderSeafloorDepthFunction = (sources: RangefinderSeafloorDepthSources): TransformingFunction => {
  const { rangefinderVariableId, altitudeVariableId, metersPerAltitudeUnit, attitudePath } = sources
  const distanceInput = `{{${rangefinderVariableId}}}`
  const altitudeInput = `{{${altitudeVariableId}}}`
  return {
    id: `${seafloorDepthVariableIdPrefix}rangefinder${rangefinderVariableId}/altitude${altitudeVariableId}`,
    name: 'Seafloor Depth [m] (from rangefinder)',
    type: 'number',
    // Inputs are parenthesized as they are substituted by their values, and '-{{x}}' would read '--1'
    expression: getUnindentedString(`
      const distance = (${distanceInput}) / 100
      if (distance <= 0) return NaN
      const verticalDistance = distance * Math.cos({{${attitudePath}/roll}}) * Math.cos({{${attitudePath}/pitch}})
      return -(${altitudeInput}) * ${metersPerAltitudeUnit} + verticalDistance
    `),
    description: `Depth of the seafloor, adding the tilt-corrected ${distanceInput} to the depth from ${altitudeInput}.`,
  }
}
