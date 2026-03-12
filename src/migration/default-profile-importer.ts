import { v4 as uuid4 } from 'uuid'

import { blankViewsGroup, defaultProfileVehicleCorrespondency, widgetProfiles } from '@/assets/defaults'
import {
  blankMapping,
  cockpitStandardToProtocols,
  defaultProtocolMappingVehicleCorrespondency,
} from '@/assets/joystick-profiles'
import { openSnackbar } from '@/composables/snackbar'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { OtherProtocol } from '@/libs/joystick/protocols/other'
import { settingsManager } from '@/libs/settings-management'
import type { JoystickProtocolActionsMapping } from '@/types/joystick'
import type { Profile } from '@/types/widgets'

const defaultsImportedKey = 'cockpit-defaults-imported-for-vehicle-type'

const getDefaultViewsGroup = (vehicleType: MavType): Profile | undefined => {
  // @ts-ignore: We know that the value is a string
  const hash = defaultProfileVehicleCorrespondency[vehicleType]
  return widgetProfiles.find((p) => p.hash === hash)
}

const getDefaultMapping = (vehicleType: MavType): JoystickProtocolActionsMapping | undefined => {
  // @ts-ignore: We know that the value is a string
  const hash = defaultProtocolMappingVehicleCorrespondency[vehicleType]
  return cockpitStandardToProtocols.find((m) => m.hash === hash)
}

const isViewsGroupBlank = (profile: Profile): boolean => {
  if (profile.views.length !== blankViewsGroup.views.length) return false
  for (let i = 0; i < profile.views.length; i++) {
    const view = profile.views[i]
    const blank = blankViewsGroup.views[i]
    if (view.widgets.length !== blank.widgets.length) return false
    for (let j = 0; j < view.miniWidgetContainers.length; j++) {
      if (view.miniWidgetContainers[j]?.widgets.length !== blank.miniWidgetContainers[j]?.widgets.length) return false
    }
  }
  return true
}

const isMappingBlank = (mapping: JoystickProtocolActionsMapping): boolean => {
  for (const corr of Object.values(mapping.axesCorrespondencies)) {
    if (corr.action.id !== OtherProtocol.no_function) return false
    const blankCorr = Object.values(blankMapping.axesCorrespondencies)[0]
    if (corr.min !== blankCorr.min || corr.max !== blankCorr.max) return false
  }
  for (const buttons of Object.values(mapping.buttonsCorrespondencies)) {
    for (const btn of Object.values(buttons)) {
      if (btn.action.id !== OtherProtocol.no_function) return false
    }
  }
  return true
}

const vehicleTypeName = (vehicleType: MavType): string => {
  const names: Partial<Record<MavType, string>> = {
    [MavType.MAV_TYPE_SUBMARINE]: 'Submarine / ROV',
    [MavType.MAV_TYPE_SURFACE_BOAT]: 'Boat',
    [MavType.MAV_TYPE_QUADROTOR]: 'Aerial (MAV)',
  }
  return names[vehicleType] ?? vehicleType
}

/**
 * Merges a user's modified joystick mapping with the vehicle default.
 * All axis values come from the default. For buttons, user-assigned functions are kept,
 * and remaining no_function slots are filled from the default (if not already assigned).
 * @param {JoystickProtocolActionsMapping} userMapping - The user's current mapping
 * @param {JoystickProtocolActionsMapping} defaultMapping - The vehicle type default
 * @returns {JoystickProtocolActionsMapping} The merged mapping
 */
const mergeJoystickMappings = (
  userMapping: JoystickProtocolActionsMapping,
  defaultMapping: JoystickProtocolActionsMapping
): JoystickProtocolActionsMapping => {
  const merged = structuredClone(userMapping)

  merged.axesCorrespondencies = structuredClone(defaultMapping.axesCorrespondencies)

  for (const modKey of Object.keys(merged.buttonsCorrespondencies)) {
    const userButtons = merged.buttonsCorrespondencies[modKey as keyof typeof merged.buttonsCorrespondencies]
    const defaultButtons =
      defaultMapping.buttonsCorrespondencies[modKey as keyof typeof defaultMapping.buttonsCorrespondencies]

    const usedActionIds = new Set<string>()
    for (const btn of Object.values(userButtons)) {
      if (btn.action.id !== OtherProtocol.no_function) {
        usedActionIds.add(btn.action.id)
      }
    }

    for (const [btnIdx, btn] of Object.entries(userButtons)) {
      if (btn.action.id !== OtherProtocol.no_function) continue
      const defaultAction = defaultButtons[btnIdx as unknown as number]?.action
      if (!defaultAction || defaultAction.id === OtherProtocol.no_function) continue
      if (usedActionIds.has(defaultAction.id)) continue
      btn.action = structuredClone(defaultAction)
      usedActionIds.add(defaultAction.id)
    }
  }

  return merged
}

/**
 * Merges a user's modified ViewsGroup with the vehicle default by appending default views.
 * User's existing views stay first so they don't see an immediate change.
 * @param {Profile} userProfile - The user's current ViewsGroup
 * @param {Profile} defaultProfile - The vehicle type default profile
 * @returns {Profile} The merged profile
 */
const mergeViewsGroups = (userProfile: Profile, defaultProfile: Profile): Profile => {
  const merged = structuredClone(userProfile)
  const defaultViews = structuredClone(defaultProfile.views)
  for (const view of defaultViews) {
    view.hash = uuid4()
  }
  merged.views.push(...defaultViews)
  return merged
}

/**
 * Imports or merges vehicle-type defaults into the current ViewsGroup and joystick mapping.
 * Only runs once per vehicle (tracked via a persisted key).
 * @param {MavType} vehicleType - The connected vehicle's type
 * @param {Profile} currentViewsGroup - The current ViewsGroup ref value
 * @param {JoystickProtocolActionsMapping} currentMapping - The current joystick mapping ref value
 * @returns {{ viewsGroup?: Profile; mapping?: JoystickProtocolActionsMapping }} The updated values, if changed
 */
export const importDefaultsForVehicle = (
  vehicleType: MavType,
  currentViewsGroup: Profile,
  currentMapping: JoystickProtocolActionsMapping
): {
  /**
   * The default views group for the vehicle type
   */
  viewsGroup?: Profile
  /**
   * The default joystick mapping for the vehicle type
   */
  mapping?: JoystickProtocolActionsMapping
} => {
  const alreadyImported = settingsManager.getKeyValue<Record<string, boolean>>(defaultsImportedKey)
  if (alreadyImported?.[vehicleType]) return {}

  const defaultVG = getDefaultViewsGroup(vehicleType)
  const defaultMap = getDefaultMapping(vehicleType)
  if (!defaultVG && !defaultMap) return {}

  const result: {
    /**
     * The merged views group for the vehicle type
     */
    viewsGroup?: Profile
    /**
     * The merged joystick mapping for the vehicle type
     */
    mapping?: JoystickProtocolActionsMapping
  } = {}
  const name = vehicleTypeName(vehicleType)

  if (defaultVG) {
    if (isViewsGroupBlank(currentViewsGroup)) {
      const imported = structuredClone(defaultVG)
      imported.hash = uuid4()
      imported.name = defaultVG.name.replace('default', 'User').replace('Default', 'User')
      for (const view of imported.views) {
        view.hash = uuid4()
      }
      result.viewsGroup = imported
      openSnackbar({ message: `Imported default views for ${name}.`, variant: 'success', duration: 5000 })
    } else {
      result.viewsGroup = mergeViewsGroups(currentViewsGroup, defaultVG)
      openSnackbar({
        message: `Merged default views for ${name} into your existing views.`,
        variant: 'success',
        duration: 5000,
      })
    }
  }

  if (defaultMap) {
    if (isMappingBlank(currentMapping)) {
      result.mapping = structuredClone(defaultMap)
      openSnackbar({
        message: `Imported default joystick mapping for ${name}.`,
        variant: 'success',
        duration: 5000,
      })
    } else {
      result.mapping = mergeJoystickMappings(currentMapping, defaultMap)
      openSnackbar({
        message: `Merged default joystick mapping for ${name} with your custom mapping.`,
        variant: 'success',
        duration: 5000,
      })
    }
  }

  const imported = alreadyImported ?? {}
  imported[vehicleType] = true
  settingsManager.setKeyValue(defaultsImportedKey, imported)

  return result
}
