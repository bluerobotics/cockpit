import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'

import { eventCategoriesDefaultMapping } from '@/libs/slide-to-confirm'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

export const useMissionStore = defineStore('mission', () => {
  const missionName = ref('')
  const lastMissionName = useStorage('cockpit-last-mission-name', '')
  const missionStartTime = useStorage('cockpit-mission-start-time', new Date())
  const slideEventsEnabled = useStorage('cockpit-slide-events-enabled', true)
  const slideEventsCategoriesRequired = useStorage(
    'cockpit-slide-events-categories-required',
    eventCategoriesDefaultMapping,
    localStorage,
    { mergeDefaults: true }
  )

  watch(missionName, () => (lastMissionName.value = missionName.value))

  const currentPlanningWaypoints = reactive<Waypoint[]>([])

  const moveWaypoint = (id: string, newCoordinates: WaypointCoordinates): void => {
    const waypoint = currentPlanningWaypoints.find((w) => w.id === id)
    if (waypoint === undefined) {
      throw Error(`Could not move waypoint. No waypoint with id ${id} was found.`)
    }
    Object.assign(
      currentPlanningWaypoints,
      currentPlanningWaypoints.map((w) => (w.id === id ? { ...w, ...{ coordinates: newCoordinates } } : w))
    )
  }

  return {
    missionName,
    lastMissionName,
    missionStartTime,
    currentPlanningWaypoints,
    slideEventsEnabled,
    slideEventsCategoriesRequired,
    moveWaypoint,
  }
})
