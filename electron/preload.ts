import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getInfoOnSubnets: () => ipcRenderer.invoke('get-info-on-subnets'),
  onUpdateAvailable: (callback: (info: any) => void) =>
    ipcRenderer.on('update-available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback: (info: any) => void) =>
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
  onCheckingForUpdate: (callback: () => void) => ipcRenderer.on('checking-for-update', () => callback()),
  onUpdateNotAvailable: (callback: (info: any) => void) =>
    ipcRenderer.on('update-not-available', (_event, info) => callback(info)),
  onDownloadProgress: (callback: (info: any) => void) =>
    ipcRenderer.on('download-progress', (_event, info) => callback(info)),
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
})
