/* eslint-disable jsdoc/require-jsdoc  */

import { type ActionConfig } from '@/types/cockpit-actions'
import { CockpitModifierKeyOption, JoystickProtocol } from '@/types/joystick'
import { ExternalWidgetSetupInfo } from '@/types/widgets'

/**
 * Information about the temperature of the BlueOS CPU
 */
export type RawCpuTempInfo = {
  name: string
  temperature: number
  maximum_temperature: number
  critical_temperature: number
}

/**
 * Information about each CPU core in BlueOS
 */
export type RawCpuLoadInfo = {
  name: string
  usage: number
  frequency: number
}

/**
 * Information about the network interfaces in BlueOS
 */
export type RawNetworkInfo = {
  name: string
  description: string
  mac: string
  ips: string[]
  is_up: boolean
  is_loopback: boolean
  received_B: number
  total_received_B: number
  transmitted_B: number
  total_transmitted_B: number
  packets_received: number
  total_packets_received: number
  packets_transmitted: number
  total_packets_transmitted: number
  errors_on_received: number
  total_errors_on_received: number
  errors_on_transmitted: number
  total_errors_on_transmitted: number
}

/**
 * Cockpits extra json format. Taken from extensions in BlueOS and (eventually) other places
 */
export interface ExtrasJson {
  /**
   *  The version of the cockpit API that the extra json is compatible with
   */
  targetCockpitApiVersion: string
  /**
   *  The target system that the extra json is compatible with, in our case, "cockpit"
   */
  targetSystem: string
  /**
   *  A list of widgets that the extra json contains. src/types/widgets.ts
   */
  widgets: ExternalWidgetSetupInfo[]
  /**
   * A list of available cockpit actions offered by the extension.
   */
  actions: ActionConfig[]
  /**
   * A list of joystick map suggestion groups offered by the extension.
   */
  joystickSuggestions?: JoystickMapSuggestionGroup[]
}

/**
 * Service object from BlueOS
 */
export interface Service {
  /**
   * Metadata of the service
   */
  metadata?: {
    /**
     * Extras of the service
     */
    extras?: {
      /**
       * Cockpit extra json url
       */
      cockpit?: string
    } | null
    /**
     * Works in relative paths
     */
    worksInRelativePaths?: boolean
    /**
     * Sanitized name of the service
     */
    sanitizedName?: string
  } | null
  /**
   * Port of the service
   */
  port?: number
}

/**
 * Error returned by BlueOS when a bag of holdings is not found
 */
export interface BagOfHoldingsError extends Error {
  /**
   * Details about the error
   */
  detail: string
}

/**
 * Actions from a BlueOS extension
 */
export type ActionsFromExtension = {
  /**
   * The name of the extension that is offering the actions
   */
  extensionName: string
  /**
   * The action configs from the extension
   */
  actionConfigs: ActionConfig[]
}

export const NoPathInBlueOsErrorName = 'NoPathInBlueOS'

/**
 * Joystick map suggestion from BlueOS extensions
 */
export interface JoystickMapSuggestion {
  /**
   * Unique identifier for this suggestion
   */
  id: string
  /**
   * Protocol of the action to be mapped (e.g. cockpit-action, data-lake-variable, etc.)
   */
  actionProtocol: JoystickProtocol
  /**
   * Human-readable name of the action to be mapped
   */
  actionName: string
  /**
   * Unique identifier for the action to be mapped
   */
  actionId: string
  /**
   * The button number (in Cockpit standard mapping) to map the action to
   */
  button: number
  /**
   * The modifier key for this suggestion (regular or shift)
   */
  modifier: CockpitModifierKeyOption
  /**
   * Optional description of what the action does
   */
  description?: string
}

/**
 * A group of joystick button mapping suggestions
 */
export interface JoystickMapSuggestionGroup {
  /**
   * Unique identifier for the suggestion group
   */
  id: string
  /**
   * Display name for the suggestion group
   */
  name: string
  /**
   * Optional description for the suggestion group
   */
  description?: string
  /**
   * List of button mapping suggestions in this group
   */
  buttonMappingSuggestions: JoystickMapSuggestion[]
  /**
   * Optional list of joystick profile hashes this group targets
   */
  targetVehicleTypes?: string[]
}

/**
 * Joystick map suggestions grouped by extension
 */
export interface JoystickMapSuggestionsFromExtension {
  /**
   * Name of the extension offering these suggestions
   */
  extensionName: string
  /**
   * Array of suggestions from this extension
   */
  suggestions: JoystickMapSuggestion[]
}

/**
 * Joystick map suggestion groups from extension
 */
export interface JoystickMapSuggestionGroupsFromExtension {
  /**
   * Name of the extension offering these suggestion groups
   */
  extensionName: string
  /**
   * Array of suggestion groups from this extension
   */
  suggestionGroups: JoystickMapSuggestionGroup[]
}
