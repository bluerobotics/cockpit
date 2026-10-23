import ky from 'ky'
import localforage from 'localforage'
import { type ComputedRef, computed, ref } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { listenToGenericWebSocketJsonMessages } from '@/libs/generic-websocket'
import {
  type ExternalMapOverlayCommand,
  type ExternalMapOverlayFeature,
  type ValidatedMapGeoTiff,
  externalMapOverlayCommandSchema,
  isExternalMapOverlayCommand,
} from '@/libs/map/external-overlay-api'
import { deleteStoredOverlay, importGeoTiffFile, OverlayStorageQuotaError } from '@/libs/map/overlay-import'
import { messageFromError } from '@/libs/utils'
import { replaceDataLakeInputsInString } from '@/libs/utils-data-lake'
import { useMissionStore } from '@/stores/mission'
import type { MapOverlayMeta } from '@/types/mission'

/**
 * A map overlay received from external software
 */
export interface ReceivedMapOverlay {
  /**
   * Id the sender gave the overlay
   */
  id: string
  /**
   * Name shown in the layer control
   */
  name: string
  /**
   * Whether the overlay is kept in memory only, rather than saved on this computer
   */
  live: boolean
  /**
   * GeoJSON features drawn on the map
   */
  features: ExternalMapOverlayFeature[]
  /**
   * Bumped whenever the features are replaced rather than appended to, so maps know to redraw them all
   */
  revision: number
}

/**
 * What is saved for an overlay that is not live, under its id
 */
interface StoredMapOverlay {
  /**
   * Name shown in the layer control
   */
  name: string
  /**
   * GeoJSON features drawn on the map
   */
  features: ExternalMapOverlayFeature[]
}

/**
 * Shared state of the map overlays received from external software
 */
export interface ExternalMapOverlaysState {
  /**
   * Every received overlay, as a new array on each change
   */
  overlays: ComputedRef<ReceivedMapOverlay[]>
  /**
   * Removes an overlay, and its saved copy if it has one
   */
  removeOverlay: (id: string) => void
  /**
   * Applies a map overlay command from external software, ignoring any other message
   */
  handleExternalMapOverlayMessage: (message: unknown) => void
}

// Saved on this computer only: a survey mesh is too large to sync through the vehicle, and a sender reaches
// every Cockpit connected to it anyway.
const storage = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - External Map Overlays',
  storeName: 'cockpit-external-map-overlays-db',
  version: 1.0,
  description: 'Map overlays sent by external software, such as BlueOS extensions.',
})

const persistDelayMs = 1000

// Rasters run to tens of megabytes over a tether, so the usual request timeout would expire on most of them.
const geoTiffDownloadTimeoutMs = 5 * 60 * 1000

let state: ExternalMapOverlaysState | undefined

const createState = (): ExternalMapOverlaysState => {
  const missionStore = useMissionStore()
  const overlays = new Map<string, ReceivedMapOverlay>()
  // The overlays are plain objects, so a large mesh is not made deeply reactive; this counter is what changes.
  const changeCount = ref(0)
  const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // Coalesced, so a sender updating a saved overlay many times a second does not serialize it on every message.
  const persist = (id: string): void => {
    clearTimeout(persistTimers.get(id))
    const timer = setTimeout(() => {
      persistTimers.delete(id)
      const overlay = overlays.get(id)
      if (!overlay || overlay.live) return
      const stored: StoredMapOverlay = { name: overlay.name, features: overlay.features }
      storage
        .setItem(id, stored)
        .catch((error) => console.error(`[ExternalMapOverlays] Could not save '${id}'.`, error))
    }, persistDelayMs)
    persistTimers.set(id, timer)
  }

  const forget = (id: string): void => {
    clearTimeout(persistTimers.get(id))
    persistTimers.delete(id)
    storage.removeItem(id).catch((error) => console.error(`[ExternalMapOverlays] Could not delete '${id}'.`, error))
  }

  const loadStoredOverlays = async (): Promise<void> => {
    try {
      await storage.iterate<StoredMapOverlay, void>((stored, id) => {
        overlays.set(id, { id, name: stored.name, live: false, features: stored.features, revision: 1 })
      })
      changeCount.value++
    } catch (error) {
      console.error('[ExternalMapOverlays] Could not load saved overlays.', error)
    }
  }
  const storedOverlaysLoaded = loadStoredOverlays()

  const removeOverlay = (id: string): void => {
    overlays.delete(id)
    changeCount.value++
    forget(id)
  }

  // The GeoTIFF list is synced to the vehicle so, as with points of interest, writing it before the vehicle's copy
  // is read would replace the overlays saved there. A GeoTIFF command waits for that read rather than failing, since
  // senders typically send it as soon as they connect, which is before the read.
  let vehicleSyncCompleted = false
  const vehicleSyncWaiters: (() => void)[] = []
  window.addEventListener('vehicle-online', () => (vehicleSyncCompleted = false))
  window.addEventListener('vehicle-sync-complete', () => {
    vehicleSyncCompleted = true
    vehicleSyncWaiters.splice(0).forEach((resolve) => resolve())
  })
  const vehicleSynced = (): Promise<void> =>
    vehicleSyncCompleted ? Promise.resolve() : new Promise((resolve) => vehicleSyncWaiters.push(resolve))

  // Kept apart from the GeoJSON commands, so a large download never holds up a live track.
  let geoTiffQueue: Promise<void> = Promise.resolve()
  const queueGeoTiffTask = (task: () => Promise<void>, onError: (error: unknown) => void): void => {
    geoTiffQueue = geoTiffQueue.then(vehicleSynced).then(task).catch(onError)
  }
  // A sender re-sends on every reconnection, so each failing download is reported once per session.
  const reportedGeoTiffFailures = new Set<string>()

  const sentGeoTiff = (externalId: string): MapOverlayMeta | undefined =>
    missionStore.mapOverlays.find((overlay) => overlay.externalId === externalId)

  const removeGeoTiff = async (externalId: string): Promise<void> => {
    const overlay = sentGeoTiff(externalId)
    if (!overlay) throw new Error(`Overlay '${externalId}' does not exist.`)
    missionStore.removeMapOverlay(overlay.id)
    await deleteStoredOverlay(overlay.id)
  }

  const setGeoTiff = async (geoTiff: ValidatedMapGeoTiff): Promise<void> => {
    const url = replaceDataLakeInputsInString(geoTiff.url)
    const raster = await ky
      .get(url, { timeout: geoTiffDownloadTimeoutMs, retry: 0 })
      .blob()
      .catch(() => {
        throw new Error(`it could not be downloaded from ${url}.`)
      })
    const file = new File([raster], `${geoTiff.name}.tif`)
    const imported = await importGeoTiffFile(file, geoTiff.renderMode).catch((error) => {
      if (error instanceof OverlayStorageQuotaError) throw error
      throw new Error('it may be an unsupported or corrupted GeoTIFF.')
    })
    // Stored under a new id, so maps drop the previous raster instead of reusing its cached render.
    const previous = sentGeoTiff(geoTiff.id)
    if (previous) await removeGeoTiff(geoTiff.id)
    const visible = previous?.visible ?? true
    const opacity = previous?.opacity ?? 1
    missionStore.addMapOverlay({ ...imported, externalId: geoTiff.id, visible, opacity })
  }

  const existingOverlay = (id: string): ReceivedMapOverlay => {
    const overlay = overlays.get(id)
    if (!overlay) throw new Error(`Overlay '${id}' does not exist.`)
    return overlay
  }

  const applyCommand = (command: ExternalMapOverlayCommand): void => {
    switch (command.type) {
      case 'cockpit:setMapOverlay': {
        const { id, name, live, geojson } = command.overlay
        const previous = overlays.get(id)
        overlays.set(id, { id, name, live, features: geojson.features, revision: (previous?.revision ?? 0) + 1 })
        changeCount.value++
        if (!live) persist(id)
        else if (previous && !previous.live) forget(id)
        return
      }
      case 'cockpit:appendMapOverlayFeatures': {
        const overlay = existingOverlay(command.id)
        // ponytail: an overlay appended to grows without bound; cap or decimate it if senders stream for hours.
        // One push per feature, since spreading a large batch into a single call can overflow the stack.
        command.features.forEach((feature) => overlay.features.push(feature))
        changeCount.value++
        if (!overlay.live) persist(overlay.id)
        return
      }
      case 'cockpit:clearMapOverlay': {
        const overlay = existingOverlay(command.id)
        overlay.features = []
        overlay.revision++
        changeCount.value++
        if (!overlay.live) persist(overlay.id)
        return
      }
      case 'cockpit:setMapGeoTiff': {
        const { geoTiff } = command
        queueGeoTiffTask(
          () => setGeoTiff(geoTiff),
          (error) => {
            const failure = `${geoTiff.id} ${geoTiff.url}`
            if (reportedGeoTiffFailures.has(failure)) return
            reportedGeoTiffFailures.add(failure)
            const reason = messageFromError(error)
            openSnackbar({ message: `Could not show the "${geoTiff.name}" map overlay: ${reason}`, variant: 'error' })
          }
        )
        return
      }
      case 'cockpit:removeMapOverlay':
        if (overlays.has(command.id)) {
          removeOverlay(command.id)
          return
        }
        // Queued behind any download of the same overlay, so a removal is never overtaken by it.
        queueGeoTiffTask(
          () => removeGeoTiff(command.id),
          (error) => console.warn(`[ExternalMapOverlays] Ignoring command. ${messageFromError(error)}`)
        )
    }
  }

  const handleExternalMapOverlayMessage = (message: unknown): void => {
    if (!isExternalMapOverlayCommand(message)) return
    const parsed = externalMapOverlayCommandSchema.safeParse(message)
    if (!parsed.success) {
      // A malformed mesh can fail on every position, so only the first problem is worth reading.
      const [issue] = parsed.error.issues
      const others = parsed.error.issues.length - 1
      const more = others > 0 ? ` (and ${others} more)` : ''
      console.warn(`[ExternalMapOverlays] Ignoring invalid command. ${issue.path.join('.')}: ${issue.message}${more}`)
      return
    }
    // Applied once the saved overlays are read, so finishing that read never undoes a newer command.
    storedOverlaysLoaded
      .then(() => applyCommand(parsed.data))
      .catch((error) => console.warn(`[ExternalMapOverlays] Ignoring command. ${messageFromError(error)}`))
  }

  // The singleton outlives every consumer, so this listener is never removed.
  listenToGenericWebSocketJsonMessages(handleExternalMapOverlayMessage)

  return {
    overlays: computed(() => {
      void changeCount.value
      return [...overlays.values()]
    }),
    removeOverlay,
    handleExternalMapOverlayMessage,
  }
}

/**
 * Map overlays sent by external software (BlueOS extensions through a WebSocket connection, or pages embedded in
 * an iframe widget). Overlays are saved on this computer unless the sender marks them live.
 * State is created once and shared across all callers.
 * @returns {ExternalMapOverlaysState} The shared overlays and the command handler
 */
export const useExternalMapOverlays = (): ExternalMapOverlaysState => {
  if (!state) state = createState()
  return state
}

/**
 * Whether any map overlay exists, loaded by the operator or sent by external software, for the menus that offer to
 * manage them.
 * @returns {ComputedRef<boolean>} True while at least one overlay exists
 */
export const useHasAnyMapOverlay = (): ComputedRef<boolean> => {
  const missionStore = useMissionStore()
  const { overlays } = useExternalMapOverlays()
  return computed(() => missionStore.mapOverlays.length > 0 || overlays.value.length > 0)
}
