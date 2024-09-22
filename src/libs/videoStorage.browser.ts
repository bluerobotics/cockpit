import localforage from 'localforage'

const tempVideoChunksDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Temporary Video',
  storeName: 'cockpit-temp-video-db',
  version: 1.0,
  description: 'Database for storing the chunks of an ongoing recording, to be merged afterwards.',
})

const videoStoringDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - Video Recovery',
  storeName: 'cockpit-video-recovery-db',
  version: 1.0,
  description: 'Local backups of Cockpit video recordings to be retrieved in case of failure.',
})

export const videoStorage = videoStoringDB
export const tempVideoStorage = tempVideoChunksDB
