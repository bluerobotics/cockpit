import { type DataSourceOptionKeys, type DataSourcePreset } from '@/libs/data-sources/source-options'

export const headingSourceOptions: DataSourcePreset[] = [
  { title: 'attitude.yaw', value: '/mavlink/{{autopilotSystemId}}/1/ATTITUDE/yaw' },
  { title: 'global_position_int.hdg', value: '/mavlink/{{autopilotSystemId}}/1/GLOBAL_POSITION_INT/hdg' },
]

/** Default heading source for map widgets (attitude.yaw). */
export const defaultHeadingVariableId = headingSourceOptions[0].value

/** Where the compass widgets store their heading source. */
export const headingDataSource: DataSourceOptionKeys = {
  variableIdKey: 'yawVariableId',
  useCustomVariableKey: 'useCustomYawVariable',
  presets: headingSourceOptions,
}
