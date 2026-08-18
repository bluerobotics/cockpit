/** Minimum shape a data source table entry needs to be matched against a data lake variable ID. */
type VariableIdOption = {
  /** Templated data lake variable ID; resolved at runtime via the mustache system. */
  value: string
}

// Captures the suffix from both templated and concrete preset paths.
const MAVLINK_PATH_PATTERN = /^\/mavlink\/(?:\d+|\{\{autopilotSystemId\}\})\/\d+\/(.+)$/

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
