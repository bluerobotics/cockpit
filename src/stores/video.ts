import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useVideoStore = defineStore('video', () => {
  const availableIceIps = reactive<string[]>([])

  return { availableIceIps }
})
