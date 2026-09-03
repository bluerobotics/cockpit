import { type ProtocolAction, JoystickProtocol } from '@/types/joystick'

// Inverse of 1.19's migrateMavlinkManualControlAxes: that version persisted these data-lake ids
// and 1.18 still drives MANUAL_CONTROL from the MAVLink axis actions.
const dataLakeManualControlAxisById: Record<string, string> = {
  'inputs/mavlink/axis-x': 'axis_x',
  'inputs/mavlink/axis-y': 'axis_y',
  'inputs/mavlink/axis-z': 'axis_z',
  'inputs/mavlink/axis-r': 'axis_r',
  'inputs/mavlink/axis-s': 'axis_s',
  'inputs/mavlink/axis-t': 'axis_t',
}

/**
 * MANUAL_CONTROL axis id this action should drive, including 1.19 data-lake bindings.
 * @param {ProtocolAction} action - Axis action from the stored mapping
 * @returns {string | undefined} `axis_x`…`axis_t`, or undefined if this is not a MANUAL_CONTROL axis
 */
export const manualControlAxisId = (action: ProtocolAction): string | undefined => {
  if (action.protocol === JoystickProtocol.MAVLinkManualControl) return action.id
  if (action.protocol === JoystickProtocol.DataLakeVariable) return dataLakeManualControlAxisById[action.id]
}

/**
 * Label for a 1.19 data-lake MANUAL_CONTROL binding. Display-only — do not write this back.
 * @param {ProtocolAction} action - Axis action from the stored mapping
 * @returns {string | undefined} `MAVLink Axis X`…`T` when this is a 1.19 alias, otherwise undefined
 */
export const manualControlAxisDisplayName = (action: ProtocolAction): string | undefined => {
  if (action.protocol !== JoystickProtocol.DataLakeVariable) return
  const id = dataLakeManualControlAxisById[action.id]
  if (!id) return
  return `MAVLink Axis ${id.slice(-1).toUpperCase()}`
}
