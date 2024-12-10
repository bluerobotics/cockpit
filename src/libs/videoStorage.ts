import localforage from 'localforage'

import type { ElectronStorageDB, StorageDB } from '@/types/general'

import { isElectron } from './utils'

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

/**
 * Electron storage implementation.
 * Uses the exposed IPC renderer API to store and retrieve data in the filesystem.
 */
class ElectronStorage implements ElectronStorageDB {
  subFolders: string[]
  electronAPI: ElectronStorageDB

  /**
   * Creates a new instance of the ElectronStorage class.
   * @param {string[]} subFolders - The subfolders to store the data in.
   */
  constructor(subFolders: string[]) {
    throwIfNotElectron()

    this.subFolders = subFolders
    this.electronAPI = window.electronAPI as StorageDB
  }

  setItem = async (key: string, value: Blob): Promise<void> => {
    throwIfNotElectron()
    await this.electronAPI.setItem(key, value, this.subFolders)
  }

  getItem = async (key: string): Promise<Blob | null | undefined> => {
    throwIfNotElectron()
    return await this.electronAPI.getItem(key, this.subFolders)
  }

  removeItem = async (key: string): Promise<void> => {
    throwIfNotElectron()
    await this.electronAPI.removeItem(key, this.subFolders)
  }

  clear = async (): Promise<void> => {
    throwIfNotElectron()
    await this.electronAPI.clear(this.subFolders)
  }

  keys = async (): Promise<string[]> => {
    throwIfNotElectron()
    return await this.electronAPI.keys(this.subFolders)
  }
}

/**
 * LocalForage storage implementation.
 * Uses the localforage library to store and retrieve data in the IndexedDB.
 */
class LocalForageStorage implements StorageDB {
  localForage: LocalForage

  /**
   * Creates a new instance of the LocalForageStorage class.
   * @param {string} name - The name of the localforage instance.
   * @param {string} storeName - The name of the store to store the data in.
   * @param {number} version - The version of the localforage instance.
   * @param {string} description - The description of the localforage instance.
   */
  constructor(name: string, storeName: string, version: number, description: string) {
    this.localForage = localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: name,
      storeName: storeName,
      version: version,
      description: description,
    })
  }

  setItem = async (key: string, value: Blob): Promise<void> => {
    await this.localForage.setItem(key, value)
  }

  getItem = async (key: string): Promise<Blob | null | undefined> => {
    return await this.localForage.getItem(key)
  }

  removeItem = async (key: string): Promise<void> => {
    await this.localForage.removeItem(key)
  }

  clear = async (): Promise<void> => {
    await this.localForage.clear()
  }

  keys = async (): Promise<string[]> => {
    return await this.localForage.keys()
  }
}

const tempVideoChunksIndexdedDB: StorageDB = new LocalForageStorage(
  'Cockpit - Temporary Video',
  'cockpit-temp-video-db',
  1.0,
  'Database for storing the chunks of an ongoing recording, to be merged afterwards.'
)

const videoStoringIndexedDB: StorageDB = new LocalForageStorage(
  'Cockpit - Video Recovery',
  'cockpit-video-recovery-db',
  1.0,
  'Cockpit video recordings and their corresponding telemetry subtitles.'
)

const electronVideoStorage = new ElectronStorage(['videos'])
const temporaryElectronVideoStorage = new ElectronStorage(['videos', 'temporary-video-chunks'])

export const videoStorage = isElectron() ? electronVideoStorage : videoStoringIndexedDB
export const tempVideoStorage = isElectron() ? temporaryElectronVideoStorage : tempVideoChunksIndexdedDB
