import type { CockpitSetting, LocalSyncedSettings, SettingsPackage, UserSettings } from '@/types/settings-management'

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

const entriesOf = (value: unknown): Map<string, unknown> | undefined => {
  if (Array.isArray(value))
    return value.every(isIdRecord) ? new Map(value.map((entry) => [entry.id, entry])) : undefined
  return isPlainRecord(value) ? new Map(Object.entries(value)) : undefined
}

/**
 * @param {unknown} value - Value of a `union` setting
 * @returns {string[] | undefined} Ids of its entries (record keys for plain records), or undefined when it is neither
 */
export const sharedListEntryIds = (value: unknown): string[] | undefined => {
  const entries = entriesOf(value)
  return entries === undefined ? undefined : [...entries.keys()]
}

// Entries in only one copy were added there unless both sides agreed on them before, in which case the other side
// deleted them. Entries in both copies keep the newer copy's version.
const mergeAgainstAgreedIds = (newer: unknown, older: unknown, agreedIds: Set<string>): unknown => {
  const newerEntries = entriesOf(newer)
  const olderEntries = entriesOf(older)
  if (newerEntries === undefined || olderEntries === undefined || Array.isArray(newer) !== Array.isArray(older)) {
    return undefined
  }
  const merged = new Map([...newerEntries].filter(([id]) => olderEntries.has(id) || !agreedIds.has(id)))
  olderEntries.forEach((entry, id) => {
    if (!newerEntries.has(id) && !agreedIds.has(id)) merged.set(id, entry)
  })
  return Array.isArray(newer) ? [...merged.values()] : Object.fromEntries(merged)
}

/**
 * Ids of each `union` setting's entries that a computer and one vehicle both held at their last agreement.
 */
export type SharedListAgreement = Record<string, string[]>

/**
 * Agreements per user and per vehicle, kept on this computer only.
 */
export type SharedListAgreements = Record<string, Record<string, SharedListAgreement>>

/**
 * Fills in an agreement for the `union` keys that have none yet, from this computer's copy for the vehicle as it was
 * before the keys were shared. When that copy is no newer than the vehicle's, this computer has not changed it since
 * they last synced, so its entries are what both sides last held and a deletion made elsewhere is applied, not undone.
 * @param {SharedListAgreement} agreement - Ids both sides held at their last recorded agreement
 * @param {SettingsPackage | undefined} backedUp - This computer's copies for the vehicle from before the keys were shared
 * @param {SettingsPackage} vehicle - The vehicle's package
 * @returns {SharedListAgreement} The agreement, completed where the backed-up copy allows
 */
export const seedAgreementFromBackup = (
  agreement: SharedListAgreement,
  backedUp: SettingsPackage | undefined,
  vehicle: SettingsPackage
): SharedListAgreement => {
  const seeded = { ...agreement }
  unionSettingKeys.forEach((key) => {
    const backedUpSetting = backedUp?.[key]
    const vehicleSetting = vehicle[key]
    if (seeded[key] !== undefined || backedUpSetting?.value === undefined || vehicleSetting?.value === undefined) return
    if (backedUpSetting.epochLastChangedLocally > vehicleSetting.epochLastChangedLocally) return
    const ids = sharedListEntryIds(backedUpSetting.value)
    if (ids !== undefined) seeded[key] = ids
  })
  return seeded
}

/**
 * Merges a user's `union` settings between this computer's and a vehicle's copies, in place, so connecting keeps the
 * entries added on either side and drops only the ones a side deleted after both had agreed on them. Without an
 * agreement (a vehicle this computer never synced with) both copies are combined, so no entry is lost.
 * @param {SettingsPackage} merged - Merged package for the vehicle, updated in place
 * @param {SettingsPackage} local - This computer's package for the vehicle
 * @param {SettingsPackage} vehicle - The vehicle's package
 * @param {SharedListAgreement} agreement - Ids both sides held at their last agreement
 * @param {number} now - Epoch stamped on merged values that match neither copy, so they win on both sides
 * @returns {SharedListAgreement} Ids the vehicle holds that this computer also holds or still has to delete there
 */
export const mergeUserScopedListsWithVehicle = (
  merged: SettingsPackage,
  local: SettingsPackage,
  vehicle: SettingsPackage,
  agreement: SharedListAgreement,
  now: number
): SharedListAgreement => {
  const agreed: SharedListAgreement = {}
  unionSettingKeys.forEach((key) => {
    const localSetting = local[key]
    const vehicleSetting = vehicle[key]
    if (vehicleSetting?.value === undefined) return
    // This computer adopts the vehicle's copy as is, so both sides then hold all of its entries.
    if (localSetting?.value === undefined) {
      const vehicleIds = sharedListEntryIds(vehicleSetting.value)
      if (vehicleIds !== undefined) agreed[key] = vehicleIds
      return
    }
    const localIsNewer = localSetting.epochLastChangedLocally > vehicleSetting.epochLastChangedLocally
    const [newer, older] = localIsNewer ? [localSetting, vehicleSetting] : [vehicleSetting, localSetting]
    const agreedIds = new Set(agreement[key] ?? [])
    const value = mergeAgainstAgreedIds(newer.value, older.value, agreedIds)
    if (value === undefined) return
    if (!isEqual(localSetting.value, vehicleSetting.value)) {
      merged[key] = isEqual(value, newer.value) ? newer : { epochLastChangedLocally: now, value }
    }
    // A deletion stays agreed until a push removes the entry from the vehicle, so an interrupted push retries it.
    const mergedIds = new Set(sharedListEntryIds(value))
    agreed[key] = (sharedListEntryIds(vehicleSetting.value) ?? []).filter(
      (id) => mergedIds.has(id) || agreedIds.has(id)
    )
  })
  return agreed
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
