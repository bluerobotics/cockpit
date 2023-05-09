import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type { Waypoint } from '@/types/mission'

export const useMissionStore = defineStore('mission', () => {
  const missionName = useStorage('cockpit-mission-name', '')
  const missionStartTime = useStorage('cockpit-mission-start-time', new Date())

  const currentPlanningWaypoints = reactive<Waypoint[]>([])

  const moveWaypoint = (id: string, newCoordinates: [number, number]): void => {
    const waypoint = currentPlanningWaypoints.find((w) => w.id === id)
    if (waypoint === undefined) {
      throw Error(`Could not move waypoint. No waypoint with id ${id} was found.`)
    }
    Object.assign(
      currentPlanningWaypoints,
      currentPlanningWaypoints.map((w) => (w.id === id ? { ...w, ...{ coordinates: newCoordinates } } : w))
    )
  }

  return { missionName, missionStartTime, currentPlanningWaypoints, moveWaypoint }
})
