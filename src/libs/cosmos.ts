import { isBrowser } from 'browser-or-node'

import { NetworkInfo } from '@/types/network'

import {
  createDataLakeVariable,
  dataLakeVariableData,
  deleteDataLakeVariable,
  getAllDataLakeVariablesInfo,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
  updateDataLakeVariableInfo,
} from './actions/data-lake'
import {
  availableCockpitActions,
  deleteAction,
  executeActionCallback,
  registerActionCallback,
  registerNewAction,
  unregisterActionCallback,
} from './joystick/protocols/cockpit-actions'

declare global {
  /**
   * Running time assert for development
   * @param {boolean} result
   * @param {string?} message
   * @returns {void}
   */
  function assert(result: boolean, message?: string): void

  /**
   * Warn developer when something is not implemented
   * @param {string} message
   * @returns {void}
   */
  function unimplemented(message?: string): void

  /**
   * Helper to avoid unused warnings
   * @template T
   * @param {T} variable
   * @returns {void}
   */
  function unused<T>(variable: T): void

  /**
   * Expand Array interface for internal usage
   */
  interface Array<T> {
    /**
     * Return the first element of array
     * @returns T | undefined
     */
    first(): T | undefined

    /**
     * Check if array is empty
     * @returns boolean
     */
    isEmpty(): boolean

    /**
     * Return the last element of array
     * @returns T | undefined
     */
    last(): T | undefined

    /**
     * Return a random element if available
     * @returns T | undefined
     */
    random(): T | undefined

    /**
     * Return the sum of all ements
     * @returns number
     */
    sum(): number
  }

  /* eslint-disable jsdoc/require-jsdoc */
  interface Window {
    cockpit: {
      // Data lake:
      dataLakeVariableData: typeof dataLakeVariableData
      getDataLakeVariableData: typeof getDataLakeVariableData
      listenDataLakeVariable: typeof listenDataLakeVariable
      unlistenDataLakeVariable: typeof unlistenDataLakeVariable
      getAllDataLakeVariablesInfo: typeof getAllDataLakeVariablesInfo
      getDataLakeVariableInfo: typeof getDataLakeVariableInfo
      setDataLakeVariableData: typeof setDataLakeVariableData
      createDataLakeVariable: typeof createDataLakeVariable
      updateDataLakeVariableInfo: typeof updateDataLakeVariableInfo
      deleteDataLakeVariable: typeof deleteDataLakeVariable
      // Cockpit actions:
      availableCockpitActions: typeof availableCockpitActions
      registerNewAction: typeof registerNewAction
      deleteAction: typeof deleteAction
      registerActionCallback: typeof registerActionCallback
      unregisterActionCallback: typeof unregisterActionCallback
      executeActionCallback: typeof executeActionCallback
    }
    /**
     * Electron API exposed through preload script
     */
    electronAPI?: {
      /**
       * Get network information from the main process
       * @returns Promise containing subnet information
       */
      getInfoOnSubnets: () => Promise<NetworkInfo[]>
    }
  }
  /* eslint-enable jsdoc/require-jsdoc */
}

// Use global as window when running for browsers
if (isBrowser) {
  var global = window /* eslint-disable-line */
}

// Expose data-lake and cockpit action methods to the global scope under a "cockpit" property
window.cockpit = {
  // Data lake:
  dataLakeVariableData: dataLakeVariableData,
  getDataLakeVariableData: getDataLakeVariableData,
  listenDataLakeVariable: listenDataLakeVariable,
  unlistenDataLakeVariable: unlistenDataLakeVariable,
  getAllDataLakeVariablesInfo: getAllDataLakeVariablesInfo,
  getDataLakeVariableInfo: getDataLakeVariableInfo,
  setDataLakeVariableData: setDataLakeVariableData,
  createDataLakeVariable: createDataLakeVariable,
  updateDataLakeVariableInfo: updateDataLakeVariableInfo,
  deleteDataLakeVariable: deleteDataLakeVariable,
  // Cockpit actions:
  availableCockpitActions: availableCockpitActions,
  registerNewAction: registerNewAction,
  deleteAction: deleteAction,
  registerActionCallback: registerActionCallback,
  unregisterActionCallback: unregisterActionCallback,
  executeActionCallback: executeActionCallback,
}

/* c8 ignore start */

// Global functions
// Global is defined to support both node and browser
global!.assert = function (result: boolean, message?: string) {
  if (!result) throw new Error(message ?? 'Assert failed')
}

global!.unimplemented = function (message?: string) {
  console.debug(new Error(message ?? 'Not implemented'))
}

// eslint-disable-next-line
global!.unused = function <T>(variable: T) {} // eslint-disable-line

/* c8 ignore stop */

// Extend types
Array.prototype.first = function <T>(this: T[]): T | undefined {
  return this.isEmpty() ? undefined : this[0]
}

Array.prototype.last = function <T>(this: T[]): T | undefined {
  return this.isEmpty() ? undefined : this[this.length - 1]
}

Array.prototype.isEmpty = function <T>(this: T[]): boolean {
  return this.length === 0
}

Array.prototype.random = function <T>(this: T[]): T | undefined {
  return this[Math.floor(Math.random() * this.length)]
}

Array.prototype.sum = function (this: number[]): number {
  return this.reduce((a, b) => a + b, 0)
}

declare const __APP_VERSION__: string
declare const __APP_VERSION_DATE__: string
declare const __APP_VERSION_LINK__: string

/**
 * Interface representing version information for the application
 */
export interface AppVersionInfo {
  /**
   * @property {string} version - The version number or commit hash of the application, or 'unknown' in last case.
   * If the version is a tag prefixed with "v", it is stripped.
   * If a tag is not found, the commit hash is used.
   * If a commit hash is not found, 'unknown' is used.
   */
  version: string
  /**
   * @property {string} date - The release date for tags or commit date for commits
   */
  date: string
  /**
   * @property {string} link - URL to the GitHub release page for tags or commit page for commits
   */
  link: string
}
export const app_version: AppVersionInfo = {
  version: __APP_VERSION__,
  date: __APP_VERSION_DATE__,
  link: __APP_VERSION_LINK__,
}

export default global!
