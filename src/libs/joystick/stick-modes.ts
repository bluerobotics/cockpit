import {
  cockpitStandardToProtocols,
  defaultBoatMappingHash,
  defaultMavMappingHash,
  defaultRovMappingHash,
} from '@/assets/joystick-profiles'
import { otherAvailableActions } from '@/libs/joystick/protocols/other'
import { joystickInputAxes } from '@/libs/joystick/protocols/predefined-resources'
import { Type as VehicleType } from '@/libs/vehicle/vehicle'
import { type JoystickAxisActionCorrespondency, type ProtocolAction, JoystickAxis } from '@/types/joystick'

/**
 * The stick layouts that RC transmitters, QGroundControl and other ground stations call "modes".
 */
export enum StickMode {
  Mode1 = 1,
  Mode2 = 2,
  Mode3 = 3,
  Mode4 = 4,
}

const stickFunctions = ['axis_x', 'axis_y', 'axis_z', 'axis_r'] as const

type StickFunction = (typeof stickFunctions)[number]

const rcNames: Record<StickFunction, string> = {
  axis_x: 'Pitch',
  axis_y: 'Roll',
  axis_z: 'Throttle',
  axis_r: 'Yaw',
}

// Each layout lists the function on the left horizontal, left vertical, right horizontal and right vertical stick
// axis, which is the order Cockpit numbers them in as A0 to A3.
const stickModeLayouts: Record<StickMode, StickFunction[]> = {
  [StickMode.Mode1]: ['axis_r', 'axis_x', 'axis_y', 'axis_z'],
  [StickMode.Mode2]: ['axis_r', 'axis_z', 'axis_y', 'axis_x'],
  [StickMode.Mode3]: ['axis_y', 'axis_x', 'axis_r', 'axis_z'],
  [StickMode.Mode4]: ['axis_y', 'axis_z', 'axis_r', 'axis_x'],
}

export const stickModes = [StickMode.Mode1, StickMode.Mode2, StickMode.Mode3, StickMode.Mode4]

/**
 * The axes each physical stick is made of, in the order the layouts above are written in.
 */
export const stickAxes = [
  { name: 'Left', horizontal: JoystickAxis.A0, vertical: JoystickAxis.A1 },
  { name: 'Right', horizontal: JoystickAxis.A2, vertical: JoystickAxis.A3 },
]

const stickSlots = stickAxes.flatMap((stick) => [stick.horizontal, stick.vertical])

// A gamepad's vertical stick axes read negative when pushed up, so they hold an inverted range on every mapping
// Cockpit ships. Only used for an axis that is not flying a stick function today, whose range says nothing about
// how the stick reads.
const invertedByDefault = [JoystickAxis.A1, JoystickAxis.A3]

const defaultProfileHashes: Partial<Record<VehicleType, string>> = {
  [VehicleType.Sub]: defaultRovMappingHash,
  [VehicleType.Copter]: defaultMavMappingHash,
  [VehicleType.Rover]: defaultBoatMappingHash,
}

// Span to fall back to with no vehicle to read one from. A sub and a drone take MANUAL_CONTROL.z as 0 to 1000 with 500
// at rest, so the throttle is the one that cannot be symmetric: centering the stick would command full descend.
const offlineFunctionSpans: Record<StickFunction, [number, number]> = {
  axis_x: [-1000, 1000],
  axis_y: [-1000, 1000],
  axis_z: [0, 1000],
  axis_r: [-1000, 1000],
}

const functionOf = (action?: ProtocolAction): StickFunction | undefined =>
  stickFunctions.find((stickFunction) => joystickInputAxes[stickFunction].id === action?.id)

const spanOf = (axis: JoystickAxisActionCorrespondency[number]): [number, number] => [
  Math.min(axis.min, axis.max),
  Math.max(axis.min, axis.max),
]

// The span a function carries belongs to the vehicle reading it rather than to the function: a boat throttle spans the
// full range so it can reverse where a sub's spans 0 to 1000. The shipped profiles already record that, so read it from
// them instead of restating it here.
const defaultSpan = (stickFunction: StickFunction, vehicleType?: VehicleType): [number, number] => {
  const hash = vehicleType === undefined ? undefined : defaultProfileHashes[vehicleType]
  const profile = cockpitStandardToProtocols.find((mapping) => mapping.hash === hash)
  const source = Object.values(profile?.axesCorrespondencies ?? {}).find(
    (axis) => functionOf(axis.action) === stickFunction
  )
  return source === undefined ? offlineFunctionSpans[stickFunction] : spanOf(source)
}

/**
 * Reads the RC name of a stick function, for the four axis functions an RC mode is defined over.
 * @param {ProtocolAction} action - Action assigned to a stick axis.
 * @returns {string | undefined} 'Pitch', 'Roll', 'Throttle' or 'Yaw', or undefined for anything else.
 */
export const rcFunctionName = (action?: ProtocolAction): string | undefined => {
  const stickFunction = functionOf(action)
  return stickFunction === undefined ? undefined : rcNames[stickFunction]
}

// Each firmware reads the manual-control axes its own way, so the same stick drives a different motion on each
// vehicle. Taken from the handlers themselves: ArduSub/joystick.cpp, Rover/GCS_MAVLink_Rover.cpp and
// ArduCopter/GCS_MAVLink_Copter.cpp. A rover only reads two of them, so the other two do nothing on a boat.
const vehicleMotionNames: Partial<Record<VehicleType, Partial<Record<StickFunction, string>>>> = {
  [VehicleType.Sub]: {
    axis_x: 'Forward/back',
    axis_y: 'Left/right',
    axis_z: 'Up/down',
    axis_r: 'Turn left/right',
  },
  [VehicleType.Copter]: {
    axis_x: 'Forward/back',
    axis_y: 'Left/right',
    axis_z: 'Up/down',
    axis_r: 'Turn left/right',
  },
  [VehicleType.Rover]: {
    axis_y: 'Turn left/right',
    axis_z: 'Forward/back',
  },
}

/**
 * Tells whether Cockpit knows how a vehicle reads the manual-control axes, and so can name the motions they command.
 * @param {VehicleType} vehicleType - Vehicle to check.
 * @returns {boolean} True when that vehicle has motion names for the stick functions.
 */
export const hasVehicleMotionNames = (vehicleType?: VehicleType): boolean =>
  vehicleType !== undefined && vehicleMotionNames[vehicleType] !== undefined

/**
 * Reads the motion a stick function commands on a given vehicle, rather than the RC name of the function itself.
 * @param {ProtocolAction} action - Action assigned to a stick axis.
 * @param {VehicleType} vehicleType - Vehicle the action would be flying.
 * @returns {string | undefined} The motion it commands, 'Not used' when that vehicle ignores the axis, or undefined
 * when the action is not a stick function or the vehicle is not one Cockpit knows the manual-control handling of.
 */
export const vehicleMotionName = (action?: ProtocolAction, vehicleType?: VehicleType): string | undefined => {
  const stickFunction = functionOf(action)
  const names = vehicleType === undefined ? undefined : vehicleMotionNames[vehicleType]
  if (stickFunction === undefined || names === undefined) return undefined
  return names[stickFunction] ?? 'Not used'
}

/**
 * Reads which RC mode the four stick axes of a mapping are laid out as.
 * @param {JoystickAxisActionCorrespondency} axes - Axis correspondencies to read.
 * @returns {StickMode | null} The mode that matches, or null when the layout is a custom one.
 */
export const detectStickMode = (axes: JoystickAxisActionCorrespondency): StickMode | null => {
  const current = stickSlots.map((slot) => functionOf(axes[slot]?.action))
  const match = Object.entries(stickModeLayouts).find(([, layout]) =>
    layout.every((stickFunction, index) => stickFunction === current[index])
  )
  return match === undefined ? null : (Number(match[0]) as StickMode)
}

/**
 * Lays the four stick functions out as the given RC mode, leaving every axis that flies none of them alone.
 *
 * The value range travels with the function, since it is what the vehicle expects of it (an ArduSub throttle spans 0
 * to 1000 where the other three span -1000 to 1000), while the inversion stays with the physical axis, since it is
 * how that stick reads. A function no axis holds today takes the range the vehicle's own default profile gives it.
 * @param {JoystickAxisActionCorrespondency} axes - Axis correspondencies to lay out.
 * @param {StickMode} mode - Mode to lay them out as.
 * @param {VehicleType} vehicleType - Vehicle the layout will be flying, for the ranges no axis carries yet.
 * @returns {JoystickAxisActionCorrespondency} A new correspondency map with the four stick axes reassigned.
 */
export const remapToStickMode = (
  axes: JoystickAxisActionCorrespondency,
  mode: StickMode,
  vehicleType?: VehicleType
): JoystickAxisActionCorrespondency => {
  const remapped = { ...axes }
  const slots = Object.keys(axes).map(Number) as JoystickAxis[]

  // A function parked on a trigger or an extra axis is about to be written onto a stick as well, and the controller
  // store settles that duplicate by unmapping the older entry behind a warning dialog, so clear it here instead.
  slots
    .filter((slot) => !stickSlots.includes(slot) && functionOf(axes[slot]?.action) !== undefined)
    .forEach((slot) => {
      remapped[slot] = { ...axes[slot], action: otherAvailableActions.no_function }
    })

  stickModeLayouts[mode].forEach((stickFunction, index) => {
    const slot = stickSlots[index]
    const source = slots.map((s) => axes[s]).find((axis) => functionOf(axis?.action) === stickFunction)
    const [low, high] = source === undefined ? defaultSpan(stickFunction, vehicleType) : spanOf(source)

    const target = axes[slot]
    const holdsAStick = functionOf(target?.action) !== undefined
    const inverted = holdsAStick ? target.min > target.max : invertedByDefault.includes(slot)

    remapped[slot] = {
      action: joystickInputAxes[stickFunction],
      min: inverted ? high : low,
      max: inverted ? low : high,
    }
  })

  return remapped
}
