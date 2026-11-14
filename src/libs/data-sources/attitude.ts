import { type DataSourceOptionKeys, type DataSourcePreset } from '@/libs/data-sources/source-options'

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
