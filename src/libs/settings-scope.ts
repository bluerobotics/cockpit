import type { CockpitSetting, LocalSyncedSettings, UserSettings } from '@/types/settings-management'

import { isEqual } from './utils'

/**
 * How a shared key reconciles copies that diverged across vehicles before it was shared: `union` combines lists of
 * records by `id` (and plain records by key), `newest` keeps the most recently changed copy.
 */
type SharedSettingMerge = 'union' | 'newest'

/**
 * Settings that belong to the operator rather than to the vehicle, so every vehicle of a user holds the same value.
 */
export const userScopedSettings: Record<string, SharedSettingMerge> = {
  'cockpit-map-overlays-v1': 'union',
  'cockpit-custom-tile-providers-v1': 'union',
  'cockpit-user-last-custom-map-provider-id': 'newest',
  'cockpit-mission-library': 'union',
  'cockpit-mission-thumbnails-v1': 'union',
  'cockpit-points-of-interest': 'union',
  'cockpit-diy-widget-library': 'union',
  'cockpit-diy-widget-auto-save': 'newest',
  'cockpit-display-unit-preferences-v2': 'newest',
  'cockpit-selected-alert-speech-voice': 'newest',
  'cockpit-show-os-alert-voices': 'newest',
  'cockpit-alert-volume': 'newest',
  'cockpit-enable-voice-alerts': 'newest',
  'cockpit-enabled-alert-levels': 'newest',
  'cockpit-ui-glass-effect': 'newest',
  'cockpit-main-menu-style': 'newest',
  'cockpit-has-seen-tutorial': 'newest',
  'cockpit-pirate-mode': 'newest',
}

const unionSettingKeys = Object.keys(userScopedSettings).filter((key) => userScopedSettings[key] === 'union')

/**
 * @param {string} key - Setting key
 * @returns {boolean} Whether the key is shared across all vehicles of a user
 */
export const isUserScopedSetting = (key: string): boolean =>
  Object.prototype.hasOwnProperty.call(userScopedSettings, key)

const spreadNewestCopy = (userSettings: UserSettings, key: string, preferredVehicleId: string): void => {
  let newest: CockpitSetting | undefined
  for (const [vehicleId, settings] of Object.entries(userSettings)) {
    const setting = settings[key]
    if (setting?.value === undefined) continue
    const epoch = setting.epochLastChangedLocally
    const isNewer = newest === undefined || epoch > newest.epochLastChangedLocally
    const winsTie = epoch === newest?.epochLastChangedLocally && vehicleId === preferredVehicleId
    if (isNewer || winsTie) newest = setting
  }
  if (newest === undefined) return
  Object.values(userSettings).forEach((settings) => (settings[key] = newest!))
}

/**
 * @param {LocalSyncedSettings} settings - Local synced settings
 * @returns {boolean} Whether any shared setting holds different values on different vehicles of the same user
 */
export const hasDivergedUserScopedSettings = (settings: LocalSyncedSettings): boolean =>
  Object.values(settings).some((userSettings) =>
    Object.keys(userScopedSettings).some((key) => {
      const copies = Object.values(userSettings)
        .map((vehicleSettings) => vehicleSettings[key]?.value)
        .filter((value) => value !== undefined)
      return copies.some((copy) => !isEqual(copy, copies[0]))
    })
  )

/**
 * Writes the newest copy of every shared setting into all vehicle packages of its user, in place.
 *
 * ponytail: every vehicle package holds its own copy, so a shared list costs its size once per vehicle in the
 * `localStorage` quota. The copies keep older Cockpit versions reading their per-vehicle package; a single user-level
 * package can replace them once those versions no longer need to be supported.
 * @param {LocalSyncedSettings} settings - Local synced settings to normalize
 * @param {string} preferredVehicleId - Vehicle whose copy wins when epochs tie, so the value on screen does not flip
 */
export const spreadUserScopedSettings = (settings: LocalSyncedSettings, preferredVehicleId: string): void => {
  Object.values(settings).forEach((userSettings) => {
    Object.keys(userScopedSettings).forEach((key) => spreadNewestCopy(userSettings, key, preferredVehicleId))
  })
}

/**
 * A list entry identified by a string `id`.
 */
type IdRecord = {
  /**
   * Entry identifier
   */
  id: string
}

const isIdRecord = (item: unknown): item is IdRecord => typeof (item as Partial<IdRecord> | null)?.id === 'string'

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Copies come newest first, so an entry present in several copies keeps its newest version.
const unionOfCopies = (copies: unknown[]): unknown => {
  if (copies.every((copy) => Array.isArray(copy) && copy.every(isIdRecord))) {
    const byId = new Map<string, unknown>()
    ;(copies as IdRecord[][]).flat().forEach((item) => byId.has(item.id) || byId.set(item.id, item))
    return [...byId.values()]
  }
  if (copies.every(isPlainRecord)) return Object.assign({}, ...[...copies].reverse())
  return undefined
}

/**
 * Combines the copies of `union` settings that diverged across a user's vehicles, so making a key shared drops none
 * of the entries any vehicle had. Settings already in agreement are left untouched, so this is idempotent.
 * @param {LocalSyncedSettings} settings - Local synced settings, combined in place
 * @param {number} now - Epoch stamped on combined settings, so they beat stale vehicle copies at the next connect
 * @returns {boolean} Whether any setting was combined
 */
export const unionDivergedUserScopedSettings = (settings: LocalSyncedSettings, now: number): boolean => {
  let changed = false
  Object.values(settings).forEach((userSettings) => {
    unionSettingKeys.forEach((key) => {
      const copies = Object.values(userSettings)
        .map((vehicleSettings) => vehicleSettings[key])
        .filter((setting) => setting?.value !== undefined)
        .sort((a, b) => b.epochLastChangedLocally - a.epochLastChangedLocally)
        .map((setting) => setting.value)
      if (copies.every((copy) => isEqual(copy, copies[0]))) return
      // Copies that cannot be combined are left to the newest-wins spread.
      const combined = unionOfCopies(copies)
      if (combined === undefined) return
      Object.values(userSettings).forEach((vehicleSettings) => {
        vehicleSettings[key] = { epochLastChangedLocally: now, value: combined }
      })
      changed = true
    })
  })
  return changed
}

/**
 * Records the current copies of some keys in some of a user's vehicle packages into a backup, in place, replacing what
 * the backup held for them. Copies that do not exist are skipped.
 * @param {LocalSyncedSettings} backup - Backup to record into
 * @param {LocalSyncedSettings} settings - Local synced settings to read the copies from
 * @param {string} userId - User whose copies are recorded
 * @param {string[]} vehicleIds - Vehicles whose copies are recorded
 * @param {string[]} keys - Setting keys to record
 */
export const backupSettingCopies = (
  backup: LocalSyncedSettings,
  settings: LocalSyncedSettings,
  userId: string,
  vehicleIds: string[],
  keys: string[]
): void => {
  vehicleIds.forEach((vehicleId) => {
    keys.forEach((key) => {
      const setting = settings[userId]?.[vehicleId]?.[key]
      if (setting === undefined) return
      backup[userId] ??= {}
      backup[userId][vehicleId] ??= {}
      backup[userId][vehicleId][key] = setting
    })
  })
}
