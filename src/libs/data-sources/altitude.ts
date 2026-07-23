/** Altitude source entry for widgets that read MAVLink altitude fields. */
export type AltitudeSourceOption = {
  /** User-facing source label shown in widget config menus. */
  title: string
  /** Data lake variable ID the widget subscribes to (templated MAVLink path or compound-variable ID). */
  value: string
  /** Converts the raw data lake value to meters. */
  toMeters: (rawValue: number) => number
  /** Legacy MAVLink path suffixes to migrate to this option (e.g. `SCALED_PRESSURE2/press_abs`). */
  legacyMatchSuffixes?: string[]
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
  {
    title: 'baro2.pressure_alt',
    value: 'baro2.pressure_alt',
    toMeters: (rawAltitude) => rawAltitude,
    legacyMatchSuffixes: ['SCALED_PRESSURE2/press_abs'],
  },
  {
    title: 'baro3.pressure_alt',
    value: 'baro3.pressure_alt',
    toMeters: (rawAltitude) => rawAltitude,
    legacyMatchSuffixes: ['SCALED_PRESSURE3/press_abs'],
  },
]

/** Default altitude source for depth widgets (ahrs2.alt). */
export const defaultDepthAltitudeVariableId = altitudeSourceOptions[0].value

/** Default altitude source for altitude indicators (global_position_int.relative_alt). */
export const defaultAltitudeIndicatorVariableId = altitudeSourceOptions[3].value

// Captures the suffix from both templated and concrete preset paths.
const ALTITUDE_PATH_PATTERN = /^\/mavlink\/(?:\d+|\{\{autopilotSystemId\}\})\/\d+\/(.+)$/

const extractAltitudeSuffix = (variableId: string): string | undefined => variableId.match(ALTITUDE_PATH_PATTERN)?.[1]

const findOptionForVariableId = (variableId: string): AltitudeSourceOption | undefined => {
  const exactMatch = altitudeSourceOptions.find((option) => option.value === variableId)
  if (exactMatch) return exactMatch

  const suffix = extractAltitudeSuffix(variableId)
  if (!suffix) return undefined
  return altitudeSourceOptions.find((option) => {
    if (extractAltitudeSuffix(option.value) === suffix) return true
    return option.legacyMatchSuffixes?.includes(suffix) ?? false
  })
}

/**
 * Whether the given variable ID matches a known altitude source preset
 * (compound variable ID, templated form, or a concrete /mavlink/N/N/SUFFIX path).
 * @param {string} altitudeVariableId - Data lake variable ID or template
 * @returns {boolean} True if it matches a preset
 */
export const isPresetAltitudeVariableId = (altitudeVariableId: string): boolean =>
  findOptionForVariableId(altitudeVariableId) !== undefined

/**
 * Migrate a legacy persisted variable ID to the current preset value:
 * concrete `/mavlink/N/N/...` paths are rewritten to their templated form,
 * and retired raw paths (e.g. `SCALED_PRESSURE2/press_abs`) are pointed at
 * the equivalent predefined compound variable. Anything that already matches
 * a preset (or is a fully custom variable) is returned unchanged.
 * @param {string} altitudeVariableId - Persisted data lake variable ID
 * @returns {string} The current preset variable ID (or the input unchanged)
 */
export const migrateAltitudeVariableId = (altitudeVariableId: string): string => {
  const option = findOptionForVariableId(altitudeVariableId)
  return option ? option.value : altitudeVariableId
}

/**
 * Convert a raw data-lake value from the selected altitude source to meters.
 * Accepts either the templated or the concrete data lake variable ID. Custom
 * (non-preset) variables are assumed to already be in meters and pass through unchanged.
 * @param {string} altitudeVariableId - Data lake variable ID for the altitude source
 * @param {number} rawAltitude - Raw value from the data lake
 * @returns {number} Altitude in meters
 */
export const rawAltitudeToMeters = (altitudeVariableId: string, rawAltitude: number): number => {
  const option = findOptionForVariableId(altitudeVariableId)
  return option ? option.toMeters(rawAltitude) : rawAltitude
}
