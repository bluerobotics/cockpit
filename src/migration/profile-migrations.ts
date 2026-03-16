import { defaultProfileVehicleCorrespondency } from '@/assets/defaults'
import { defaultProtocolMappingVehicleCorrespondency } from '@/assets/joystick-profiles'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { settingsManager } from '@/libs/settings-management'
import type { JoystickProtocolActionsMapping } from '@/types/joystick'
import type { Profile } from '@/types/widgets'

export const legacySavedProfilesKey = 'cockpit-saved-profiles-v8'
const legacyProfileIndexKey = 'cockpit-current-profile-index'
const legacyProfileCorrespondencyKey = 'cockpit-default-vehicle-type-profiles'
export const legacyProtocolMappingsKey = 'cockpit-protocol-mappings-v1'
const legacyMappingIndexKey = 'cockpit-protocol-mapping-index-v1'
const legacyMappingCorrespondencyKey = 'cockpit-default-vehicle-type-protocol-mappings'

/**
 * Reads legacy ViewsGroup data and returns the best profile.
 * Uses the vehicle type correspondency to find the right profile if a vehicle type is provided.
 * Falls back to the active profile index.
 * Old storage keys are left untouched for downgrade compatibility.
 * @param {MavType} [vehicleType] - The connected vehicle's type, if known
 * @returns {Profile | undefined} The chosen profile, or undefined if no legacy data
 */
export const migrateLegacyViewsGroup = (vehicleType?: MavType): Profile | undefined => {
  const profiles = settingsManager.getKeyValue<Profile[]>(legacySavedProfilesKey)
  if (!profiles || profiles.length === 0) return undefined

  if (vehicleType) {
    const correspondency =
      settingsManager.getKeyValue<typeof defaultProfileVehicleCorrespondency>(legacyProfileCorrespondencyKey) ??
      defaultProfileVehicleCorrespondency
    // @ts-ignore: We know that the value is a string
    const matchHash = correspondency[vehicleType]
    const match = matchHash ? profiles.find((p) => p.hash === matchHash) : undefined
    if (match) {
      console.info(`Migrated ViewsGroup using vehicle type correspondency for ${vehicleType}.`)
      return structuredClone(match)
    }
  }

  const activeIndex = settingsManager.getKeyValue<number>(legacyProfileIndexKey) ?? 0
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
  const mappings = settingsManager.getKeyValue<JoystickProtocolActionsMapping[]>(legacyProtocolMappingsKey)
  if (!mappings || mappings.length === 0) return undefined

  if (vehicleType) {
    const correspondency =
      settingsManager.getKeyValue<typeof defaultProtocolMappingVehicleCorrespondency>(legacyMappingCorrespondencyKey) ??
      defaultProtocolMappingVehicleCorrespondency
    // @ts-ignore: We know that the value is a string
    const matchHash = correspondency[vehicleType]
    const match = matchHash ? mappings.find((m) => m.hash === matchHash) : undefined
    if (match) {
      console.info(`Migrated joystick functions mapping using vehicle type correspondency for ${vehicleType}.`)
      return structuredClone(match)
    }
  }

  const activeIndex = settingsManager.getKeyValue<number>(legacyMappingIndexKey) ?? 0
  const idx = Math.min(activeIndex, mappings.length - 1)
  const chosen = structuredClone(mappings[Math.max(idx, 0)])

  console.info(`Migrated joystick functions mapping from legacy mappings (active index ${idx}).`)
  return chosen
}
