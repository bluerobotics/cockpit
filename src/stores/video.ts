import { useStorage } from '@vueuse/core'
import { saveAs } from 'file-saver'
import localforage from 'localforage'
import { defineStore } from 'pinia'
import Swal from 'sweetalert2'
import { ref } from 'vue'

export const useVideoStore = defineStore('video', () => {
  const availableIceIps = ref<string[] | undefined>(undefined)
  const allowedIceIps = useStorage<string[]>('cockpit-allowed-stream-ips', [])

  // Offer download of backuped videos
  const cockpitVideoDB = localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: 'CockpitVideoDB',
    storeName: 'cockpit-video-db',
    version: 1.0,
    description: 'Local backups of Cockpit video recordings to be retrieved in case of failure.',
  })

  cockpitVideoDB.length().then((len) => {
    if (len === 0) return

    Swal.fire({
      title: 'Video recording recovery',
      text: `Cockpit has pending backups for videos that you started recording but did not download.
        Click 'Discard' to remove the backuped files.
        Click 'Dismiss' to postpone this decision for the next boot.
        Click 'Download' to download the files. If you decide to download them, they will be removed afterwards.
      `,
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Download',
      denyButtonText: 'Discard',
      cancelButtonText: 'Dismiss',
    }).then((decision) => {
      if (decision.isDismissed) return
      if (decision.isDenied) {
        cockpitVideoDB.iterate((_, videoName) => cockpitVideoDB.removeItem(videoName))
      } else if (decision.isConfirmed) {
        cockpitVideoDB.iterate((videoFile, videoName) => {
          const blob = (videoFile as Blob[]).reduce((a, b) => new Blob([a, b], { type: 'video/webm' }))
          saveAs(blob, videoName)
        })
        cockpitVideoDB.iterate((_, videoName) => cockpitVideoDB.removeItem(videoName))
      }
    })
  })

  return { availableIceIps, allowedIceIps }
})
