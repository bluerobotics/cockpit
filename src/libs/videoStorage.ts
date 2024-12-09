import localforage from 'localforage'

import { electronStorage } from '@/libs/electron/filesystemStorageRendererAPI'
import { StorageDB } from '@/types/general'

import { isElectron } from './utils'

const tempVideoChunksIndexdedDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Temporary Video',
  storeName: 'cockpit-temp-video-db',
  version: 1.0,
  description: 'Database for storing the chunks of an ongoing recording, to be merged afterwards.',
})

const videoStoringIndexedDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Video Recovery',
  storeName: 'cockpit-video-recovery-db',
  version: 1.0,
  description: 'Local backups of Cockpit video recordings to be retrieved in case of failure.',
})

export const videoStorage: StorageDB = isElectron() ? electronStorage : videoStoringIndexedDB
export const tempVideoStorage: StorageDB = isElectron() ? electronStorage : tempVideoChunksIndexdedDB
