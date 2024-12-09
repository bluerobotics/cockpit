import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getInfoOnSubnets: () => ipcRenderer.invoke('get-info-on-subnets'),
  setItem: async (key: string, value: Blob) => {
    const arrayBuffer = await value.arrayBuffer()
    await ipcRenderer.invoke('setItem', { key, value: new Uint8Array(arrayBuffer) })
  },
  getItem: async (key: string) => {
    const arrayBuffer = await ipcRenderer.invoke('getItem', key)
    return arrayBuffer ? new Blob([arrayBuffer]) : null
  },
  removeItem: async (key: string) => {
    await ipcRenderer.invoke('removeItem', key)
  },
  clear: async () => {
    await ipcRenderer.invoke('clear')
  },
  keys: async () => {
    return await ipcRenderer.invoke('keys')
  },
  iterate: async (callback: (value: Blob, key: string, iterationNumber: number) => void) => {
    await ipcRenderer.invoke('iterate', (_, data) => callback(data.value, data.key, data.iterationNumber))
  },
})
