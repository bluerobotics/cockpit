import { Firmware, Type as VehicleType } from '@/libs/vehicle/vehicle'

/**
 * The vehicle a fence setting is described for.
 */
export interface FenceVehicle {
  /**
   * Autopilot firmware family.
   */
  firmware: Firmware
  /**
   * ArduPilot vehicle family, when known.
   */
  family?: VehicleType
  /**
   * Whether the vehicle is a boat, which drifts where a ground rover simply stops.
   */
  isBoat: boolean
}

/**
 * One value of the autopilot's fence action parameter, worded as what the vehicle does on a breach.
 */
export interface FenceActionOption {
  /**
   * Parameter value.
   */
  value: number
  /**
   * What the vehicle does, phrased to complete "it will ...".
   */
  label: string
  /**
   * Whether the reaction is to cut the motors, leaving a boat to drift with the current.
   */
  drifts: boolean
  /**
   * What the vehicle does when the action itself fails, phrased to complete "it will ...".
   */
  fallback?: string
}

const WARN_ONLY = 'Only warn and keep going'

const option = (value: number, label: string, drifts = false): FenceActionOption => ({ value, label, drifts })

const px4Options = (isBoat: boolean): FenceActionOption[] => [
  option(0, 'Do nothing'),
  option(1, WARN_ONLY),
  option(2, isBoat ? 'Stop the motors and drift' : 'Stop and hold in place', isBoat),
  option(3, 'Return home'),
  option(4, isBoat ? 'Cut all motors at once (terminate) and drift' : 'Cut all motors at once (terminate)', isBoat),
  option(5, 'Land where it is'),
]

const NOUNS: Partial<Record<VehicleType, string>> = {
  [VehicleType.Copter]: 'drone',
  [VehicleType.Plane]: 'plane',
  [VehicleType.Rover]: 'rover',
  [VehicleType.Sub]: 'ROV',
}

/**
 * Name of the parameter holding the fence action on the given firmware.
 * @param {Firmware} firmware Autopilot firmware family.
 * @returns {string | undefined} The parameter name, or undefined when the firmware has none.
 */
export const fenceActionParameter = (firmware: Firmware): string | undefined => {
  if (firmware === Firmware.ArduPilot) return 'FENCE_ACTION'
  if (firmware === Firmware.PX4) return 'GF_ACTION'
  return undefined
}

/**
 * The fence actions the vehicle accepts, worded as what it does when it crosses the fence. ArduPilot lists follow
 * current firmware rather than the bundled parameter metadata, which predates actions such as Rover's Terminate.
 * @param {FenceVehicle} vehicle The vehicle to describe.
 * @returns {FenceActionOption[]} The accepted values, in parameter order.
 */
export const fenceActionOptions = (vehicle: FenceVehicle): FenceActionOption[] => {
  if (vehicle.firmware === Firmware.PX4) return px4Options(vehicle.isBoat)
  if (vehicle.firmware !== Firmware.ArduPilot) return []
  const stop = vehicle.isBoat ? 'stop the motors and drift' : 'stop'
  switch (vehicle.family) {
    case VehicleType.Rover: {
      // Rover falls back to Hold whenever the chosen mode cannot be entered.
      const withHold = (value: number, label: string): FenceActionOption => ({
        ...option(value, label),
        fallback: stop,
      })
      return [
        option(0, WARN_ONLY),
        withHold(1, 'Return home'),
        option(2, vehicle.isBoat ? 'Stop the motors and drift' : 'Stop', vehicle.isBoat),
        withHold(3, 'Retrace its path home, or return home'),
        withHold(4, 'Retrace its path home'),
        option(5, vehicle.isBoat ? 'Disarm and drift' : 'Disarm', vehicle.isBoat),
        withHold(6, 'Hold its position'),
      ]
    }
    case VehicleType.Copter:
      return [
        option(0, WARN_ONLY),
        option(1, "Return home, or land if it can't"),
        option(2, 'Land where it is'),
        option(3, 'Retrace its path home, or return home, or land'),
        option(4, "Brake and hover, or land if it can't"),
        option(5, 'Retrace its path home, or land'),
      ]
    case VehicleType.Plane:
      return [
        option(0, WARN_ONLY),
        option(1, 'Return home'),
        option(6, 'Fly to the breach return point and circle there'),
        option(7, 'Fly to the breach return point, leaving the throttle to the pilot'),
        option(8, 'Land automatically if set up to, or return home'),
      ]
    // ArduSub accepts the parameter but does not act on a breach yet, whatever it is set to.
    case VehicleType.Sub:
      return [option(0, WARN_ONLY), option(1, 'Only warn (ArduSub ignores the return setting)')]
    default:
      return [option(0, WARN_ONLY), option(1, "Return home, or land if it can't")]
  }
}

/**
 * Whether the vehicle flies to a breach return point. Only ArduPilot planes (VTOLs included) use one; other
 * ArduPilot vehicles and PX4 accept it in the fence but never read it.
 * @param {FenceVehicle} vehicle The vehicle to check.
 * @returns {boolean} True when the vehicle uses a breach return point.
 */
export const supportsBreachReturn = ({ firmware, family }: FenceVehicle): boolean =>
  firmware === Firmware.ArduPilot && family === VehicleType.Plane

/**
 * `FENCE_AUTOENABLE` value that turns the fence on at arming and off at disarming, on any ArduPilot vehicle.
 */
export const FENCE_AUTOENABLE_WHEN_ARMED = 3

/**
 * Whether the vehicle takes off, which is what the other `FENCE_AUTOENABLE` values wait for. Only ArduPilot planes
 * and copters do; boats, rovers and subs only ever reach the arming one.
 * @param {FenceVehicle} vehicle The vehicle to check.
 * @returns {boolean} True for ArduPilot planes and copters.
 */
export const autoEnablesOnTakeoff = ({ firmware, family }: FenceVehicle): boolean =>
  firmware === Firmware.ArduPilot && (family === VehicleType.Plane || family === VehicleType.Copter)

/**
 * The `FENCE_AUTOENABLE` values that do something on the vehicle.
 * @param {boolean} takesOff Whether the vehicle takes off, as told by `autoEnablesOnTakeoff`.
 * @returns {Pick<FenceActionOption, 'value' | 'label'>[]} The useful values, in parameter order.
 */
export const fenceAutoEnableOptions = (takesOff: boolean): Pick<FenceActionOption, 'value' | 'label'>[] => {
  const whenArmed = { value: FENCE_AUTOENABLE_WHEN_ARMED, label: 'On when armed' }
  if (!takesOff) return [{ value: 0, label: 'Off' }, whenArmed]
  return [
    { value: 0, label: 'Off' },
    { value: 1, label: 'On after an automatic takeoff' },
    { value: 2, label: 'On after an automatic takeoff, floor off when landing' },
    whenArmed,
  ]
}

/**
 * Whether the vehicle turns its fence on by itself with the given `FENCE_AUTOENABLE` value.
 * @param {boolean} takesOff Whether the vehicle takes off, as told by `autoEnablesOnTakeoff`.
 * @param {number} mode Current `FENCE_AUTOENABLE` value.
 * @returns {boolean} True when the value is one the vehicle acts on.
 */
export const isFenceAutoEnabled = (takesOff: boolean, mode: number): boolean =>
  takesOff ? mode > 0 : mode === FENCE_AUTOENABLE_WHEN_ARMED

let selfChecked = false

// Runs on first use in development; the global `assert` is installed during bootstrap, after this module loads.
const runSelfChecksOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true
  const boat = { firmware: Firmware.ArduPilot, family: VehicleType.Rover, isBoat: true }
  assert(fenceBreachOutcome(boat, 5) === 'If the boat crosses the fence, it will disarm and drift.')
  assert(
    fenceBreachOutcome(boat, 1) ===
      'If the boat crosses the fence, it will return home. If that option fails, it will stop the motors and drift.'
  )
  assert(fenceActionOptions({ firmware: Firmware.PX4, isBoat: true }).filter((action) => action.drifts).length === 2)
  assert(fenceActionOptions(boat).filter((action) => action.drifts).length === 2)
  assert(!fenceActionOptions({ ...boat, isBoat: false }).some((action) => action.drifts))
  assert(!autoEnablesOnTakeoff(boat) && fenceAutoEnableOptions(false).length === 2)
  assert(!isFenceAutoEnabled(false, 1) && isFenceAutoEnabled(false, 3) && isFenceAutoEnabled(true, 1))
  assert(autoEnablesOnTakeoff({ firmware: Firmware.ArduPilot, family: VehicleType.Copter, isBoat: false }))
  assert(supportsBreachReturn({ firmware: Firmware.ArduPilot, family: VehicleType.Plane, isBoat: false }))
  assert(!supportsBreachReturn({ firmware: Firmware.PX4, family: VehicleType.Plane, isBoat: false }))
}

/**
 * Tells the operator what the vehicle does when it crosses the fence, given its fence action value.
 * @param {FenceVehicle} vehicle The vehicle to describe.
 * @param {number} value Current value of the fence action parameter.
 * @returns {string} The sentence for the operator.
 */
export const fenceBreachOutcome = (vehicle: FenceVehicle, value: number): string => {
  runSelfChecksOnce()
  const noun = vehicle.isBoat ? 'boat' : (vehicle.family && NOUNS[vehicle.family]) || 'vehicle'
  const action = fenceActionOptions(vehicle).find((candidate) => candidate.value === value)
  if (!action) return `If the ${noun} crosses the fence, what it does is unknown (fence action ${value}).`
  const verb = action.label.charAt(0).toLowerCase() + action.label.slice(1)
  const fallback = action.fallback ? ` If that option fails, it will ${action.fallback}.` : ''
  return `If the ${noun} crosses the fence, it will ${verb}.${fallback}`
}
