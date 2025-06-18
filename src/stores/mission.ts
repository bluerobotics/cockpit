import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { askForUsername } from '@/composables/usernamePrompDialog'
import { listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { eventCategoriesDefaultMapping } from '@/libs/slide-to-confirm'
import { reloadCockpit } from '@/libs/utils'
import { findDataLakeVariablesIdsInString } from '@/libs/utils-data-lake'
import { isDynamicPoi, updateDynamicPoiCoordinates } from '@/libs/utils-poi'
import {
  AltitudeReferenceType,
  PointOfInterest,
  PointOfInterestCoordinates,
  Waypoint,
  WaypointCoordinates,
  WaypointType,
} from '@/types/mission'

import { useMainVehicleStore } from './mainVehicle'

// Default map position (centered on Florianópolis, Brazil)
const DEFAULT_MAP_CENTER: WaypointCoordinates = [-27.5935, -48.55854]
const DEFAULT_MAP_ZOOM = 15

export const useMissionStore = defineStore('mission', () => {
  const username = useStorage<string>('cockpit-username', '')
  const lastConnectedUser = localStorage.getItem('cockpit-last-connected-user') || undefined
  const missionName = ref('')
  const slideEventsEnabled = useBlueOsStorage('cockpit-slide-events-enabled', true)
  const slideEventsCategoriesRequired = useBlueOsStorage(
    'cockpit-slide-events-categories-required',
    eventCategoriesDefaultMapping
  )
  const lastMissionName = useStorage('cockpit-last-mission-name', '')
  const missionStartTime = useStorage('cockpit-mission-start-time', new Date())
  const defaultMapCenter = useBlueOsStorage<WaypointCoordinates>('cockpit-default-map-center', DEFAULT_MAP_CENTER)
  const defaultMapZoom = useBlueOsStorage<number>('cockpit-default-map-zoom', DEFAULT_MAP_ZOOM)
  const draftMission = useBlueOsStorage('cockpit-draft-mission', {})
  const vehicleMission = useBlueOsStorage<Waypoint[]>('cockpit-vehicle-mission', [])
  const vehicleMissionRevision = useBlueOsStorage<number>('cockpit-vehicle-mission-rev', 0)
  const alwaysSwitchToFlightMode = useBlueOsStorage('cockpit-mission-always-switch-to-flight-mode', false)
  const showMissionCreationTips = useBlueOsStorage('cockpit-show-mission-creation-tips', true)

  const { showDialog } = useInteractionDialog()

  const mainVehicleStore = useMainVehicleStore()

  const pointsOfInterest = useBlueOsStorage<PointOfInterest[]>('cockpit-points-of-interest', [])

  // Keep track of data-lake variable listeners for dynamic POIs
  const poiDataLakeListeners = ref<
    Record<
      string,
      Array<{
        /**
         *
         */
        variableId: string
        /**
         *
         */
        listenerId: string
      }>
    >
  >({})

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

  const addPointOfInterest = (poi: PointOfInterest): void => {
    // Initialize dynamic properties
    const initializedPoi = updateDynamicPoiCoordinates(poi)
    pointsOfInterest.value.push(initializedPoi)

    // Set up data-lake listeners if needed
    if (isDynamicPoi(initializedPoi)) {
      setupPoiDataLakeListeners(initializedPoi)
    }
  }

  const updatePointOfInterest = (id: string, poiUpdate: Partial<PointOfInterest>): void => {
    const index = pointsOfInterest.value.findIndex((p) => p.id === id)
    if (index !== -1) {
      const currentPoi = pointsOfInterest.value[index]
      const updatedPoi = { ...currentPoi, ...poiUpdate, timestamp: Date.now() }

      // Update dynamic coordinates if needed
      const finalPoi = updateDynamicPoiCoordinates(updatedPoi)
      pointsOfInterest.value[index] = finalPoi

      // Update data-lake listeners if dynamic properties changed
      if (isDynamicPoi(finalPoi)) {
        cleanupPoiDataLakeListeners(id)
        setupPoiDataLakeListeners(finalPoi)
      } else {
        cleanupPoiDataLakeListeners(id)
      }
    }
  }

  const removePointOfInterest = (id: string): void => {
    const index = pointsOfInterest.value.findIndex((p) => p.id === id)
    if (index !== -1) {
      // Clean up data-lake listeners
      cleanupPoiDataLakeListeners(id)
      pointsOfInterest.value.splice(index, 1)
    }
  }

  const movePointOfInterest = (id: string, newCoordinates: PointOfInterestCoordinates): void => {
    const poi = pointsOfInterest.value.find((p) => p.id === id)
    if (poi === undefined) {
      throw Error(`Could not move Point of Interest. No POI with id ${id} was found.`)
    }
    updatePointOfInterest(id, { coordinates: newCoordinates })
  }

  // Set up data-lake listeners for a dynamic POI
  const setupPoiDataLakeListeners = (poi: PointOfInterest): void => {
    if (!isDynamicPoi(poi)) return

    const variableIds = new Set<string>()

    // Find all data-lake variables used in coordinate expressions
    if (typeof poi.latitudeExpression === 'string') {
      findDataLakeVariablesIdsInString(poi.latitudeExpression).forEach((id) => variableIds.add(id))
    }
    if (typeof poi.longitudeExpression === 'string') {
      findDataLakeVariablesIdsInString(poi.longitudeExpression).forEach((id) => variableIds.add(id))
    }

    // Set up listeners for each variable
    const listeners: Array<{
      /**
       *
       */
      variableId: string
      /**
       *
       */
      listenerId: string
    }> = []
    variableIds.forEach((variableId) => {
      const listenerId = listenDataLakeVariable(variableId, () => {
        // Update POI coordinates when data changes
        const currentPoi = pointsOfInterest.value.find((p) => p.id === poi.id)
        if (currentPoi) {
          const updatedPoi = updateDynamicPoiCoordinates(currentPoi)
          const index = pointsOfInterest.value.findIndex((p) => p.id === poi.id)
          if (index !== -1) {
            pointsOfInterest.value[index] = updatedPoi
          }
        }
      })
      listeners.push({ variableId, listenerId })
    })

    poiDataLakeListeners.value[poi.id] = listeners
  }

  // Clean up data-lake listeners for a POI
  const cleanupPoiDataLakeListeners = (poiId: string): void => {
    const listeners = poiDataLakeListeners.value[poiId]
    if (listeners) {
      listeners.forEach(({ variableId, listenerId }) => {
        unlistenDataLakeVariable(variableId, listenerId)
      })
      delete poiDataLakeListeners.value[poiId]
    }
  }

  // Initialize data-lake listeners for existing dynamic POIs
  const initializeDynamicPois = (): void => {
    pointsOfInterest.value.forEach((poi) => {
      // Update coordinates and set up listeners for dynamic POIs
      const updatedPoi = updateDynamicPoiCoordinates(poi)
      const index = pointsOfInterest.value.findIndex((p) => p.id === poi.id)
      if (index !== -1) {
        pointsOfInterest.value[index] = updatedPoi
      }

      if (isDynamicPoi(updatedPoi)) {
        setupPoiDataLakeListeners(updatedPoi)
      }
    })
  }

  // Initialize dynamic POIs when store is created
  initializeDynamicPois()

  const clearMission = (): void => {
    currentPlanningWaypoints.splice(0)
    missionName.value = ''
    missionStartTime.value = new Date()
  }

  const changeUsername = async (): Promise<void> => {
    let newUsername: string | undefined
    try {
      newUsername = await askForUsername()
    } catch (error) {
      console.error('Username not set. User dismissed dialog.')
      return
    }
    console.debug('Username set:', newUsername)

    // If the user cancels the prompt or sets a name with less than 3 chars, do nothing
    if (!newUsername || newUsername.trim().length < 3) {
      showDialog({
        title: 'Invalid username',
        message: 'Username must be at least 3 characters long. No username was set. Auto-sync disabled.',
        variant: 'error',
        maxWidth: 560,
      })
      return
    }

    username.value = newUsername
    await reloadCockpit()
  }

  const setDefaultMapPosition = (center: WaypointCoordinates, zoom: number): void => {
    defaultMapCenter.value = [Number(center[0].toFixed(8)), Number(center[1].toFixed(8))]
    defaultMapZoom.value = zoom < 1 ? 1 : zoom > 19 ? 19 : zoom
  }

  watch(
    () => mainVehicleStore.isVehicleOnline,
    async (newValue) => {
      if (newValue) {
        // If there's a username saved, assign it as the last connected user
        localStorage.setItem('cockpit-last-connected-user', username.value)
        console.log(`Last connected user set to ${username.value}.`)

        if (!username.value) {
          // If no username is set and vehicle is connected, ask the user to enter one
          await changeUsername()
        }
      }
    },
    { immediate: true }
  )

  const getWaypointNumber = (id: string): number | string => {
    const waypointIndex = currentPlanningWaypoints.findIndex((wp) => wp.id === id)
    return waypointIndex !== -1 ? waypointIndex + 1 : ''
  }

  const persistDraft = (waypoints: Waypoint[]): void => {
    draftMission.value = {
      version: 0,
      settings: {
        mapCenter: defaultMapCenter.value,
        zoom: defaultMapZoom.value,
        currentWaypointType: waypoints[0]?.type || WaypointType.PASS_BY,
        currentWaypointAltitude: waypoints[0]?.altitude || 0,
        currentWaypointAltitudeRefType: waypoints[0]?.altitudeReferenceType || AltitudeReferenceType.RELATIVE_TO_HOME,
        defaultCruiseSpeed: 0,
      },
      waypoints,
    }
  }

  const clearDraft = (): void => {
    draftMission.value = null
  }

  const bumpVehicleMissionRevision = (wps: Waypoint[]): void => {
    vehicleMission.value = wps
    vehicleMissionRevision.value += 1
  }

  watch(
    () => [...currentPlanningWaypoints],
    (wps) => persistDraft(wps),
    { deep: true }
  )

  return {
    username,
    lastConnectedUser,
    changeUsername,
    missionName,
    lastMissionName,
    missionStartTime,
    currentPlanningWaypoints,
    slideEventsEnabled,
    slideEventsCategoriesRequired,
    moveWaypoint,
    clearMission,
    defaultMapCenter,
    defaultMapZoom,
    setDefaultMapPosition,
    getWaypointNumber,
    pointsOfInterest,
    addPointOfInterest,
    updatePointOfInterest,
    removePointOfInterest,
    movePointOfInterest,
    persistDraft,
    clearDraft,
    bumpVehicleMissionRevision,
    draftMission,
    vehicleMission,
    vehicleMissionRevision,
    alwaysSwitchToFlightMode,
    showMissionCreationTips,
  }
})
