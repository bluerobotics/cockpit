import { v4 as uuid4 } from 'uuid'
import { toRaw } from 'vue'

import { blankViewsGroup, defaultProfileVehicleCorrespondency, widgetProfiles } from '@/assets/defaults'
import {
  blankMapping,
  cockpitStandardToProtocols,
  defaultProtocolMappingVehicleCorrespondency,
} from '@/assets/joystick-profiles'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { OtherProtocol } from '@/libs/joystick/protocols/other'
import type { JoystickProtocolActionsMapping } from '@/types/joystick'
import type { Profile, View } from '@/types/widgets'

// Proxy-safe deep clone; structuredClone can't handle Vue reactivity wrappers or function references that
// may end up inside the stored mappings/views (seen in the wild when importing defaults crashes the renderer).
const safeClone = <T>(value: T): T => JSON.parse(JSON.stringify(toRaw(value)))

/**
 * Proxy-safe deep clone of a joystick mapping. Use this whenever the import flow needs a detached
 * copy (current or default) before mutating it.
 * @param {JoystickProtocolActionsMapping} mapping - The mapping to clone
 * @returns {JoystickProtocolActionsMapping} A detached copy
 */
export const cloneMapping = (mapping: JoystickProtocolActionsMapping): JoystickProtocolActionsMapping =>
  safeClone(mapping)

/**
 * Assigns fresh hashes to a view and every widget in it so Vue remounts after a profile replace.
 * @param {View} view - View to re-hash
 */
const rehashViewAndWidgets = (view: View): void => {
  view.hash = uuid4()
  for (const widget of view.widgets) {
    widget.hash = uuid4()
  }
  for (const container of view.miniWidgetContainers) {
    for (const miniWidget of container.widgets) {
      miniWidget.hash = uuid4()
    }
  }
}

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

export const isViewsGroupBlank = (profile: Profile): boolean => {
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

export const isMappingBlank = (mapping: JoystickProtocolActionsMapping): boolean => {
  for (const [axisKey, corr] of Object.entries(mapping.axesCorrespondencies)) {
    if (corr.action.id !== OtherProtocol.no_function) return false
    const blankCorr =
      blankMapping.axesCorrespondencies[axisKey as unknown as keyof typeof blankMapping.axesCorrespondencies]
    if (blankCorr && (corr.min !== blankCorr.min || corr.max !== blankCorr.max)) return false
  }
  for (const buttons of Object.values(mapping.buttonsCorrespondencies)) {
    for (const btn of Object.values(buttons)) {
      if (btn.action.id !== OtherProtocol.no_function) return false
    }
  }
  return true
}

/**
 * Human-readable label for a vehicle type, used in snackbars and dialog copy.
 * @param {MavType} vehicleType - The vehicle type
 * @returns {string} Friendly label, falling back to the raw enum value
 */
export const vehicleTypeName = (vehicleType: MavType): string => {
  const names: Partial<Record<MavType, string>> = {
    [MavType.MAV_TYPE_SUBMARINE]: 'Submarine / ROV',
    [MavType.MAV_TYPE_SURFACE_BOAT]: 'Boat',
    [MavType.MAV_TYPE_QUADROTOR]: 'Aerial (MAV)',
  }
  return names[vehicleType] ?? vehicleType
}

/**
 * The action the defaults flow should take for a given side (views or joystick).
 * - `auto-import`: the user has no real configuration, silently import the defaults.
 * - `offer`: the user has some configuration but it doesn't sufficiently overlap with the defaults,
 *   present them with a dialog so they can opt in.
 * - `skip`: either there is no default for this vehicle type, or the user already has the defaults
 *   (or something close enough); do nothing.
 */
export type DefaultsAction = 'auto-import' | 'offer' | 'skip'

/**
 * Evaluation result for the views side of the defaults flow.
 */
export interface ViewsDefaultsEvaluation {
  /** The action to take for the views group */
  action: DefaultsAction
  /** The default views group available for this vehicle type, when one exists */
  defaultProfile?: Profile
}

/**
 * Evaluation result for the joystick side of the defaults flow.
 *
 * The decision intentionally ignores buttons — only axes are considered, because axes drive motors
 * and an axis mapping that deviates meaningfully from the vehicle default can be dangerous.
 */
export interface JoystickDefaultsEvaluation {
  /** The action to take for the joystick mapping */
  action: DefaultsAction
  /** The default joystick mapping available for this vehicle type, when one exists */
  defaultMapping?: JoystickProtocolActionsMapping
  /** Default axis functions (excluding no_function) not present anywhere in the user's axes */
  missingAxisFunctions: number
  /** Default axis functions present in the user's axes but with a min or max outside the allowed tolerance of the default */
  axisFunctionsWithRangeMismatch: number
}

/**
 * Combined evaluation describing what the defaults-import flow should do for a vehicle.
 */
export interface DefaultsEvaluation {
  /** The vehicle type that was evaluated */
  vehicleType: MavType
  /** Friendly label for the vehicle type, suitable for UI copy */
  vehicleTypeName: string
  /** Evaluation for the views side */
  views: ViewsDefaultsEvaluation
  /** Evaluation for the joystick side */
  joystick: JoystickDefaultsEvaluation
}

/**
 * Returns true when the user already has at least one view whose name matches one of the default
 * views' names. Used as a heuristic for "the user already has these defaults (possibly customized)".
 * @param {Profile} currentViewsGroup - The user's current ViewsGroup
 * @param {Profile} defaultProfile - The vehicle-type default profile
 * @returns {boolean} True when at least one name matches
 */
export const userViewNamesMatchAnyDefault = (currentViewsGroup: Profile, defaultProfile: Profile): boolean => {
  const userNames = new Set(currentViewsGroup.views.map((v) => v.name))
  return defaultProfile.views.some((v) => userNames.has(v.name))
}

/**
 * Maximum allowed deviation for either endpoint (min or max) of a user-mapped axis range,
 * expressed as a fraction of the default's full range `|defaultMax - defaultMin|`. Applied as a
 * single absolute tolerance to both endpoints, so the comparison stays well-defined even when the
 * default endpoint is 0 (e.g. the ROV `axis_z` max).
 *
 * Example: default min = +1000, max = 0 → range = 1000, tolerance = 50 → the user's min must lie
 * in [950, 1050] and max in [-50, +50].
 */
const axisRangeTolerance = 0.05

/**
 * Counts the default axis functions (excluding `no_function`) that don't appear on any of the
 * user's axes. Position is ignored — the user is free to put `axis_x` on whichever physical axis
 * they prefer, as long as it's present somewhere.
 * @param {JoystickProtocolActionsMapping} currentMapping - The user's current mapping
 * @param {JoystickProtocolActionsMapping} defaultMapping - The vehicle-type default mapping
 * @returns {number} How many default axis functions are not present in the user's mapping
 */
export const countMissingDefaultAxisFunctions = (
  currentMapping: JoystickProtocolActionsMapping,
  defaultMapping: JoystickProtocolActionsMapping
): number => {
  const currentAxisFunctionIds = new Set(
    Object.values(currentMapping.axesCorrespondencies)
      .map((corr) => corr.action.id)
      .filter((id) => id !== OtherProtocol.no_function)
  )
  let missing = 0
  for (const defaultCorr of Object.values(defaultMapping.axesCorrespondencies)) {
    if (defaultCorr.action.id === OtherProtocol.no_function) continue
    if (!currentAxisFunctionIds.has(defaultCorr.action.id)) missing++
  }
  return missing
}

type AxisCorrespondence =
  JoystickProtocolActionsMapping['axesCorrespondencies'][keyof JoystickProtocolActionsMapping['axesCorrespondencies']]

/**
 * For each default axis function present in the user's mapping, checks whether the user's axis
 * range (min/max) is within {@link axisRangeTolerance} of the default. Default functions that the
 * user doesn't have at all are skipped — they're already accounted for by
 * {@link countMissingDefaultAxisFunctions}.
 *
 * When the user has the same function on multiple axes, the first occurrence is used.
 * @param {JoystickProtocolActionsMapping} currentMapping - The user's current mapping
 * @param {JoystickProtocolActionsMapping} defaultMapping - The vehicle-type default mapping
 * @returns {number} How many present-in-both axis functions have a range outside the tolerance
 */
export const countAxisFunctionRangeMismatches = (
  currentMapping: JoystickProtocolActionsMapping,
  defaultMapping: JoystickProtocolActionsMapping
): number => {
  const currentCorrByFunctionId = new Map<string, AxisCorrespondence>()
  for (const corr of Object.values(currentMapping.axesCorrespondencies)) {
    if (corr.action.id === OtherProtocol.no_function) continue
    if (!currentCorrByFunctionId.has(corr.action.id)) {
      currentCorrByFunctionId.set(corr.action.id, corr)
    }
  }

  let mismatches = 0
  for (const defaultCorr of Object.values(defaultMapping.axesCorrespondencies)) {
    if (defaultCorr.action.id === OtherProtocol.no_function) continue
    const currentCorr = currentCorrByFunctionId.get(defaultCorr.action.id)
    if (!currentCorr) continue
    const tolerance = axisRangeTolerance * Math.abs(defaultCorr.max - defaultCorr.min)
    if (
      Math.abs(currentCorr.min - defaultCorr.min) > tolerance ||
      Math.abs(currentCorr.max - defaultCorr.max) > tolerance
    ) {
      mismatches++
    }
  }
  return mismatches
}

/**
 * Decides what the defaults flow should do for the connected vehicle, per side. The decision is
 * derived from the connected vehicle type, the user's current ViewsGroup, and their current joystick
 * mapping — not from any stored "have we already done this" flag, which is the caller's
 * responsibility to track per vehicle.
 *
 * Rules:
 * - Views: blank → `auto-import`; any user view name matches a default view name → `skip`;
 *   otherwise → `offer`.
 * - Joystick (buttons are intentionally ignored — only axes are checked, since axes drive motors):
 *   blank → `auto-import`; user has every default axis function (regardless of which physical axis
 *   it's mapped to) AND every shared axis function has min and max within
 *   {@link axisRangeTolerance} of the default → `skip`; otherwise → `offer`.
 * - Either side becomes `skip` if there is no default available for this vehicle type.
 * @param {MavType} vehicleType - The connected vehicle's type
 * @param {Profile} currentViewsGroup - The user's current ViewsGroup
 * @param {JoystickProtocolActionsMapping} currentMapping - The user's current joystick mapping
 * @returns {DefaultsEvaluation} What to do per side, plus the relevant defaults for callers to act on
 */
export const evaluateDefaults = (
  vehicleType: MavType,
  currentViewsGroup: Profile,
  currentMapping: JoystickProtocolActionsMapping
): DefaultsEvaluation => {
  const defaultProfile = getDefaultViewsGroup(vehicleType)
  const defaultMapping = getDefaultMapping(vehicleType)

  let viewsAction: DefaultsAction = 'skip'
  if (defaultProfile) {
    if (isViewsGroupBlank(currentViewsGroup)) {
      viewsAction = 'auto-import'
    } else if (!userViewNamesMatchAnyDefault(currentViewsGroup, defaultProfile)) {
      viewsAction = 'offer'
    }
  }

  let joystickAction: DefaultsAction = 'skip'
  let missingAxisFunctions = 0
  let axisFunctionsWithRangeMismatch = 0
  if (defaultMapping) {
    if (isMappingBlank(currentMapping)) {
      joystickAction = 'auto-import'
    } else {
      missingAxisFunctions = countMissingDefaultAxisFunctions(currentMapping, defaultMapping)
      axisFunctionsWithRangeMismatch = countAxisFunctionRangeMismatches(currentMapping, defaultMapping)
      if (missingAxisFunctions > 0 || axisFunctionsWithRangeMismatch > 0) joystickAction = 'offer'
    }
  }

  return {
    vehicleType,
    vehicleTypeName: vehicleTypeName(vehicleType),
    views: { action: viewsAction, defaultProfile },
    joystick: {
      action: joystickAction,
      defaultMapping,
      missingAxisFunctions,
      axisFunctionsWithRangeMismatch,
    },
  }
}

/**
 * Builds a brand-new ViewsGroup from the vehicle-type default, suitable for replacing a blank or
 * existing ViewsGroup. Re-hashes the profile and each view so they don't collide with any historical
 * data, and renames the profile from "... default" to "... User" to match the snackbar messaging.
 * @param {Profile} defaultProfile - The vehicle-type default profile
 * @returns {Profile} A fresh ViewsGroup ready to assign to the widget store
 */
export const buildFreshViewsGroupFromDefault = (defaultProfile: Profile): Profile => {
  const fresh = safeClone(defaultProfile)
  fresh.hash = uuid4()
  fresh.name = defaultProfile.name.replace('default', 'User').replace('Default', 'User')
  for (const view of fresh.views) {
    rehashViewAndWidgets(view)
  }
  return fresh
}

/**
 * Returns a copy of the user's ViewsGroup with the selected default views appended at the end.
 * Each appended view receives a fresh hash so it cannot collide with any pre-existing one.
 * @param {Profile} currentViewsGroup - The user's current ViewsGroup
 * @param {Profile} defaultProfile - The vehicle-type default profile
 * @param {string[]} selectedViewNames - Names of the default views the user chose to append
 * @returns {Profile} The new ViewsGroup with the selected default views appended
 */
export const buildAppendedViewsGroup = (
  currentViewsGroup: Profile,
  defaultProfile: Profile,
  selectedViewNames: string[]
): Profile => {
  const merged = safeClone(currentViewsGroup)
  const selected = new Set(selectedViewNames)
  const viewsToAppend = safeClone(defaultProfile.views).filter((v) => selected.has(v.name))
  for (const view of viewsToAppend) {
    rehashViewAndWidgets(view)
  }
  merged.views.push(...viewsToAppend)
  return merged
}

/**
 * Returns a fresh ViewsGroup containing only the selected default views, intended to fully replace
 * the user's current ViewsGroup. The caller must have confirmed the destructive intent already.
 * @param {Profile} defaultProfile - The vehicle-type default profile
 * @param {string[]} selectedViewNames - Names of the default views the user chose to keep
 * @returns {Profile} A new ViewsGroup ready to replace the existing one
 */
export const buildReplacementViewsGroup = (defaultProfile: Profile, selectedViewNames: string[]): Profile => {
  const replacement = safeClone(defaultProfile)
  const selected = new Set(selectedViewNames)
  replacement.views = replacement.views.filter((v) => selected.has(v.name))
  replacement.hash = uuid4()
  replacement.name = defaultProfile.name.replace('default', 'User').replace('Default', 'User')
  for (const view of replacement.views) {
    rehashViewAndWidgets(view)
  }
  return replacement
}

/**
 * Builds the ViewsGroup that would result from the user's import choices (append or replace).
 * @param {Profile} currentViewsGroup - The user's current ViewsGroup
 * @param {Profile} defaultProfile - The vehicle-type default profile
 * @param {string[]} selectedViewNames - Names of the default views the user chose to import
 * @param {'append' | 'replace'} mode - Whether to append or replace when the current group is not blank
 * @param {boolean} currentBlank - Whether the current ViewsGroup is blank
 * @returns {Profile} The ViewsGroup after applying the import
 */
export const buildViewsGroupAfterImport = (
  currentViewsGroup: Profile,
  defaultProfile: Profile,
  selectedViewNames: string[],
  mode: 'append' | 'replace',
  currentBlank: boolean
): Profile => {
  if (selectedViewNames.length === 0) {
    return safeClone(currentViewsGroup)
  }
  const effectiveMode = currentBlank ? 'replace' : mode
  if (effectiveMode === 'replace') {
    if (selectedViewNames.length === defaultProfile.views.length && currentBlank) {
      return buildFreshViewsGroupFromDefault(defaultProfile)
    }
    return buildReplacementViewsGroup(defaultProfile, selectedViewNames)
  }
  return buildAppendedViewsGroup(currentViewsGroup, defaultProfile, selectedViewNames)
}

/**
 * Returns a clean copy of the vehicle default mapping, intended to fully replace the user's current
 * mapping. The caller must have confirmed the destructive intent already.
 * @param {JoystickProtocolActionsMapping} defaultMapping - The vehicle-type default mapping
 * @returns {JoystickProtocolActionsMapping} A fresh mapping ready to replace the existing one
 */
export const buildReplacementMapping = (
  defaultMapping: JoystickProtocolActionsMapping
): JoystickProtocolActionsMapping => cloneMapping(defaultMapping)
