/** Minimum shape a data source table entry needs to be matched against a data lake variable ID. */
type VariableIdOption = {
  /** Templated data lake variable ID; resolved at runtime via the mustache system. */
  value: string
}

// Captures the suffix from both templated and concrete preset paths, with or without the leading slash.
const MAVLINK_PATH_PATTERN = /^\/?mavlink\/(?:\d+|\{\{autopilotSystemId\}\})\/\d+\/(.+)$/

const extractSuffix = (variableId: string): string | undefined => variableId.match(MAVLINK_PATH_PATTERN)?.[1]

/**
 * Find the source option a data lake variable ID refers to, comparing message and field rather than the whole
 * path so templated and concrete `/mavlink/N/N/SUFFIX` forms resolve to the same preset.
 * @param {T[]} options - Source options to search.
 * @param {string} variableId - Data lake variable ID, templated or concrete.
 * @returns {T | undefined} The matching preset, or undefined for a custom variable.
 */
export const findSourceOptionForVariableId = <T extends VariableIdOption>(
  options: T[],
  variableId: string
): T | undefined => {
  const suffix = extractSuffix(variableId)
  if (!suffix) return undefined
  return options.find((option) => extractSuffix(option.value) === suffix)
}

/** Data source preset offered in widget config menus. */
export type DataSourcePreset = VariableIdOption & {
  /** User-facing source label. */
  title: string
}

/** Where a widget stores one data source selection, and which presets it can pick from. */
export type DataSourceOptionKeys = {
  /** Option key holding the data lake variable ID (templated for presets, concrete for custom variables). */
  variableIdKey: string
  /** Option key flagging that the user picked a custom data lake variable. */
  useCustomVariableKey: string
  /** Preset sources offered in the config menu; any other variable is custom. */
  presets: DataSourcePreset[]
}

/**
 * Whether a data lake variable ID, templated or concrete, matches one of the given presets.
 * @param {VariableIdOption[]} presets - Preset sources to match against
 * @param {string} variableId - Data lake variable ID
 * @returns {boolean} True if it matches a preset
 */
export const isPresetVariableId = (presets: VariableIdOption[], variableId: string): boolean =>
  findSourceOptionForVariableId(presets, variableId) !== undefined

/**
 * Merge persisted widget options with defaults and flag each source holding a non-preset variable as custom.
 * @param {T} defaultOptions - Default widget options
 * @param {Partial<T>} persistedOptions - Persisted widget options
 * @param {DataSourceOptionKeys[]} sources - Data sources stored in the options
 * @returns {T} Merged widget options
 */
export const mergeDataSourceOptions = <T extends object>(
  defaultOptions: T,
  persistedOptions: Partial<T>,
  sources: DataSourceOptionKeys[]
): T => {
  const merged = { ...defaultOptions, ...persistedOptions } as Record<string, unknown>

  sources.forEach(({ variableIdKey, useCustomVariableKey, presets }) => {
    const variableId = merged[variableIdKey]
    if (typeof variableId === 'string' && variableId && !isPresetVariableId(presets, variableId)) {
      merged[useCustomVariableKey] = true
    }
  })

  return merged as T
}
