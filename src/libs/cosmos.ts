import { isBrowser } from 'browser-or-node'

import { type ElectronLog } from '@/types/electron-general'
import { ElectronStorageDB } from '@/types/general'
import type { ElectronSDLJoystickControllerStateEventData } from '@/types/joystick'
import { NetworkInfo } from '@/types/network'
import { SDLStatus } from '@/types/sdl'
import type { SerialData } from '@/types/serial'
import type { FileDialogOptions, FileStats } from '@/types/storage'

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
       * Get memory usage information from the main process
       * @returns Promise containing memory usage data
       */
      getResourceUsage: () => Promise<{
        /**
         * The total memory usage of the application in MB
         */
        totalMemoryMB: number
        /**
         * The main process memory usage in MB
         */
        mainMemoryMB: number
        /**
         * The total renderer processes memory usage in MB
         */
        renderersMemoryMB: number
        /**
         * The GPU process memory usage in MB
         */
        gpuMemoryMB: number
        /**
         * The CPU usage percentage
         */
        cpuUsagePercent: number
      }>
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
       * Register callback for joystick state updates
       */
      onElectronSDLControllerJoystickStateChange: (
        callback: (data: ElectronSDLJoystickControllerStateEventData) => void
      ) => void
      /**
       * Check if SDL was loaded successfully
       * @returns Promise with SDL load status
       */
      checkSDLStatus: () => Promise<SDLStatus>
      /**
       * Open cockpit folder
       */
      openCockpitFolder: () => void
      /**
       * Open video folder
       */
      openVideoFolder: () => void
      /**
       * Open a video file in the system's default video player
       * @param fileName - The name of the video file to open
       */
      openVideoFile: (fileName: string) => void
      /**
       * Open temporary chunks folder
       */
      openVideoChunksFolder: () => void
      /**
       * Get file stats for a file
       * @param pathOrKey - Either a full file path, or a key (filename) if subFolders is provided
       * @param subFolders - Optional subfolders under cockpit folder (if provided, pathOrKey is treated as a key)
       */
      getFileStats: (pathOrKey: string, subFolders?: string[]) => Promise<FileStats>
      /**
       * Show file dialog to select a file
       * @param options - Optional dialog configuration
       * @returns The selected file path, or null if cancelled
       */
      getPathOfSelectedFile: (options?: FileDialogOptions) => Promise<string | null>
      /**
       * Capture the workspace area of the application
       */
      captureWorkspace(rect?: Electron.Rectangle): Promise<Uint8Array>
      /**
       * Open a link connection
       */
      linkOpen: (path: string) => Promise<boolean>
      /**
       * Write data to a link connection
       */
      linkWrite: (path: string, data: Uint8Array) => Promise<boolean>
      /**
       * Close a link connection
       */
      linkClose: (path: string) => Promise<boolean>
      /**
       * Register callback for link data events
       */
      onLinkData: (callback: (data: SerialData) => void) => void
      /**
       * Send a log message to electron-log
       * @param level - The log level (error, warn, info, debug, trace, log)
       * @param message - The message to log
       */
      systemLog: (level: string, message: string) => void
      /**
       * Get a list of all electron logs
       */
      getElectronLogs: () => Promise<ElectronLog[]>
      /**
       * Get specific electron log content
       * @param logName - The name of the log file
       */
      getElectronLogContent: (logName: string) => Promise<string>
      /**
       * Delete a specific electron log
       * @param logName - The name of the log file to delete
       */
      deleteElectronLog: (logName: string) => Promise<boolean>
      /**
       * Delete old electron logs (older than 1 day)
       */
      deleteOldElectronLogs: () => Promise<string[]>
      /**
       * Set a custom User-Agent for HTTP requests
       * @param userAgent - The custom User-Agent string
       */
      setUserAgent: (userAgent: string) => void
      /**
       * Restore the original User-Agent
       */
      restoreUserAgent: () => void
      /**
       * Get the current User-Agent
       * @returns The current User-Agent string
       */
      getCurrentUserAgent: () => string
      /**
       * Get system information including platform and architecture
       * @returns Promise containing system information
       */
      getSystemInfo: () => Promise<{
        /**
         * The platform of the system. Possibilities can be found in the Platform enum.
         */
        platform: string
        /**
         * The architecture of the system. Possibilities can be found in the Architecture enum.
         */
        arch: string
        /**
         * The architecture of the process. Possibilities can be found in the Architecture enum.
         */
        processArch: string
      }>
      /**
       * Start live video streaming process with FFmpeg
       * @param firstChunk - The first video chunk blob
       * @param recordingHash - Unique identifier for this recording
       * @param fileName - The name of the video file
       * @param keepChunkBackup - Whether to keep raw chunks as backup (optional, default: true)
       * @returns Promise resolving to process ID and output path
       */
      startVideoRecording: (
        firstChunk: Blob,
        recordingHash: string,
        fileName: string,
        keepChunkBackup?: boolean
      ) => Promise<import('@/types/video').LiveConcatProcessResult>
      /**
       * Append chunk to live video stream (pipes to FFmpeg stdin)
       * @param processId - The ID of the live streaming process
       * @param chunk - The video chunk blob to append
       * @param chunkNumber - Sequential number of this chunk
       */
      appendChunkToVideoRecording: (processId: string, chunk: Blob, chunkNumber: number) => Promise<void>
      /**
       * Delete chunk
       * @param hash - The hash of the video chunk to delete
       * @param chunkNumber - The number of the video chunk to delete
       */
      deleteChunk: (hash: string, chunkNumber: number) => Promise<void>
      /**
       * Finalize live video streaming by closing FFmpeg stdin
       * @param processId - The ID of the streaming process
       */
      finalizeVideoRecording: (processId: string) => Promise<void>
      /**
       * Extract video chunks from ZIP file
       * @param zipFilePath - Path to the ZIP file
       * @returns Promise resolving to extraction result with chunk paths and metadata
       */
      extractVideoChunksZip: (zipFilePath: string) => Promise<import('@/types/video').ZipExtractionResult>
      /**
       * Read chunk file and return as Uint8Array
       * @param chunkPath - Path to the chunk file
       * @returns Promise resolving to chunk data
       */
      readChunkFile: (chunkPath: string) => Promise<Uint8Array>
      /**
       * Copy telemetry file to video output directory
       * @param assFilePath - Path to the .ass telemetry file
       * @param outputVideoPath - Path to the output video file
       */
      copyTelemetryFile: (assFilePath: string, outputVideoPath: string) => Promise<void>
      /**
       * Create a ZIP file containing video chunks and telemetry file
       * @param hash - The hash identifier for the chunk group
       * @returns Promise resolving to the path to the created ZIP file
       */
      createVideoChunksZip: (hash: string) => Promise<string>
      /**
       * Clean up temporary directory
       * @param tempDir - Path to the temporary directory to remove
       */
      cleanupTempDir: (tempDir: string) => Promise<void>
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
