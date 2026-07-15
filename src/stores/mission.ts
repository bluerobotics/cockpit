import * as turf from '@turf/turf'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { computed, reactive, ref, watch } from 'vue'

import { defaultMapFallbackBaseColor, defaultMapFallbackNoiseIntensity } from '@/assets/defaults'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { askForUsername } from '@/composables/usernamePrompDialog'
import { MavType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { generateSessionSeed } from '@/libs/map/map-tile-fallback'
import { generateMissionThumbnail } from '@/libs/mission/library'
import { eventCategoriesDefaultMapping } from '@/libs/slide-to-confirm'
import {
  AltitudeReferenceType,
  CockpitMission,
  countNavWaypointCommands,
  isNavWaypointCommand,
  MapOverlayMeta,
  MapTileProvider,
  MapTileProviderPreference,
  MissionCommand,
  MissionEstimatesSnapshot,
  SavedMission,
  Survey,
  Waypoint,
  WaypointCoordinates,
} from '@/types/mission'
import { cockpitLastConnectedUserKey, fallbackUsername } from '@/types/settings-management'

import { useMainVehicleStore } from './mainVehicle'

// Default map position (centered on Florianópolis, Brazil)
const DEFAULT_MAP_CENTER: WaypointCoordinates = [-27.5935, -48.55854]
const DEFAULT_MAP_ZOOM = 15

// Default cap on the vehicle position history. At 5Hz (default sampling rate), 500k samples is about 30 hours.
export const DEFAULT_MAX_POSITION_HISTORY_SIZE = 500000
export const MIN_MAX_POSITION_HISTORY_SIZE = 100

export const useMissionStore = defineStore('mission', () => {
  const username = useStorage<string>('cockpit-username', fallbackUsername)
  const lastConnectedUser = localStorage.getItem(cockpitLastConnectedUserKey) || undefined
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
  const userLastMapCenter = useBlueOsStorage<WaypointCoordinates>('cockpit-user-last-map-center', DEFAULT_MAP_CENTER)
  const userLastMapZoom = useBlueOsStorage<number>('cockpit-user-last-map-zoom', DEFAULT_MAP_ZOOM)
  const followVehicleOnMap = useBlueOsStorage<boolean>('cockpit-map-follow-vehicle', false)
  const draftMission = useBlueOsStorage('cockpit-draft-mission', {})
  const vehicleMission = useBlueOsStorage<Waypoint[]>('cockpit-vehicle-mission', [])
  const vehicleMissionRevision = useBlueOsStorage<number>('cockpit-vehicle-mission-rev', 0)
  const alwaysSwitchToFlightMode = useBlueOsStorage('cockpit-mission-always-switch-to-flight-mode', false)
  const showMissionCreationTips = useBlueOsStorage('cockpit-show-mission-creation-tips', true)
  const showChecklistBeforeArm = useBlueOsStorage('cockpit-show-checklist-before-arm', true)
  const showGridOnMissionPlanning = useBlueOsStorage('cockpit-show-grid-on-mission-planning', false)
  const showMissionEstimates = useBlueOsStorage('cockpit-show-mission-estimates', true)
  const defaultCruiseSpeed = useBlueOsStorage<number>('cockpit-default-cruise-speed', 1)
  const cruiseSpeed = ref<number>(Number(defaultCruiseSpeed.value))
  const userLastMapTileProvider = useBlueOsStorage<MapTileProvider>(
    'cockpit-user-last-map-tile-provider',
    'Esri World Imagery'
  )
  const defaultMapTileProvider = useBlueOsStorage<MapTileProviderPreference>(
    'cockpit-default-map-tile-provider',
    'Use last selected'
  )
  const userLastMapShowSeamarks = useBlueOsStorage<boolean>('cockpit-user-last-map-show-seamarks', true)
  const userLastMapShowMarineProfile = useBlueOsStorage<boolean>('cockpit-user-last-map-show-marine-profile', false)
  const mapFallbackBaseColor = useBlueOsStorage<string>('cockpit-map-fallback-base-color', defaultMapFallbackBaseColor)
  const mapFallbackNoiseIntensity = useBlueOsStorage<number>(
    'cockpit-map-fallback-noise-intensity',
    defaultMapFallbackNoiseIntensity
  )

  // Seed used for the map tiles fallback noise pattern.
  const mapFallbackSeed = ref<number>(generateSessionSeed())

  /**
   * Generates a new random seed for the fallback noise pattern.
   * @returns {void}
   */
  const reseedMapFallback = (): void => {
    mapFallbackSeed.value = generateSessionSeed()
  }

  const mapClearRequestRevision = ref(0)
  const mapDownloadRequestRevision = ref(0)
  const homeMarkerPosition = ref<WaypointCoordinates | undefined>(undefined)
  // Request for any active map to center on given coordinates. Replaced (new object) on each request.
  const mapCenterOnRequest = ref<{
    /** Coordinates the map should center on */
    coordinates: WaypointCoordinates
    /** Incremented on each request so repeated centerings on the same coordinates still trigger */
    revision: number
  } | null>(null)

  // Fallback vehicle type used by vehicle-specific planning features when no vehicle is connected.
  const plannedVehicleType = useBlueOsStorage<MavType | undefined>('cockpit-planned-vehicle-type', undefined)
  // Thumbnails are stored separately from the saved missions so that adding many entries doesn't
  // bloat the main library payload (each thumbnail is ~1-2 KB of base64 SVG).
  const savedMissions = useBlueOsStorage<SavedMission[]>('cockpit-mission-library', [])
  const savedMissionThumbnails = useBlueOsStorage<Record<string, string>>('cockpit-mission-library-thumbnails', {})

  const { showDialog } = useInteractionDialog()

  const mainVehicleStore = useMainVehicleStore()

  // Metadata for user-loaded GeoTIFF overlays. The raster bytes live in the overlay storage
  // (IndexedDB), keyed by each entry's `id`.
  const mapOverlays = useBlueOsStorage<MapOverlayMeta[]>('cockpit-map-overlays-v1', [])

  const addMapOverlay = (overlay: MapOverlayMeta): void => {
    mapOverlays.value.push(overlay)
  }

  const removeMapOverlay = (id: string): void => {
    const index = mapOverlays.value.findIndex((overlay) => overlay.id === id)
    if (index !== -1) {
      mapOverlays.value.splice(index, 1)
    }
  }

  // Cross-component request to frame the active map on a given overlay. The bumped revision lets the map views
  // react even when the same overlay is requested twice in a row.
  const mapOverlayFocusRequest = ref<{
    /**
     * Id of the overlay to frame.
     */
    id: string
    /**
     * Bumped on each request so repeated focus requests still trigger the map views.
     */
    revision: number
  }>({ id: '', revision: 0 })

  const requestMapOverlayFocus = (id: string): void => {
    mapOverlayFocusRequest.value = { id, revision: mapOverlayFocusRequest.value.revision + 1 }
  }

  watch(missionName, () => (lastMissionName.value = missionName.value))

  const currentPlanningWaypoints = reactive<Waypoint[]>([])
  const currentPlanningSurveys = reactive<Survey[]>([])

  type MissionSnapshot = {
    /**
     *
     */
    waypoints: Waypoint[]
    /**
     *
     */
    surveys: Survey[]
  }
  const MAX_UNDO_STACK_SIZE = 50
  const undoStack: MissionSnapshot[] = []
  const redoStack: MissionSnapshot[] = []
  const undoCount = ref(0)
  const redoCount = ref(0)

  const syncCounts = (): void => {
    undoCount.value = undoStack.length
    redoCount.value = redoStack.length
  }

  const takeSnapshot = (): MissionSnapshot => ({
    waypoints: JSON.parse(JSON.stringify(currentPlanningWaypoints)) as Waypoint[],
    surveys: JSON.parse(JSON.stringify(currentPlanningSurveys)) as Survey[],
  })

  /**
   * Captures a deep snapshot of the current waypoints and surveys for undo.
   * Clears the redo stack since a new action invalidates the redo history.
   */
  const pushUndoSnapshot = (): void => {
    undoStack.push(takeSnapshot())
    if (undoStack.length > MAX_UNDO_STACK_SIZE) {
      undoStack.shift()
    }
    redoStack.length = 0
    syncCounts()
  }

  /**
   * Pops and returns the most recent undo snapshot, or undefined if empty.
   * Pushes the current state onto the redo stack before returning.
   * @returns {MissionSnapshot | undefined} The snapshot
   */
  const popUndoSnapshot = (): MissionSnapshot | undefined => {
    if (undoStack.length === 0) return undefined
    redoStack.push(takeSnapshot())
    const snapshot = undoStack.pop()
    syncCounts()
    return snapshot
  }

  /**
   * Pops and returns the most recent redo snapshot, or undefined if empty.
   * Pushes the current state onto the undo stack before returning.
   * @returns {MissionSnapshot | undefined} The snapshot
   */
  const popRedoSnapshot = (): MissionSnapshot | undefined => {
    if (redoStack.length === 0) return undefined
    undoStack.push(takeSnapshot())
    const snapshot = redoStack.pop()
    syncCounts()
    return snapshot
  }

  /**
   * Whether the undo stack has any snapshots to restore.
   * @returns {boolean} True if undo is available
   */
  const canUndo = computed(() => undoCount.value > 0)

  /**
   * Whether the redo stack has any snapshots to restore.
   * @returns {boolean} True if redo is available
   */
  const canRedo = computed(() => redoCount.value > 0)

  /**
   * Clears all undo and redo history.
   */
  const clearUndoStack = (): void => {
    undoStack.length = 0
    redoStack.length = 0
    syncCounts()
  }
  const persistedPositionHistory = useStorage<WaypointCoordinates[]>('cockpit-vehicle-position-history', [])
  const isVehiclePositionHistoryPersistent = useBlueOsStorage('cockpit-vehicle-position-history-persistent', true)
  const vehiclePositionHistory = ref<WaypointCoordinates[]>([...persistedPositionHistory.value])
  // Revision counter for `vehiclePositionHistory` mutations.
  const vehiclePositionHistoryRevision = ref(0)

  let positionHistoryDirty = false
  let simplifiedBoundary = 0

  const flushPositionHistory = (): void => {
    if (!isVehiclePositionHistoryPersistent.value) return
    if (!positionHistoryDirty) return
    positionHistoryDirty = false
    persistedPositionHistory.value = [...vehiclePositionHistory.value]
  }

  const positionHistoryFlushInterval = 10000
  setInterval(flushPositionHistory, positionHistoryFlushInterval)
  window.addEventListener('beforeunload', flushPositionHistory)

  const clearVehicleHistory = (): void => {
    vehiclePositionHistory.value = []
    vehiclePositionHistoryRevision.value += 1
    positionHistoryDirty = false
    simplifiedBoundary = 0
    if (isVehiclePositionHistoryPersistent.value) {
      persistedPositionHistory.value = []
    }
  }

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

  const clearMission = (): void => {
    currentPlanningWaypoints.splice(0)
    currentPlanningSurveys.splice(0)
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
      surveys: [...currentPlanningSurveys],
    }
  }

  const clearDraft = (): void => {
    draftMission.value = {}
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
    // A waypoint must always keep at least one MAV_CMD_NAV_WAYPOINT, otherwise it is dropped on upload.
    if (isNavWaypointCommand(waypoint.commands[commandIndex]) && countNavWaypointCommands(waypoint.commands) <= 1) {
      throw Error(`Cannot remove the last MAV_CMD_NAV_WAYPOINT command from waypoint ${waypointId}.`)
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
    const removesLastNavWaypoint =
      isNavWaypointCommand(waypoint.commands[commandIndex]) &&
      !isNavWaypointCommand(updatedCommand) &&
      countNavWaypointCommands(waypoint.commands) <= 1
    if (removesLastNavWaypoint) {
      throw Error(`Cannot remove the last MAV_CMD_NAV_WAYPOINT command from waypoint ${waypointId}.`)
    }
    waypoint.commands[commandIndex] = updatedCommand
  }

  const saveLastMapPosition = (zoom: number, mapCenter: WaypointCoordinates): void => {
    userLastMapZoom.value = zoom
    userLastMapCenter.value = mapCenter
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

  let didAutoEndCurrentRun = false

  /**
   * Applies the active cruise speed to the vehicle as a live command.
   * @param {number} [speedMps] - Speed to apply; defaults to the current active cruise speed
   * @returns {Promise<void>}
   */
  const applyCruiseSpeed = async (speedMps: number = cruiseSpeed.value): Promise<void> => {
    const speed = Number(speedMps)
    if (!Number.isFinite(speed) || speed <= 0) return
    cruiseSpeed.value = speed
    if (!mainVehicleStore.isVehicleOnline) return
    await mainVehicleStore.setCruiseSpeed(speed)
  }

  // Allow executing missions
  const executeMissionOnVehicle = async (): Promise<boolean> => {
    try {
      mainVehicleStore.clearReachedMissionItems()
      didAutoEndCurrentRun = false
      await mainVehicleStore.startMission()
      // Re-apply the cruise speed on every start/resume so it is not lost after a pause cycle.
      await applyCruiseSpeed().catch((err) => console.error('Failed to apply cruise speed on mission start:', err))
      return true
    } catch (error) {
      return false
    }
  }

  // Auto-end the run when the last navigation waypoint is reached
  watch(
    () => mainVehicleStore.reachedMissionItemSequences,
    (reachedSeqs) => {
      if (didAutoEndCurrentRun) return
      if (!isMissionRunning.value) return
      if (reachedSeqs.length === 0) return

      const navSeqs = navMissionSeqByWaypointIndex.value
      if (navSeqs.length <= 1) return

      const lastWpSeq = navSeqs[navSeqs.length - 1]
      if (lastWpSeq === undefined) return
      if (!reachedSeqs.includes(lastWpSeq)) return

      didAutoEndCurrentRun = true
      mainVehicleStore.pauseMission().catch((err) => {
        console.error('Failed to end mission after reaching last waypoint:', err)
      })
    }
  )

  // Mirror the vehicle store's own arm-transition cleanup of reached items so we re-arm detection
  watch(
    () => mainVehicleStore.isArmed,
    (isNowArmed, wasPreviouslyArmed) => {
      if (isNowArmed === true && wasPreviouslyArmed !== true) {
        didAutoEndCurrentRun = false
      }
    }
  )

  const requestMapClear = (): void => {
    mapClearRequestRevision.value += 1
  }

  const requestMapCenterOn = (coordinates: WaypointCoordinates): void => {
    mapCenterOnRequest.value = { coordinates, revision: (mapCenterOnRequest.value?.revision ?? 0) + 1 }
  }

  const requestMapMissionDownload = (): void => {
    mapDownloadRequestRevision.value += 1
  }

  watch(
    () => [...currentPlanningWaypoints],
    (wps) => persistDraft(wps),
    { deep: true }
  )

  // Maximum number of positions to store in the vehicle position history before simplifying
  const maxPositionHistorySize = useBlueOsStorage(
    'cockpit-vehicle-position-history-max-size',
    DEFAULT_MAX_POSITION_HISTORY_SIZE
  )

  /**
   * Simplifies the next unsimplified chunk of the vehicle position history using the
   * Ramer-Douglas-Peucker algorithm. The chunk starts at `simplifiedBoundary` and spans
   * one third of `maxPositionHistorySize`, ensuring each portion of the history is only
   * ever simplified once.
   * @returns {boolean} True if a chunk was simplified, false if no unsimplified data is available.
   */
  const simplifyNextChunk = (): boolean => {
    const history = vehiclePositionHistory.value
    const chunkSize = Math.floor(maxPositionHistorySize.value / 3)
    const chunkEnd = simplifiedBoundary + chunkSize

    if (simplifiedBoundary >= history.length - chunkSize || chunkEnd > history.length) return false

    const alreadySimplified = history.slice(0, simplifiedBoundary)
    const chunkSegment = history.slice(simplifiedBoundary, chunkEnd)
    const recentSegment = history.slice(chunkEnd)

    if (chunkSegment.length < 2) return false

    const line = turf.lineString(chunkSegment.map(([lat, lng]) => [lng, lat]))
    const simplified = turf.simplify(line, { tolerance: 0.000001, highQuality: true })
    const simplifiedPoints = simplified.geometry.coordinates.map(([lng, lat]) => [lat, lng] as WaypointCoordinates)

    vehiclePositionHistory.value = [...alreadySimplified, ...simplifiedPoints, ...recentSegment]
    vehiclePositionHistoryRevision.value += 1
    simplifiedBoundary += simplifiedPoints.length
    return true
  }

  watch(
    () => [mainVehicleStore.coordinates?.latitude, mainVehicleStore.coordinates?.longitude] as const,
    ([lat, lng]) => {
      if (!lat || !lng) return
      vehiclePositionHistory.value.push([lat, lng] as WaypointCoordinates)
      if (vehiclePositionHistory.value.length > maxPositionHistorySize.value) {
        const didSimplify = simplifyNextChunk()
        // Fallback: if no unsimplified chunk was available or RDP freed nothing, drop oldest point
        if (!didSimplify || vehiclePositionHistory.value.length > maxPositionHistorySize.value) {
          vehiclePositionHistory.value.shift()
          if (simplifiedBoundary > 0) simplifiedBoundary -= 1
        }
      }
      vehiclePositionHistoryRevision.value += 1
      positionHistoryDirty = true
    }
  )

  watch(username, () => window.dispatchEvent(new CustomEvent('user-changed', { detail: { username: username.value } })))

  // Prefers the connected vehicle's type and falls back to the planned type for offline planning.
  // The fallback is gated on `isVehicleOnline` because `mainVehicleStore.vehicleType` is set on
  // heartbeat but never cleared on disconnect, so a plain `??` would keep returning the stale
  // last-connected type after the user goes offline.
  const effectiveVehicleType = computed<MavType | undefined>(() => {
    return mainVehicleStore.isVehicleOnline
      ? (mainVehicleStore.vehicleType as MavType | undefined)
      : plannedVehicleType.value
  })

  // When `payload.id` matches an existing entry that entry is updated in-place; otherwise a new
  // entry is prepended.
  const saveMissionToLibrary = (payload: {
    /**
     * Display name for the mission.
     */
    name: string
    /**
     * Optional description for the mission.
     */
    description: string
    /**
     * The mission data to persist.
     */
    mission: CockpitMission
    /**
     * Vehicle type the mission was planned for.
     */
    vehicleType?: MavType
    /**
     * Mission estimates captured at save time.
     */
    estimates?: MissionEstimatesSnapshot
    /**
     * Existing entry id to update, or undefined to create a new one.
     */
    id?: string
  }): SavedMission => {
    const now = Date.now()
    const thumbnail = generateMissionThumbnail(payload.mission)
    const existingIndex = payload.id ? savedMissions.value.findIndex((m) => m.id === payload.id) : -1

    if (existingIndex !== -1) {
      const existing = savedMissions.value[existingIndex]
      const updated: SavedMission = {
        ...payload.mission,
        id: existing.id,
        name: payload.name,
        description: payload.description,
        vehicleType: payload.vehicleType,
        createdAt: existing.createdAt,
        updatedAt: now,
        estimates: payload.estimates,
      }
      savedMissions.value.splice(existingIndex, 1, updated)
      savedMissionThumbnails.value = { ...savedMissionThumbnails.value, [updated.id]: thumbnail }
      return updated
    }

    const created: SavedMission = {
      ...payload.mission,
      id: uuid(),
      name: payload.name,
      description: payload.description,
      vehicleType: payload.vehicleType,
      createdAt: now,
      updatedAt: now,
      estimates: payload.estimates,
    }
    savedMissions.value.unshift(created)
    savedMissionThumbnails.value = { ...savedMissionThumbnails.value, [created.id]: thumbnail }
    return created
  }

  const deleteSavedMission = (id: string): void => {
    const index = savedMissions.value.findIndex((m) => m.id === id)
    if (index !== -1) savedMissions.value.splice(index, 1)
    if (savedMissionThumbnails.value[id]) {
      const next = { ...savedMissionThumbnails.value }
      delete next[id]
      savedMissionThumbnails.value = next
    }
  }

  return {
    username,
    lastConnectedUser,
    changeUsername,
    missionName,
    lastMissionName,
    missionStartTime,
    currentPlanningWaypoints,
    currentPlanningSurveys,
    slideEventsEnabled,
    slideEventsCategoriesRequired,
    moveWaypoint,
    updateWaypoint,
    clearMission,
    defaultMapCenter,
    defaultMapZoom,
    userLastMapCenter,
    userLastMapZoom,
    saveLastMapPosition,
    setDefaultMapPosition,
    getWaypointNumber,
    mapOverlays,
    addMapOverlay,
    removeMapOverlay,
    mapOverlayFocusRequest,
    requestMapOverlayFocus,
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
    showMissionEstimates,
    addCommandToWaypoint,
    removeCommandFromWaypoint,
    updateWaypointCommand,
    defaultCruiseSpeed,
    cruiseSpeed,
    applyCruiseSpeed,
    userLastMapTileProvider,
    defaultMapTileProvider,
    userLastMapShowSeamarks,
    userLastMapShowMarineProfile,
    mapFallbackBaseColor,
    mapFallbackNoiseIntensity,
    mapFallbackSeed,
    reseedMapFallback,
    followVehicleOnMap,
    stopMission,
    executeMissionOnVehicle,
    skipToWaypoint,
    isMissionRunning,
    currentWpIndex,
    canSkipToPrevWp,
    canSkipToNextWp,
    currentWaypointOnMission,
    mapClearRequestRevision,
    mapCenterOnRequest,
    requestMapCenterOn,
    mapDownloadRequestRevision,
    requestMapClear,
    requestMapMissionDownload,
    vehiclePositionHistory,
    vehiclePositionHistoryRevision,
    isVehiclePositionHistoryPersistent,
    maxPositionHistorySize,
    clearVehicleHistory,
    pushUndoSnapshot,
    popUndoSnapshot,
    popRedoSnapshot,
    canUndo,
    canRedo,
    clearUndoStack,
    homeMarkerPosition,
    plannedVehicleType,
    effectiveVehicleType,
    savedMissions,
    savedMissionThumbnails,
    saveMissionToLibrary,
    deleteSavedMission,
  }
})
