import { coolMissionNames } from '@/libs/funny-name/words'

/**
 * Picks a random human-friendly name to use as an automatic mission name.
 * @returns {string} A cool mission name.
 */
export const generateAutomaticMissionName = (): string => coolMissionNames.random() ?? coolMissionNames[0]

/**
 * Whether two dates fall on different local calendar days.
 * @param {Date} a First date.
 * @param {Date} b Second date.
 * @returns {boolean} `true` when the dates belong to different local calendar days.
 */
export const isNewCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth() || a.getDate() !== b.getDate()

// A restart shorter than this since Cockpit was last alive is treated as the same mission, even across midnight.
export const AUTOMATIC_MISSION_NAME_MIN_IDLE_MS = 6 * 60 * 60 * 1000

/**
 * Whether the automatic mission name should be renewed on launch: only when a new calendar day has started and
 * Cockpit has been closed long enough that the previous session was a distinct mission. This keeps the mission
 * stable across a brief overnight restart while still starting a fresh one the next working day.
 * @param {Date} lastOpen Last moment Cockpit was known to be alive.
 * @param {Date} now Current moment.
 * @param {number} minIdleMs Minimum idle time, in milliseconds, that must have elapsed since `lastOpen`.
 * @returns {boolean} `true` when the automatic name should be renewed.
 */
export const shouldRenewAutomaticMissionName = (lastOpen: Date, now: Date, minIdleMs: number): boolean =>
  isNewCalendarDay(lastOpen, now) && now.getTime() - lastOpen.getTime() > minIdleMs
