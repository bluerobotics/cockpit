import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useMissionStore = defineStore('mission', () => {
  const missionName = useStorage('cockpit-mission-name', '')
  const missionStartTime = useStorage('cockpit-mission-start-time', new Date())

  return { missionName, missionStartTime }
})
