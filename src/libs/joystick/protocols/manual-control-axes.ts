import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { round } from '@/libs/utils'
import { getVehicleTypeFromMavType } from '@/libs/vehicle/ardupilot/common'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'

const manualControlAxes = ['x', 'y', 'z', 'r', 's', 't'] as const
type ManualControlAxisValues = Record<(typeof manualControlAxes)[number], number>

// MANUAL_CONTROL marks an axis as invalid with INT16_MAX, so the autopilot releases it instead of reading a value
const INT16_MAX = 32767

/**
 * Read the transformed axis values with the conversion used in outgoing control messages.
 * @param {VehicleType | undefined} vehicleType Connected vehicle type, when known
 * @returns {ManualControlAxisValues} The six rounded control outputs
 */
export const getManualControlAxisValues = (vehicleType?: VehicleType): ManualControlAxisValues =>
  Object.fromEntries(
    manualControlAxes.map((axis) => {
      const rawValue = getDataLakeVariableData(`outputs/mavlink/axis-${axis}`)
      const value = Number(rawValue)
      // Users can modify the inputs arbitrarily, so handle NaN values gracefully.
      // TODO: replace the ArduSub fallbacks with INT16_MAX (ignored) when ArduSub supports it (ArduPilot/ardupilot#32639)
      // ArduSub reads z as 0 to 1000 with 500 as neutral, so 0 would command full down.
      const fallback = vehicleType === VehicleType.Sub ? (axis === 'z' ? 500 : 0) : INT16_MAX
      return [axis, round(Number.isNaN(value) ? fallback : value, 0)]
    })
  ) as ManualControlAxisValues

/**
 * Whether transformed control outputs differ from the supported vehicle's resting controls.
 * @param {MavType | undefined} vehicleType Connected vehicle type, when known
 * @returns {boolean} Whether a known axis differs from its control rest value
 */
export const hasJoystickMotionInput = (vehicleType: MavType | undefined): boolean => {
  const family = vehicleType === undefined ? undefined : getVehicleTypeFromMavType(vehicleType)
  const verticalRest = family === undefined ? undefined : family === VehicleType.Rover ? 0 : 500
  return Object.entries(getManualControlAxisValues(family)).some(([axis, output]) => {
    if (axis === 'z' && verticalRest === undefined) return false
    // ArduSub does not yet support the standard ignored-axis sentinel.
    const ignored = output === INT16_MAX && family !== VehicleType.Sub
    return Number.isFinite(output) && !ignored && output !== (axis === 'z' ? verticalRest : 0)
  })
}
