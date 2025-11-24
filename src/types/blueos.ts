/* eslint-disable jsdoc/require-jsdoc  */

import { type ActionConfig } from '@/libs/joystick/protocols/cockpit-actions'
import { JoystickMapSuggestionGroup } from '@/types/joystick'
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
