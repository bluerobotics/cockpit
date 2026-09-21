import { defaultProfileVehicleCorrespondency } from '@/assets/defaults'
import { defaultProtocolMappingVehicleCorrespondency } from '@/assets/joystick-profiles'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { settingsManager } from '@/libs/settings-management'
import { deserialize } from '@/libs/utils'
import { isMappingBlank } from '@/migration/default-profile-importer'
import type { JoystickProtocolActionsMapping } from '@/types/joystick'
import type { Profile } from '@/types/widgets'

export const legacySavedProfilesKey = 'cockpit-saved-profiles-v8'
const legacyProfileIndexKey = 'cockpit-current-profile-index'
const legacyProfileCorrespondencyKey = 'cockpit-default-vehicle-type-profiles'
export const legacyProtocolMappingsKey = 'cockpit-protocol-mappings-v1'
export const joystickFunctionsMappingKey = 'cockpit-joystick-functions-mapping-v1'
const legacyMappingIndexKey = 'cockpit-protocol-mapping-index-v1'
const legacyMappingCorrespondencyKey = 'cockpit-default-vehicle-type-protocol-mappings'

/**
 * Reads a legacy key preferring the new settings-management store and falling back to raw localStorage.
 * Cockpit versions prior to settings-management V2 (<= 1.17.x) wrote these keys straight to localStorage via
 * vueuse's `useStorage`, so after an upgrade the data is still there even though it was never promoted into
 * `cockpit-settings-v2`.
 * @param {string} key - The legacy key to read
 * @returns {T | undefined} The stored value (parsed), or undefined if the key is not present anywhere
 */
const readLegacy = <T>(key: string): T | undefined => {
  const fromV2 = settingsManager.getKeyValue<T>(key)
  if (fromV2 !== undefined) return fromV2
  const raw = localStorage.getItem(key)
  return raw ? (deserialize(raw) as T) : undefined
}

/**
 * Reads legacy ViewsGroup data and returns the best profile.
 * Uses the vehicle type correspondency to find the right profile if a vehicle type is provided.
 * Falls back to the active profile index.
 * Old storage keys are left untouched for downgrade compatibility.
 * @param {MavType} [vehicleType] - The connected vehicle's type, if known
 * @returns {Profile | undefined} The chosen profile, or undefined if no legacy data
 */
export const migrateLegacyViewsGroup = (vehicleType?: MavType): Profile | undefined => {
  const profiles = readLegacy<Profile[]>(legacySavedProfilesKey)
  if (!profiles || profiles.length === 0) return undefined

  if (vehicleType) {
    const correspondency =
      readLegacy<typeof defaultProfileVehicleCorrespondency>(legacyProfileCorrespondencyKey) ??
      defaultProfileVehicleCorrespondency
    // @ts-ignore: We know that the value is a string
    const matchHash = correspondency[vehicleType]
    const match = matchHash ? profiles.find((p) => p.hash === matchHash) : undefined
    if (match) {
      console.info(`Migrated ViewsGroup using vehicle type correspondency for ${vehicleType}.`)
      return structuredClone(match)
    }
  }

  const activeIndex = readLegacy<number>(legacyProfileIndexKey) ?? 0
  const idx = Math.min(activeIndex, profiles.length - 1)
  const chosen = structuredClone(profiles[Math.max(idx, 0)])

  console.info(`Migrated ViewsGroup from legacy profiles (active index ${idx}).`)
  return chosen
}

/**
 * Reads legacy joystick mappings and returns the best mapping.
 * Uses the vehicle type correspondency to find the right mapping if a vehicle type is provided.
 * Falls back to the active mapping index.
 * Old storage keys are left untouched for downgrade compatibility.
 * @param {MavType} [vehicleType] - The connected vehicle's type, if known
 * @returns {JoystickProtocolActionsMapping | undefined} The chosen mapping, or undefined if no legacy data
 */
export const migrateLegacyJoystickMapping = (vehicleType?: MavType): JoystickProtocolActionsMapping | undefined => {
  const mappings = readLegacy<JoystickProtocolActionsMapping[]>(legacyProtocolMappingsKey)
  if (!mappings || mappings.length === 0) return undefined

  if (vehicleType) {
    const correspondency =
      readLegacy<typeof defaultProtocolMappingVehicleCorrespondency>(legacyMappingCorrespondencyKey) ??
      defaultProtocolMappingVehicleCorrespondency
    // @ts-ignore: We know that the value is a string
    const matchHash = correspondency[vehicleType]
    const match = matchHash ? mappings.find((m) => m.hash === matchHash) : undefined
    if (match) {
      console.info(`Migrated joystick functions mapping using vehicle type correspondency for ${vehicleType}.`)
      return structuredClone(match)
    }
  }

  const activeIndex = readLegacy<number>(legacyMappingIndexKey) ?? 0
  const idx = Math.min(activeIndex, mappings.length - 1)
  const chosen = structuredClone(mappings[Math.max(idx, 0)])

  console.info(`Migrated joystick functions mapping from legacy mappings (active index ${idx}).`)
  return chosen
}

/**
 * Build the profile list that supersedes the single pre-profiles mapping.
 * @param {JoystickProtocolActionsMapping} singleMapping - Mapping stored under the pre-profiles key
 * @returns {JoystickProtocolActionsMapping[]} One-entry list holding a copy of it
 */
export const seedJoystickProfiles = (
  singleMapping: JoystickProtocolActionsMapping
): JoystickProtocolActionsMapping[] => [structuredClone(singleMapping)]

/**
 * Whether a profile list still holds nothing but the seed, and so can be rebuilt without losing the user's work.
 * @param {JoystickProtocolActionsMapping[]} profiles - Profile list as it stands
 * @returns {boolean} True when the list is empty or a single blank mapping
 */
export const isSeededJoystickProfileList = (profiles: JoystickProtocolActionsMapping[]): boolean =>
  profiles.length === 0 || (profiles.length === 1 && isMappingBlank(profiles[0]))

/**
 * Rebuild the profile list from the pre-profiles key for a machine that had no local copy of it at boot, and so
 * seeded a blank list before the vehicle's copy arrived. Reads the key rather than a cached ref, since two listeners
 * on the same key have no ordering between them.
 * @returns {JoystickProtocolActionsMapping[] | undefined} The rebuilt list, or undefined when the key holds nothing worth keeping
 */
export const reseedJoystickProfilesFromSingleMapping = (): JoystickProtocolActionsMapping[] | undefined => {
  const singleMapping = readLegacy<JoystickProtocolActionsMapping>(joystickFunctionsMappingKey)
  if (singleMapping === undefined || isMappingBlank(singleMapping)) return undefined
  return seedJoystickProfiles(singleMapping)
}
