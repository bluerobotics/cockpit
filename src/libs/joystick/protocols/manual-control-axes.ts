import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { round } from '@/libs/utils'
import { getVehicleTypeFromMavType } from '@/libs/vehicle/ardupilot/common'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'

const manualControlAxes = ['x', 'y', 'z', 'r', 's', 't'] as const
type ManualControlAxisValues = Record<(typeof manualControlAxes)[number], number>

/**
 * Read the transformed axis values with the conversion used in outgoing control messages.
 * @returns {ManualControlAxisValues} The six rounded control outputs
 */
export const getManualControlAxisValues = (): ManualControlAxisValues =>
  Object.fromEntries(
    manualControlAxes.map((axis) => {
      const value = Number(getDataLakeVariableData(`outputs/mavlink/axis-${axis}`) ?? 0)
      // Users can modify the inputs arbitrarily, so handle NaN values gracefully.
      // TODO: replace fallback value (0) with INT16_MAX (ignored) when ArduSub supports it (ArduPilot/ardupilot#32639)
      return [axis, round(Number.isNaN(value) ? 0 : value, 0)]
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
  return Object.entries(getManualControlAxisValues()).some(([axis, output]) => {
    if (axis === 'z' && verticalRest === undefined) return false
    // ArduSub does not yet support the standard ignored-axis sentinel.
    const ignored = output === 32767 && family !== VehicleType.Sub
    return Number.isFinite(output) && !ignored && output !== (axis === 'z' ? verticalRest : 0)
  })
}
