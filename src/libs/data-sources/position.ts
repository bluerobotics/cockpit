import { findSourceOptionForVariableId } from '@/libs/data-sources/source-options'

type PositionSourceOption = {
  /** Templated data lake variable ID; resolved at runtime via the mustache system. */
  value: string
  /** Converts the raw data lake coordinate value to decimal degrees. */
  toDegrees: (rawCoordinate: number) => number
}

const degE7ToDegrees = (rawCoordinate: number): number => rawCoordinate / 1e7

// Coordinate sources whose raw value is not already in decimal degrees.
const positionSourceOptions: PositionSourceOption[] = [
  { value: '/mavlink/{{autopilotSystemId}}/1/GLOBAL_POSITION_INT/lat', toDegrees: degE7ToDegrees },
  { value: '/mavlink/{{autopilotSystemId}}/1/GLOBAL_POSITION_INT/lon', toDegrees: degE7ToDegrees },
  { value: '/mavlink/{{autopilotSystemId}}/1/GPS_RAW_INT/lat', toDegrees: degE7ToDegrees },
  { value: '/mavlink/{{autopilotSystemId}}/1/GPS_RAW_INT/lon', toDegrees: degE7ToDegrees },
]

/** Default latitude source for map widgets (global_position_int.lat). */
export const defaultLatitudeVariableId = positionSourceOptions[0].value

/** Default longitude source for map widgets (global_position_int.lon). */
export const defaultLongitudeVariableId = positionSourceOptions[1].value

/**
 * Convert a raw coordinate value from the selected position source to decimal degrees.
 * Accepts either the templated or the concrete data lake variable ID. Sources outside the preset list are
 * assumed to already be in decimal degrees and pass through unchanged.
 * @param {string} positionVariableId - Data lake variable ID for the coordinate source
 * @param {number} rawCoordinate - Raw coordinate value from the data lake
 * @returns {number} Coordinate in decimal degrees
 */
export const rawCoordinateToDegrees = (positionVariableId: string, rawCoordinate: number): number => {
  const option = findSourceOptionForVariableId(positionSourceOptions, positionVariableId)
  return option ? option.toDegrees(rawCoordinate) : rawCoordinate
}
