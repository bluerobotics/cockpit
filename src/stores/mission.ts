import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { askForUsername } from '@/composables/usernamePrompDialog'
import { eventCategoriesDefaultMapping } from '@/libs/slide-to-confirm'
import { reloadCockpit } from '@/libs/utils'
import {
  AltitudeReferenceType,
  MissionCommand,
  PointOfInterest,
  PointOfInterestCoordinates,
  Waypoint,
  WaypointCoordinates,
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
  const showChecklistBeforeArm = useBlueOsStorage('cockpit-show-checklist-before-arm', true)
  const showGridOnMissionPlanning = useBlueOsStorage('cockpit-show-grid-on-mission-planning', false)
  const defaultCruiseSpeed = useBlueOsStorage<number>('cockpit-default-cruise-speed', 1)
  const mapDownloadMissionFromVehicle = ref<(() => Promise<void>) | null>(null)
  const mapClearMapDrawing = ref<(() => void) | null>(null)

  const { showDialog } = useInteractionDialog()

  const mainVehicleStore = useMainVehicleStore()

  const pointsOfInterest = useBlueOsStorage<PointOfInterest[]>('cockpit-points-of-interest', [])

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

  const updateWaypoint = (id: string, newWaypoint: Waypoint): void => {
    const waypoint = currentPlanningWaypoints.find((w) => w.id === id)
    if (waypoint === undefined) {
      throw Error(`Could not update waypoint type. No waypoint with id ${id} was found.`)
    }
    Object.assign(
      currentPlanningWaypoints,
      currentPlanningWaypoints.map((w) => (w.id === id ? { ...w, ...newWaypoint } : w))
    )
  }

  const addPointOfInterest = (poi: PointOfInterest): void => {
    pointsOfInterest.value.push(poi)
  }

  const updatePointOfInterest = (id: string, poiUpdate: Partial<PointOfInterest>): void => {
    const index = pointsOfInterest.value.findIndex((p) => p.id === id)
    if (index !== -1) {
      pointsOfInterest.value[index] = { ...pointsOfInterest.value[index], ...poiUpdate, timestamp: Date.now() }
    }
  }

  const removePointOfInterest = (id: string): void => {
    const index = pointsOfInterest.value.findIndex((p) => p.id === id)
    if (index !== -1) {
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

  let idLastConnectedVehicle: string | undefined = undefined
  watch(
    () => mainVehicleStore.currentlyConnectedVehicleId,
    async (newVehicleId) => {
      if (newVehicleId) {
        // If there's a username saved, assign it as the last connected user
        localStorage.setItem('cockpit-last-connected-user', username.value)
        if (username.value) {
          console.log(`Last connected user set to '${username.value}'.`)
        } else {
          console.log('No username set. Will not set last connected user.')
        }

        const vehicleChanged = idLastConnectedVehicle !== newVehicleId
        idLastConnectedVehicle = newVehicleId
        if (!username.value && (idLastConnectedVehicle === undefined || vehicleChanged)) {
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
        currentWaypointAltitude: waypoints[0]?.altitude || 0,
        currentWaypointAltitudeRefType: waypoints[0]?.altitudeReferenceType || AltitudeReferenceType.RELATIVE_TO_HOME,
        defaultCruiseSpeed: defaultCruiseSpeed.value,
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

  const addCommandToWaypoint = (waypointId: string, command: MissionCommand): void => {
    const waypoint = currentPlanningWaypoints.find((w) => w.id === waypointId)
    if (waypoint === undefined) {
      throw Error(`Could not add command to waypoint. No waypoint with id ${waypointId} was found.`)
    }
    waypoint.commands.push(command)
  }

  const removeCommandFromWaypoint = (waypointId: string, commandIndex: number): void => {
    const waypoint = currentPlanningWaypoints.find((w) => w.id === waypointId)
    if (waypoint === undefined) {
      throw Error(`Could not remove command from waypoint. No waypoint with id ${waypointId} was found.`)
    }
    if (commandIndex < 0 || commandIndex >= waypoint.commands.length) {
      throw Error(`Invalid command index ${commandIndex} for waypoint ${waypointId}.`)
    }
    waypoint.commands.splice(commandIndex, 1)
  }

  const updateWaypointCommand = (waypointId: string, commandIndex: number, updatedCommand: MissionCommand): void => {
    const waypoint = currentPlanningWaypoints.find((w) => w.id === waypointId)
    if (waypoint === undefined) {
      throw Error(`Could not update command in waypoint. No waypoint with id ${waypointId} was found.`)
    }
    if (commandIndex < 0 || commandIndex >= waypoint.commands.length) {
      throw Error(`Invalid command index ${commandIndex} for waypoint ${waypointId}.`)
    }
    waypoint.commands[commandIndex] = updatedCommand
  }

  // Maps waypoints on MAVLink mission to their corresponding mission item seq (ignoring NON_NAV commands)
  const navMissionSeqByWaypointIndex = computed<number[]>(() => {
    const navigationSequence: number[] = []
    navigationSequence[0] = 0
    let seq = 1

    if (vehicleMission.value.length <= 1) {
      return navigationSequence
    }

    for (let idx = 1; idx < vehicleMission.value.length; idx += 1) {
      const waypoint = vehicleMission.value[idx]
      const commands = waypoint?.commands ?? []

      if (commands.length === 0) {
        navigationSequence[idx] = seq
        seq += 1
        continue
      }

      const startSeq = seq
      let navSeqForThisWp: number | undefined = undefined

      commands.forEach((cmd) => {
        if (cmd.type === 'MAVLINK_NAV_COMMAND' && navSeqForThisWp === undefined) {
          navSeqForThisWp = seq
        }
        seq += 1
      })

      navigationSequence[idx] = navSeqForThisWp ?? startSeq
    }

    return navigationSequence
  })

  const isMissionRunning = computed<boolean>(
    () => mainVehicleStore.mode === 'AUTO' || mainVehicleStore.mode === 'GUIDED'
  )

  // Keeps track of the current active waypoint on the mission
  const currentWpIndex = computed<number>(() => {
    const currentSeq = mainVehicleStore.currentMissionSeq ?? 0
    const navigationSequence = navMissionSeqByWaypointIndex.value
    let waypointIndex = 0
    1
    if (navigationSequence.length === 0) return 0

    for (let i = 0; i < navigationSequence.length; i += 1) {
      if (navigationSequence[i] <= currentSeq) {
        waypointIndex = i
      } else {
        break
      }
    }

    return waypointIndex
  })

  const currentWaypointOnMission = computed<number>(() => {
    return currentWpIndex.value
  })

  // Enables skipping back waypoints button
  const canSkipToPrevWp = computed<boolean>(() => {
    if (!mainVehicleStore.isVehicleOnline) return false
    return currentWaypointOnMission.value > 1
  })

  // Enables skipping forward waypoints button
  const canSkipToNextWp = computed<boolean>(() => {
    const navigationSequence = navMissionSeqByWaypointIndex.value

    if (!mainVehicleStore.isVehicleOnline || navigationSequence.length <= 1) return false

    return currentWaypointOnMission.value < navigationSequence.length - 1
  })

  const skipToWaypoint = async (delta: number): Promise<boolean> => {
    const navigationSequence = navMissionSeqByWaypointIndex.value
    const currentWp = currentWpIndex.value
    const maxWp = navigationSequence.length - 1
    const targetWp = Math.max(0, Math.min(maxWp, currentWp + delta))
    const targetSeq = navigationSequence[targetWp]

    if (!mainVehicleStore.isVehicleOnline) return false
    if (navigationSequence.length <= 1) return false
    if (targetWp === currentWp) return false
    if (targetSeq === undefined) return false

    try {
      await mainVehicleStore.setMissionCurrent(targetSeq)
    } catch (err) {
      return false
    }

    return true
  }

  const stopMission = async (): Promise<boolean> => {
    if (!mainVehicleStore.isVehicleOnline) return false
    try {
      await mainVehicleStore.pauseMission()
      await mainVehicleStore.setMissionCurrent(1)
      return true
    } catch (err) {
      return false
    }
  }

  // Allow executing missions
  const executeMissionOnVehicle = async (): Promise<boolean> => {
    try {
      await mainVehicleStore.startMission()
      return true
    } catch (error) {
      return false
    }
  }

  const registerMapMissionActions = (payload: {
    /**
     *
     */
    downloadMissionFromVehicle: () => Promise<void>
    /**
     *
     */
    clearMapDrawing: () => void
  }): void => {
    mapDownloadMissionFromVehicle.value = payload.downloadMissionFromVehicle
    mapClearMapDrawing.value = payload.clearMapDrawing
  }

  const callMapDownloadMissionFromVehicle = async (): Promise<void> => {
    if (!mapDownloadMissionFromVehicle.value) return
    await mapDownloadMissionFromVehicle.value()
  }

  const callMapClearMapDrawing = (): void => {
    if (!mapClearMapDrawing.value) return
    mapClearMapDrawing.value()
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
    updateWaypoint,
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
    showChecklistBeforeArm,
    showGridOnMissionPlanning,
    addCommandToWaypoint,
    removeCommandFromWaypoint,
    updateWaypointCommand,
    defaultCruiseSpeed,
    stopMission,
    executeMissionOnVehicle,
    skipToWaypoint,
    isMissionRunning,
    currentWpIndex,
    canSkipToPrevWp,
    canSkipToNextWp,
    currentWaypointOnMission,
    registerMapMissionActions,
    callMapDownloadMissionFromVehicle,
    callMapClearMapDrawing,
  }
})
