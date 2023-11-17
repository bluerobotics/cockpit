import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useVideoStore = defineStore('video', () => {
  const availableIceIps = reactive<string[]>([])
  const allowedIceIps = useStorage<string[]>('cockpit-allowed-stream-ips', [])

  return { availableIceIps, allowedIceIps }
})
