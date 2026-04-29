import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'

/**
 * Vehicle types the mission planner can plan against, with their user-facing labels.
 * Single source for both the planner's "Planning for" selector and the library modal's
 * vehicle-type label rendering, so the two stay in sync.
 */
export const PLANNABLE_VEHICLE_TYPES: ReadonlyArray<{
  /** Human-readable label shown in the UI. */
  label: string
  /** Underlying MavType value persisted with the mission. */
  value: MavType
}> = [
  { label: 'Surface Boat', value: MavType.MAV_TYPE_SURFACE_BOAT },
  { label: 'Submarine', value: MavType.MAV_TYPE_SUBMARINE },
  { label: 'UAV', value: MavType.MAV_TYPE_QUADROTOR },
  { label: 'Ground Rover', value: MavType.MAV_TYPE_GROUND_ROVER },
]

const PLANNABLE_VEHICLE_TYPE_LABELS: Partial<Record<MavType, string>> = Object.fromEntries(
  PLANNABLE_VEHICLE_TYPES.map(({ label, value }) => [value, label])
)

/**
 * Resolves a user-facing label for a stored mission's vehicle type.
 * Falls through to a humanised MavType name so legacy missions still display something readable.
 * @param {MavType | undefined} type - The MavType value persisted with the mission.
 * @returns {string} The label to render, or 'Any' when no type was captured.
 */
export const vehicleTypeLabel = (type?: MavType): string => {
  if (!type) return 'Any'
  return (
    PLANNABLE_VEHICLE_TYPE_LABELS[type] ??
    String(type)
      .replace('MAV_TYPE_', '')
      .toLowerCase()
      .replace(/(^|_)([a-z])/g, (_m, _p1, c) => ` ${c.toUpperCase()}`)
      .trim()
  )
}
