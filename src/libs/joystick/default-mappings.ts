import { cockpitStandardToProtocols, defaultProtocolMappingVehicleCorrespondency } from '@/assets/joystick-profiles'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { AxisCorrespondence, JoystickProtocolActionsMapping } from '@/types/joystick'

/**
 * The joystick mapping Cockpit ships for a vehicle type.
 * @param {MavType} vehicleType - The vehicle's type
 * @returns {JoystickProtocolActionsMapping | undefined} The default mapping, or undefined when the type has none
 */
export const getDefaultMapping = (vehicleType: MavType): JoystickProtocolActionsMapping | undefined => {
  // @ts-ignore: We know that the value is a string
  const hash = defaultProtocolMappingVehicleCorrespondency[vehicleType]
  return cockpitStandardToProtocols.find((m) => m.hash === hash)
}

/**
 * Finds the vehicle-type default axis mapping for a function, wherever the default puts it.
 * @param {MavType} vehicleType - The vehicle's type
 * @param {string} actionId - The axis function id
 * @returns {AxisCorrespondence | undefined} The default correspondence, or undefined when the vehicle has none for it
 */
export const getDefaultAxisCorrespondence = (
  vehicleType: MavType,
  actionId: string
): AxisCorrespondence | undefined => {
  const defaultMapping = getDefaultMapping(vehicleType)
  if (!defaultMapping) return undefined
  return Object.values(defaultMapping.axesCorrespondencies).find((corr) => corr.action.id === actionId)
}

/** Ways an axis range can make the vehicle misbehave */
export type AxisRangeIssue = 'off-center' | 'beyond-limits'

/**
 * Compares an axis range with the default for the same function. Swapped endpoints are a user preference (like
 * reversed scrolling) and a narrower range only limits the gain, so neither is an issue.
 * @param {Pick<AxisCorrespondence, 'min' | 'max'>} range - The user's axis range
 * @param {Pick<AxisCorrespondence, 'min' | 'max'>} defaultRange - The default range for the same function
 * @returns {AxisRangeIssue[]} 'off-center' when the stick at rest commands movement, and 'beyond-limits' when the
 * range reaches values past the default ones, which the vehicle may ignore
 */
export const findAxisRangeIssues = (
  range: Pick<AxisCorrespondence, 'min' | 'max'>,
  defaultRange: Pick<AxisCorrespondence, 'min' | 'max'>
): AxisRangeIssue[] => {
  const issues: AxisRangeIssue[] = []
  if (range.min + range.max !== defaultRange.min + defaultRange.max) issues.push('off-center')
  const reachesPastLow = Math.min(range.min, range.max) < Math.min(defaultRange.min, defaultRange.max)
  const reachesPastHigh = Math.max(range.min, range.max) > Math.max(defaultRange.min, defaultRange.max)
  if (reachesPastLow || reachesPastHigh) issues.push('beyond-limits')
  return issues
}

/**
 * Which endpoints of an axis range differ from both default endpoints, so a reversed axis is not flagged.
 * @param {Pick<AxisCorrespondence, 'min' | 'max'>} range - The user's axis range
 * @param {Pick<AxisCorrespondence, 'min' | 'max'>} defaultRange - The default range for the same function
 * @returns {('min' | 'max')[]} The endpoints matching neither default endpoint
 */
export const findOffDefaultAxisEndpoints = (
  range: Pick<AxisCorrespondence, 'min' | 'max'>,
  defaultRange: Pick<AxisCorrespondence, 'min' | 'max'>
): ('min' | 'max')[] =>
  (['min', 'max'] as const).filter(
    (endpoint) => range[endpoint] !== defaultRange.min && range[endpoint] !== defaultRange.max
  )
