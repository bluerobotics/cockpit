import { useStorage } from '@vueuse/core'
import { saveAs } from 'file-saver'
import localforage from 'localforage'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useVideoStore = defineStore('video', () => {
  const availableIceIps = reactive<string[]>([])
  const allowedIceIps = useStorage<string[]>('cockpit-allowed-stream-ips', [])

  // Offer download of backuped videos
  const cockpitVideoDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'CockpitVideoDB',
    storeName: 'cockpit-video-db',
    version: 1.0,
    description: 'Local backups of Cockpit video recordings to be retrieved in case of failure.',
  })

  cockpitVideoDB.iterate((videoFile, videoName) => {
    const blob = (videoFile as Blob[]).reduce((a, b) => new Blob([a, b], { type: 'video/webm' }))
    saveAs(blob, videoName)
  })
  cockpitVideoDB.iterate((_, videoName) => {
    cockpitVideoDB.removeItem(videoName)
  })

  return { availableIceIps, allowedIceIps }
})
