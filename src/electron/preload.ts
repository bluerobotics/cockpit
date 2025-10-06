import { contextBridge, ipcRenderer } from 'electron'

import type { ElectronSDLJoystickControllerStateEventData } from '@/types/joystick'
import type { FileDialogOptions, FileStats } from '@/types/storage'

contextBridge.exposeInMainWorld('electronAPI', {
  getInfoOnSubnets: () => ipcRenderer.invoke('get-info-on-subnets'),
  getResourceUsage: () => ipcRenderer.invoke('get-resource-usage'),
  onUpdateAvailable: (callback: (info: any) => void) =>
    ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback: (info: any) => void) =>
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onCheckingForUpdate: (callback: () => void) => ipcRenderer.on('checking-for-update', () => callback()),
  onUpdateNotAvailable: (callback: (info: any) => void) =>
    ipcRenderer.on('update-not-available', (_event, info) => callback(info)),
  onDownloadProgress: (callback: (info: any) => void) =>
    ipcRenderer.on('download-progress', (_event, info) => callback(info)),
  onElectronSDLControllerJoystickStateChange: (callback: (data: ElectronSDLJoystickControllerStateEventData) => void) =>
    ipcRenderer.on('sdl-controller-joystick-state', (_event, data) => callback(data)),
  checkSDLStatus: () => ipcRenderer.invoke('check-sdl-status'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  cancelUpdate: () => ipcRenderer.send('cancel-update'),
  setItem: async (key: string, value: Blob, subFolders?: string[]) => {
    const arrayBuffer = await value.arrayBuffer()
    await ipcRenderer.invoke('setItem', { key, value: new Uint8Array(arrayBuffer), subFolders })
  },
  getItem: async (key: string, subFolders?: string[]) => {
    const arrayBuffer = await ipcRenderer.invoke('getItem', { key, subFolders })
    return arrayBuffer ? new Blob([arrayBuffer]) : null
  },
  removeItem: async (key: string, subFolders?: string[]) => {
    await ipcRenderer.invoke('removeItem', { key, subFolders })
  },
  clear: async (subFolders?: string[]) => {
    await ipcRenderer.invoke('clear', { subFolders })
  },
  keys: async (subFolders?: string[]) => {
    return await ipcRenderer.invoke('keys', { subFolders })
  },
  openCockpitFolder: () => ipcRenderer.invoke('open-cockpit-folder'),
  openVideoFolder: () => ipcRenderer.invoke('open-video-folder'),
  openVideoFile: (fileName: string) => ipcRenderer.invoke('open-video-file', fileName),
  openVideoChunksFolder: () => ipcRenderer.invoke('open-temp-video-chunks-folder'),
  getFileStats: (pathOrKey: string, subFolders?: string[]): Promise<FileStats> =>
    ipcRenderer.invoke('get-file-stats', pathOrKey, subFolders),
  getPathOfSelectedFile: (options?: FileDialogOptions) => ipcRenderer.invoke('get-path-of-selected-file', options),
  startVideoRecording: async (firstChunk: Blob, recordingHash: string, fileName: string, keepChunkBackup?: boolean) => {
    const chunkData = new Uint8Array(await firstChunk.arrayBuffer())
    return ipcRenderer.invoke('start-video-recording', chunkData, recordingHash, fileName, keepChunkBackup)
  },
  appendChunkToVideoRecording: async (processId: string, chunk: Blob, chunkNumber: number) => {
    const chunkData = new Uint8Array(await chunk.arrayBuffer())
    return ipcRenderer.invoke('append-chunk-to-video-recording', processId, chunkData, chunkNumber)
  },
  finalizeVideoRecording: (processId: string) => ipcRenderer.invoke('finalize-video-recording', processId),
  extractVideoChunksZip: (zipFilePath: string) => ipcRenderer.invoke('extract-video-chunks-zip', zipFilePath),
  readChunkFile: (chunkPath: string) => ipcRenderer.invoke('read-chunk-file', chunkPath),
  copyTelemetryFile: (assFilePath: string, outputVideoPath: string) =>
    ipcRenderer.invoke('copy-telemetry-file', assFilePath, outputVideoPath),
  createVideoChunksZip: (hash: string) => ipcRenderer.invoke('create-video-chunks-zip', hash),
  cleanupTempDir: (tempDir: string) => ipcRenderer.invoke('cleanup-temp-dir', tempDir),
  captureWorkspace: (rect?: Electron.Rectangle) => ipcRenderer.invoke('capture-workspace', rect),
  serialListPorts: () => ipcRenderer.invoke('serial-list-ports'),
  serialOpen: (path: string, baudRate?: number) => ipcRenderer.invoke('serial-open', { path, baudRate }),
  serialWrite: (path: string, data: Uint8Array) => ipcRenderer.invoke('serial-write', { path, data }),
  serialClose: (path: string) => ipcRenderer.invoke('serial-close', { path }),
  serialIsOpen: (path: string) => ipcRenderer.invoke('serial-is-open', { path }),
  /* eslint-disable jsdoc/require-jsdoc */
  onSerialData: (callback: (data: { path: string; data: number[] }) => void) => {
    ipcRenderer.on('serial-data', (_event, data) => callback(data))
  },
  linkOpen: (path: string) => ipcRenderer.invoke('link-open', { path }),
  linkWrite: (path: string, data: Uint8Array) => ipcRenderer.invoke('link-write', { path, data }),
  linkClose: (path: string) => ipcRenderer.invoke('link-close', { path }),
  onLinkData: (callback: (data: { path: string; data: number[] }) => void) => {
    ipcRenderer.on('link-data', (_event, data) => callback(data))
  },
  systemLog: (level: string, message: string) => ipcRenderer.send('system-log', { level, message }),
  getElectronLogs: () => ipcRenderer.invoke('get-electron-logs'),
  getElectronLogContent: (logName: string) => ipcRenderer.invoke('get-electron-log-content', logName),
  deleteElectronLog: (logName: string) => ipcRenderer.invoke('delete-electron-log', logName),
  deleteOldElectronLogs: () => ipcRenderer.invoke('delete-old-electron-logs'),
  setUserAgent: (userAgent: string) => ipcRenderer.invoke('set-user-agent', userAgent),
  restoreUserAgent: () => ipcRenderer.invoke('restore-user-agent'),
  getCurrentUserAgent: () => ipcRenderer.invoke('get-current-user-agent'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
})
