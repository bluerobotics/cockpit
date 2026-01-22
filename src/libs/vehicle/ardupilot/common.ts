import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import {
  type CockpitActionsFunction,
  CockpitAction,
  registerActionCallback,
  registerNewAction,
} from '@/libs/joystick/protocols/cockpit-actions'

import { Type as VehicleType } from '../vehicle'
import { CopterMode, PlaneMode, RoverMode, SubMode } from './types/modes'

type ModeEnum = Record<string, string | number>

/**
 * Pattern for ArduPilot vehicle mode action IDs: ardupilot_{vehicleType}_mode_{modeName}
 */
export type ArduPilotVehicleModeActionIdPattern = `ardupilot_${VehicleType}_mode_${string}`

/**
 * Mapping from MavType to VehicleType
 * Please refer to https://ardupilot.org/ardupilot/docs/common-all-vehicle-types.html for more information.
 */
const mavTypeToVehicleType: Partial<Record<MavType, VehicleType>> = {
  [MavType.MAV_TYPE_SUBMARINE]: VehicleType.Sub,
  [MavType.MAV_TYPE_GROUND_ROVER]: VehicleType.Rover,
  [MavType.MAV_TYPE_SURFACE_BOAT]: VehicleType.Rover,
  [MavType.MAV_TYPE_FLAPPING_WING]: VehicleType.Plane,
  [MavType.MAV_TYPE_VTOL_TILTROTOR]: VehicleType.Plane,
  [MavType.MAV_TYPE_VTOL_QUADROTOR]: VehicleType.Plane,
  [MavType.MAV_TYPE_VTOL_DUOROTOR]: VehicleType.Plane,
  [MavType.MAV_TYPE_FIXED_WING]: VehicleType.Plane,
  [MavType.MAV_TYPE_TRICOPTER]: VehicleType.Copter,
  [MavType.MAV_TYPE_COAXIAL]: VehicleType.Copter,
  [MavType.MAV_TYPE_HEXAROTOR]: VehicleType.Copter,
  [MavType.MAV_TYPE_HELICOPTER]: VehicleType.Copter,
  [MavType.MAV_TYPE_OCTOROTOR]: VehicleType.Copter,
  [MavType.MAV_TYPE_DODECAROTOR]: VehicleType.Copter,
  [MavType.MAV_TYPE_QUADROTOR]: VehicleType.Copter,
}

/**
 * Get the VehicleType for a given MavType
 * @param {MavType | string} mavType - The MAVLink vehicle type
 * @returns {VehicleType | undefined} The corresponding VehicleType, or undefined if not mapped
 */
export function getVehicleTypeFromMavType(mavType: MavType | string): VehicleType | undefined {
  return mavTypeToVehicleType[mavType as MavType]
}

/**
 * Check if an action ID is a vehicle mode action and extract the vehicle type
 * @param {string} actionId - The action ID to check
 * @returns {VehicleType | undefined} The vehicle type if it's a mode action, undefined otherwise
 */
export function getVehicleTypeFromModeActionId(actionId: string): VehicleType | undefined {
  const match = actionId.match(/^ardupilot_(rover|sub|copter|plane)_mode_/)
  if (!match) return undefined
  return match[1] as VehicleType
}

/**
 * Mode enums for each vehicle type
 */
const vehicleModeEnums: Record<VehicleType, ModeEnum> = {
  [VehicleType.Rover]: RoverMode,
  [VehicleType.Sub]: SubMode,
  [VehicleType.Copter]: CopterMode,
  [VehicleType.Plane]: PlaneMode,
  [VehicleType.Antenna]: {},
  [VehicleType.Blimp]: {},
}

/**
 * Registry mapping vehicleType_modeValue to CockpitAction
 */
const modeActionRegistry = new Map<string, CockpitAction>()

/**
 * Get registry key for a vehicle mode
 * @param {VehicleType} vehicleType - The vehicle type
 * @param {number} modeValue - The mode value
 * @returns {string} The registry key
 */
function getModeRegistryKey(vehicleType: VehicleType, modeValue: number): string {
  return `${vehicleType}_${modeValue}`
}

/**
 * Generate an action ID for a vehicle mode
 * @param {VehicleType} vehicleType - The vehicle type
 * @param {string} modeName - The mode name (lowercase, e.g., 'manual', 'auto')
 * @returns {CockpitActionsFunction} The action ID
 */
export function getVehicleModeActionId(vehicleType: VehicleType, modeName: string): CockpitActionsFunction {
  return `ardupilot_${vehicleType}_mode_${modeName.toLowerCase()}` as CockpitActionsFunction
}

/**
 * Create a CockpitAction for a vehicle mode
 * @param {VehicleType} vehicleType - The vehicle type
 * @param {string} modeName - The mode name
 * @returns {CockpitAction} The created action
 */
export function createVehicleModeAction(vehicleType: VehicleType, modeName: string): CockpitAction {
  const actionId = getVehicleModeActionId(vehicleType, modeName)
  // TODO: Use the new MAVLink Mode microservice: https://mavlink.io/en/services/standard_modes.html#getting-all-available-modes
  const displayName = modeName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const vehicleDisplayName = vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)
  return new CockpitAction(actionId, `${displayName} Mode (ArduPilot ${vehicleDisplayName})`)
}

/**
 * Get the mode name from a mode value for a vehicle type
 * @param {VehicleType} vehicleType - The vehicle type
 * @param {number} modeValue - The mode enum value
 * @returns {string} The mode name
 */
function getModeName(vehicleType: VehicleType, modeValue: number): string {
  const modeEnum = vehicleModeEnums[vehicleType]
  if (modeEnum?.[modeValue]) {
    return (modeEnum[modeValue] as string).toLowerCase()
  }
  return 'unknown'
}

/**
 * Get a CockpitAction for a vehicle mode by its enum value
 * Returns the registered action if available, otherwise creates a placeholder
 * @param {VehicleType} vehicleType - The vehicle type
 * @param {number} modeValue - The mode enum value
 * @returns {CockpitAction} The action for this mode
 */
export function getVehicleModeAction(vehicleType: VehicleType, modeValue: number): CockpitAction {
  const registered = modeActionRegistry.get(getModeRegistryKey(vehicleType, modeValue))
  if (registered) {
    return registered
  }
  // Create a placeholder action using the mode name
  const modeName = getModeName(vehicleType, modeValue)
  return createVehicleModeAction(vehicleType, modeName)
}

/**
 * Internal ArduPilot modes that should not be exposed as user-selectable actions
 * PRE_FLIGHT: Internal state before vehicle is ready
 * INITIALISING: Internal state during vehicle initialization
 */
const INTERNAL_MODES = ['pre_flight', 'initialising']

/**
 * Get mode entries from a CustomMode enum
 * @param {object} modeEnum - The CustomMode enum object
 * @returns {Array<[string, number]>} Array of [modeName, modeValue] pairs
 */
export function getModeEntries<T extends Record<string, string | number>>(modeEnum: T): Array<[string, number]> {
  return Object.entries(modeEnum)
    .filter(([key]) => isNaN(Number(key))) // Filter out reverse enum mappings (numeric keys)
    .map(([key, value]): [string, number] => [key.toLowerCase(), value as number])
    .filter(([modeName]) => !INTERNAL_MODES.includes(modeName)) // Filter by lowercase name
}

/**
 * Interface for vehicles that support mode setting
 */
interface ModeSettable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  /**
   * Set the mode of the vehicle
   * @param {any} mode - The mode to set
   */
  setMode(mode: any): void
}

/**
 * Pre-register all mode actions for all vehicle types
 * Called at module load time so all modes are available in the UI
 */
function preRegisterAllModeActions(): void {
  for (const [vehicleType, modeEnum] of Object.entries(vehicleModeEnums)) {
    const modes = getModeEntries(modeEnum)
    for (const [modeName, modeValue] of modes) {
      const action = createVehicleModeAction(vehicleType as VehicleType, modeName)
      registerNewAction(action)
      // Register in the mode action registry for lookup by mode value
      modeActionRegistry.set(getModeRegistryKey(vehicleType as VehicleType, modeValue), action)
    }
  }
}

// Pre-register all mode actions at module load time
preRegisterAllModeActions()

/**
 * Register mode change callbacks for a connected vehicle
 * @param {VehicleType} vehicleType - The vehicle type
 * @param {object} modeEnum - The CustomMode enum object
 * @param {ModeSettable} vehicle - The vehicle instance with setMode method
 */
export function registerModeActions<T extends Record<string, string | number>>(
  vehicleType: VehicleType,
  modeEnum: T,
  vehicle: ModeSettable
): void {
  const modes = getModeEntries(modeEnum)

  for (const [modeName, modeValue] of modes) {
    // Get the pre-registered action or create a new one
    let action = modeActionRegistry.get(getModeRegistryKey(vehicleType, modeValue))
    if (!action) {
      action = createVehicleModeAction(vehicleType, modeName)
      registerNewAction(action)
      modeActionRegistry.set(getModeRegistryKey(vehicleType, modeValue), action)
    }
    // Register the callback for this vehicle
    registerActionCallback(action, () => {
      vehicle.setMode(modeValue)
    })
  }
}
