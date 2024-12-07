import type { StorageDB } from '@/types/general'

import { isElectron } from '../utils'

const throwIfNotElectron = (): void => {
  if (!isElectron()) {
    console.warn('Filesystem storage is only available in Electron.')
    return
  }
  if (!window.electronAPI) {
    console.error('electronAPI is not available on window object')
    console.debug('Available window properties:', Object.keys(window))
    throw new Error('Electron filesystem API is not properly initialized. This is likely a setup issue.')
  }
}

export const electronStorage: StorageDB = {
  setItem: async (key: string, value: Blob): Promise<void> => {
    throwIfNotElectron()
    await window.electronAPI.setItem(key, value)
  },
  getItem: async (key: string): Promise<ArrayBuffer | null | undefined> => {
    throwIfNotElectron()
    return await window.electronAPI.getItem(key)
  },
  removeItem: async (key: string): Promise<void> => {
    throwIfNotElectron()
    await window.electronAPI.removeItem(key)
  },
  clear: async (): Promise<void> => {
    throwIfNotElectron()
    await window.electronAPI.clear()
  },
  keys: async (): Promise<string[]> => {
    throwIfNotElectron()
    return await window.electronAPI.keys()
  },
  iterate: async (callback: (value: Blob, key: string, iterationNumber: number) => void): Promise<void> => {
    throwIfNotElectron()
    await window.electronAPI.iterate(callback)
  },
}
