import { isBrowser } from 'browser-or-node'

import { ElectronStorageDB } from '@/types/general'
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

  /**
   * Extended Window interface with custom dedicated dedicated APIs.
   */
  interface Window {
    /**
     * Exposed Cockpit APIs
     * E.g. data-lake, cockpit actions, etc.
     */
    cockpit: {
      // Data lake:

      /**
       * The object that holds the data-lake variables data
       */
      dataLakeVariableData: typeof dataLakeVariableData
      /**
       * Get data from an specific data lake variable
       * @param id - The id of the data to retrieve
       * @returns The data or undefined if not available
       */
      getDataLakeVariableData: typeof getDataLakeVariableData
      /**
       * Listen to data changes on a specific data lake variable
       * @param id - The id of the data to listen to
       * @param listener - The listener callback
       */
      listenDataLakeVariable: typeof listenDataLakeVariable
      /**
       * Stop listening to data changes on a specific data lake variable
       * @param id - The id of the data to stop listening to
       */
      unlistenDataLakeVariable: typeof unlistenDataLakeVariable
      /**
       * Get info about all variables in the data lake
       * @returns Data lake data
       */
      getAllDataLakeVariablesInfo: typeof getAllDataLakeVariablesInfo
      /**
       * Get info about a specific variable in the data lake
       * @param id - The id of the data to retrieve
       * @returns The data info or undefined if not available
       */
      getDataLakeVariableInfo: typeof getDataLakeVariableInfo
      /**
       * Set the value of an specific data lake variable
       * @param id - The id of the data to set
       * @param value - The value to set
       */
      setDataLakeVariableData: typeof setDataLakeVariableData
      /**
       * Create a new variable in the data lake
       * @param variable - The variable to create
       * @param initialValue - The initial value for the variable
       */
      createDataLakeVariable: typeof createDataLakeVariable
      /**
       * Update information about an specific data lake variable
       * @param variable - The variable to update
       */
      updateDataLakeVariableInfo: typeof updateDataLakeVariableInfo
      /**
       * Delete a variable from the data lake
       * @param id - The id of the variable to delete
       */
      deleteDataLakeVariable: typeof deleteDataLakeVariable

      // Cockpit actions:

      /**
       * Get all available cockpit actions
       * @returns Available cockpit actions
       */
      availableCockpitActions: typeof availableCockpitActions
      /**
       * Register a new cockpit action
       * @param action - The action to register
       */
      registerNewAction: typeof registerNewAction
      /**
       * Delete a cockpit action
       * @param id - The id of the action to delete
       */
      deleteAction: typeof deleteAction
      /**
       * Register a callback for a cockpit action
       * @param action - The action to register the callback for
       * @param callback - The callback to register
       */
      registerActionCallback: typeof registerActionCallback
      /**
       * Unregister a callback for a cockpit action
       * @param id - The id of the action to unregister the callback for
       */
      unregisterActionCallback: typeof unregisterActionCallback
      /**
       * Execute the callback for a cockpit action
       * @param id - The id of the action to execute the callback for
       */
      executeActionCallback: typeof executeActionCallback
    }
    /**
     * Electron API exposed through preload script
     */
    electronAPI?: ElectronStorageDB & {
      /**
       * Get network information from the main process
       * @returns Promise containing subnet information
       */
      getInfoOnSubnets: () => Promise<NetworkInfo[]>
      /**
       * Register callback for update available event
       */
      onUpdateAvailable: (callback: (info: any) => void) => void
      /**
       * Register callback for update downloaded event
       */
      onUpdateDownloaded: (callback: (info: any) => void) => void
      /**
       * Trigger update download
       */
      downloadUpdate: () => void
      /**
       * Trigger update installation
       */
      installUpdate: () => void
      /**
       * Cancel ongoing update
       */
      cancelUpdate: () => void
      /**
       * Register callback for checking for update event
       */
      onCheckingForUpdate: (callback: () => void) => void
      /**
       * Register callback for update not available event
       */
      onUpdateNotAvailable: (callback: (info: any) => void) => void
      /**
       * Register callback for download progress event
       */
      onDownloadProgress: (callback: (info: any) => void) => void
      /**
       * Open cockpit folder
       */
      openCockpitFolder: () => void
      /**
       * Open video folder
       */
      openVideoFolder: () => void
    }
  }
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
