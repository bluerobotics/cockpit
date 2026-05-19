/** Altitude source entry for widgets that read MAVLink altitude fields. */
export type AltitudeSourceOption = {
  /** User-facing source label shown in widget config menus. */
  title: string
  /** Templated data lake variable ID; resolved at runtime via the mustache system. */
  value: string
  /** Converts the raw data lake altitude value to meters. */
  toMeters: (rawAltitude: number) => number
}

/** Altitude source options exposed to widget config menus. */
export const altitudeSourceOptions: AltitudeSourceOption[] = [
  {
    title: 'ahrs2.alt',
    value: '/mavlink/{{autopilotSystemId}}/1/AHRS2/altitude',
    toMeters: (rawAltitude) => rawAltitude,
  },
  {
    title: 'vfr_hud.alt',
    value: '/mavlink/{{autopilotSystemId}}/1/VFR_HUD/alt',
    toMeters: (rawAltitude) => rawAltitude,
  },
  {
    title: 'global_position_int.alt',
    value: '/mavlink/{{autopilotSystemId}}/1/GLOBAL_POSITION_INT/alt',
    toMeters: (rawAltitude) => rawAltitude / 1000,
  },
  {
    title: 'global_position_int.relative_alt',
    value: '/mavlink/{{autopilotSystemId}}/1/GLOBAL_POSITION_INT/relative_alt',
    toMeters: (rawAltitude) => rawAltitude / 1000,
  },
]

/** Default altitude source for depth widgets (ahrs2.alt). */
export const defaultDepthAltitudeVariableId = altitudeSourceOptions[0].value

/** Default altitude source for altitude indicators (global_position_int.alt). */
export const defaultAltitudeIndicatorVariableId = altitudeSourceOptions[2].value

// Captures the suffix from both templated and concrete preset paths.
const ALTITUDE_PATH_PATTERN = /^\/mavlink\/(?:\d+|\{\{autopilotSystemId\}\})\/\d+\/(.+)$/

const extractAltitudeSuffix = (variableId: string): string | undefined => variableId.match(ALTITUDE_PATH_PATTERN)?.[1]

const findOptionForVariableId = (variableId: string): AltitudeSourceOption | undefined => {
  const suffix = extractAltitudeSuffix(variableId)
  if (!suffix) return undefined
  return altitudeSourceOptions.find((option) => extractAltitudeSuffix(option.value) === suffix)
}

/**
 * Whether the given variable ID matches a known altitude source preset
 * (templated form or a concrete /mavlink/N/N/SUFFIX path).
 * @param {string} altitudeVariableId - Data lake variable ID or template
 * @returns {boolean} True if it matches a preset
 */
export const isPresetAltitudeVariableId = (altitudeVariableId: string): boolean =>
  findOptionForVariableId(altitudeVariableId) !== undefined

/**
 * Migrate a legacy concrete preset path (e.g. '/mavlink/1/1/AHRS2/altitude')
 * to its templated counterpart so the widget keeps following the connected
 * autopilot's system ID. Templated values and custom variable IDs pass through.
 * @param {string} altitudeVariableId - Persisted data lake variable ID
 * @returns {string} The templated variable ID (or the input unchanged)
 */
export const migrateAltitudeVariableId = (altitudeVariableId: string): string => {
  const option = findOptionForVariableId(altitudeVariableId)
  return option ? option.value : altitudeVariableId
}

/**
 * Convert a raw altitude value from the selected altitude source to meters.
 * Accepts either the templated or the concrete data lake variable ID.
 * @param {string} altitudeVariableId - Data lake variable ID for the altitude source
 * @param {number} rawAltitude - Raw altitude value from the data lake
 * @returns {number} Altitude in meters
 */
export const rawAltitudeToMeters = (altitudeVariableId: string, rawAltitude: number): number => {
  const option = findOptionForVariableId(altitudeVariableId)
  return option ? option.toMeters(rawAltitude) : rawAltitude
}
