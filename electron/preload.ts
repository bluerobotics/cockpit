import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
})
