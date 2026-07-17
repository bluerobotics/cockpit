import { findSourceOptionForVariableId } from '@/libs/data-sources/source-options'
import { degrees } from '@/libs/utils'

type HeadingSourceOption = {
  /** Templated data lake variable ID; resolved at runtime via the mustache system. */
  value: string
  /** Converts the raw data lake heading value to degrees. */
  toDegrees: (rawHeading: number) => number
}

// Heading sources whose raw value is not already in degrees.
const headingSourceOptions: HeadingSourceOption[] = [
  { value: '/mavlink/{{autopilotSystemId}}/1/ATTITUDE/yaw', toDegrees: degrees },
  { value: '/mavlink/{{autopilotSystemId}}/1/GLOBAL_POSITION_INT/hdg', toDegrees: (rawHeading) => rawHeading / 100 },
]

/** Default heading source for map widgets (attitude.yaw). */
export const defaultHeadingVariableId = headingSourceOptions[0].value

/**
 * Convert a raw heading value from the selected heading source to degrees.
 * Accepts either the templated or the concrete data lake variable ID. Sources outside the preset list are
 * assumed to already be in degrees and pass through unchanged.
 * @param {string} headingVariableId - Data lake variable ID for the heading source
 * @param {number} rawHeading - Raw heading value from the data lake
 * @returns {number} Heading in degrees
 */
export const rawHeadingToDegrees = (headingVariableId: string, rawHeading: number): number => {
  const option = findSourceOptionForVariableId(headingSourceOptions, headingVariableId)
  return option ? option.toDegrees(rawHeading) : rawHeading
}
