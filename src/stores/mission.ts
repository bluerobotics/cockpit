import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type { Waypoint } from '@/types/mission'

export const useMissionStore = defineStore('mission', () => {
  const missionName = useStorage('cockpit-mission-name', '')
  const missionStartTime = useStorage('cockpit-mission-start-time', new Date())

  const currentPlanningWaypoints = reactive<Waypoint[]>([])

  return { missionName, missionStartTime, currentPlanningWaypoints }
})
