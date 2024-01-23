import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { eventCategoriesDefaultMapping } from '@/libs/slide-to-confirm'
import type { Waypoint, WaypointCoordinates } from '@/types/mission'

export const useMissionStore = defineStore('mission', () => {
  const missionName = ref('')
  const slideEventsEnabled = useBlueOsStorage('cockpit-slide-events-enabled', true)
  const slideEventsCategoriesRequired = useBlueOsStorage(
    'cockpit-slide-events-categories-required',
    eventCategoriesDefaultMapping
  )
  const lastMissionName = useBlueOsStorage('cockpit-last-mission-name', '')
  const missionStartTime = useBlueOsStorage('cockpit-mission-start-time', new Date())

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
