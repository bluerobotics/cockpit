import {
  type DataSourceOptionKeys,
  type DataSourcePreset,
  isPresetVariableId,
} from '@/libs/data-sources/source-options'
import { degrees } from '@/libs/utils'

// Every preset reports radians.
export const rollSourceOptions: DataSourcePreset[] = [
  { title: 'attitude.roll', value: '/mavlink/{{autopilotSystemId}}/1/ATTITUDE/roll' },
  { title: 'ahrs2.roll', value: '/mavlink/{{autopilotSystemId}}/1/AHRS2/roll' },
  { title: 'ahrs3.roll', value: '/mavlink/{{autopilotSystemId}}/1/AHRS3/roll' },
  { title: 'simstate.roll', value: '/mavlink/{{autopilotSystemId}}/1/SIMSTATE/roll' },
]

export const pitchSourceOptions: DataSourcePreset[] = [
  { title: 'attitude.pitch', value: '/mavlink/{{autopilotSystemId}}/1/ATTITUDE/pitch' },
  { title: 'ahrs2.pitch', value: '/mavlink/{{autopilotSystemId}}/1/AHRS2/pitch' },
  { title: 'ahrs3.pitch', value: '/mavlink/{{autopilotSystemId}}/1/AHRS3/pitch' },
  { title: 'simstate.pitch', value: '/mavlink/{{autopilotSystemId}}/1/SIMSTATE/pitch' },
]

/** Default roll source for attitude widgets (attitude.roll). */
export const defaultRollVariableId = rollSourceOptions[0].value

/** Default pitch source for attitude widgets (attitude.pitch). */
export const defaultPitchVariableId = pitchSourceOptions[0].value

/** Where the attitude widgets store their roll source. */
export const rollDataSource: DataSourceOptionKeys = {
  variableIdKey: 'rollVariableId',
  useCustomVariableKey: 'useCustomRollVariable',
  presets: rollSourceOptions,
}

/** Where the attitude widgets store their pitch source. */
export const pitchDataSource: DataSourceOptionKeys = {
  variableIdKey: 'pitchVariableId',
  useCustomVariableKey: 'useCustomPitchVariable',
  presets: pitchSourceOptions,
}

/**
 * Convert a raw roll or pitch value from the selected source to degrees.
 * Accepts either the templated or the concrete data lake variable ID. Custom (non-preset) variables are assumed
 * to already be in degrees and pass through unchanged.
 * @param {DataSourceOptionKeys} source - Roll or pitch data source
 * @param {string} variableId - Data lake variable ID of the selected source
 * @param {number} rawAngle - Raw angle from the data lake
 * @returns {number} Angle in degrees
 */
export const rawAttitudeToDegrees = (source: DataSourceOptionKeys, variableId: string, rawAngle: number): number =>
  isPresetVariableId(source.presets, variableId) ? degrees(rawAngle) : rawAngle
