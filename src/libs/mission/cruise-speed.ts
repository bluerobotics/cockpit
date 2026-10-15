import { MavCmd } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { CockpitMission, MissionCommand } from '@/types/mission'

/**
 * The cruise speed Cockpit shipped as its default, in m/s. Before "use the vehicle's own speed" was stored on its
 * own, an untouched speed was kept as this value, and older Cockpits still read it that way.
 */
export const shippedCruiseSpeed = 1

/**
 * A stored or imported cruise speed, if it is one the vehicle can be commanded to.
 * @param {unknown} speed - The value read, in m/s
 * @returns {number | null} The speed, or null to leave the vehicle on its own
 */
export const validCruiseSpeed = (speed: unknown): number | null =>
  typeof speed === 'number' && Number.isFinite(speed) && speed > 0 ? speed : null

/**
 * Reads a cruise speed stored before "use the vehicle's own speed" had a value of its own.
 * @param {unknown} legacySpeed - The stored speed, in m/s
 * @returns {number | null} The speed to command, or null to leave the vehicle on its own
 */
export const cruiseSpeedFromLegacy = (legacySpeed: unknown): number | null => {
  const speed = validCruiseSpeed(legacySpeed)
  return speed === shippedCruiseSpeed ? null : speed
}

/**
 * The cruise speed a mission commands, whether it was saved before or after the vehicle-speed choice was stored.
 * @param {CockpitMission['settings']} settings - The mission settings, possibly from an imported file
 * @returns {number | null} The speed to command, or null to leave the vehicle on its own
 */
export const missionCruiseSpeed = (settings: CockpitMission['settings']): number | null =>
  settings.cruiseSpeed === undefined
    ? cruiseSpeedFromLegacy(settings.defaultCruiseSpeed)
    : validCruiseSpeed(settings.cruiseSpeed)

/**
 * The cruise speed a mission item commands, as read back from a mission downloaded from the vehicle.
 * @param {MissionCommand[]} commands - The commands of the item, usually the mission's first
 * @returns {number | null} The speed to command, or null when the item leaves the vehicle on its own
 */
export const commandedCruiseSpeed = (commands: MissionCommand[]): number | null =>
  validCruiseSpeed(commands.find((command) => command?.command === MavCmd.MAV_CMD_DO_CHANGE_SPEED)?.param2)

/**
 * The mission settings fields a cruise speed is saved in. Older Cockpits read only `defaultCruiseSpeed`, where the
 * shipped speed is the one they leave to the vehicle.
 * @param {number | null} speed - The speed to command, or null to leave the vehicle on its own
 * @returns {Pick<CockpitMission['settings'], 'defaultCruiseSpeed' | 'cruiseSpeed'>} The fields to save
 */
export const cruiseSpeedSettings = (
  speed: number | null
): Pick<CockpitMission['settings'], 'defaultCruiseSpeed' | 'cruiseSpeed'> => ({
  defaultCruiseSpeed: speed ?? shippedCruiseSpeed,
  cruiseSpeed: speed,
})
