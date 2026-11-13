import { type DataSourceOptionKeys, type DataSourcePreset } from '@/libs/data-sources/source-options'

/** Altitude source options exposed to widget config menus. */
export const altitudeSourceOptions: DataSourcePreset[] = [
  {
    title: 'ahrs2.alt',
    value: '/mavlink/{{autopilotSystemId}}/1/AHRS2/altitude',
  },
  {
    title: 'vfr_hud.alt',
    value: '/mavlink/{{autopilotSystemId}}/1/VFR_HUD/alt',
  },
  {
    title: 'global_position_int.alt',
    value: '/mavlink/{{autopilotSystemId}}/1/GLOBAL_POSITION_INT/alt',
  },
  {
    title: 'global_position_int.relative_alt',
    value: '/mavlink/{{autopilotSystemId}}/1/GLOBAL_POSITION_INT/relative_alt',
  },
]

/** Default altitude source for depth widgets (ahrs2.alt). */
export const defaultDepthAltitudeVariableId = altitudeSourceOptions[0].value

/** Default altitude source for altitude indicators (global_position_int.relative_alt). */
export const defaultAltitudeIndicatorVariableId = altitudeSourceOptions[3].value

/** Where the altitude widgets store their altitude source. */
export const altitudeDataSource: DataSourceOptionKeys = {
  variableIdKey: 'altitudeVariableId',
  useCustomVariableKey: 'useCustomAltitudeVariable',
  presets: altitudeSourceOptions,
}
