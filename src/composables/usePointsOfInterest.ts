import { type ComputedRef, computed, reactive, watch } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import { openSnackbar } from '@/composables/snackbar'
import { getDataLakeVariableData, listenDataLakeVariable, unlistenDataLakeVariable } from '@/libs/actions/data-lake'
import { poiLatitudeVariableId, poiLongitudeVariableId, syncPoiCoordinateVariables } from '@/libs/poi/poi-data-lake'
import { machinizeString } from '@/libs/utils'
import type {
  PointOfInterest,
  PointOfInterestColor,
  PointOfInterestCoordinates,
  PointOfInterestIcon,
  ResolvedPointOfInterest,
} from '@/types/mission'

const pointsOfInterestKey = 'cockpit-points-of-interest'

/**
 * Builds a human-friendly POI id from its name, ensuring it is unique among the given ids.
 * @param {string} name - The POI name to derive the id from
 * @param {string[]} existingIds - Ids already in use, which the result must not collide with
 * @returns {string} A machinized, unique id (falls back to `poi` when the name has no usable characters)
 */
export const generatePointOfInterestId = (name: string, existingIds: string[]): string => {
  const base = machinizeString(name) || 'poi'
  if (!existingIds.includes(base)) return base
  let suffix = 2
  while (existingIds.includes(`${base}-${suffix}`)) suffix++
  return `${base}-${suffix}`
}

/**
 * Legacy POI shapes that may exist in persisted storage and need migrating to the current model.
 */
interface LegacyPointOfInterest {
  /** Unique id */
  id: string
  /** Name */
  name: string
  /** Description */
  description: string
  /** Legacy fixed coordinates */
  coordinates?: PointOfInterestCoordinates
  /** Current-model latitude source */
  latitude?: number | string
  /** Current-model longitude source */
  longitude?: number | string
  /** Current-model fallback coordinates */
  fallbackCoordinates?: PointOfInterestCoordinates
  /** Experimental latitude expression from an older iteration */
  latitudeExpression?: number | string
  /** Experimental longitude expression from an older iteration */
  longitudeExpression?: number | string
  /** Experimental last known coordinates from an older iteration */
  lastKnownCoordinates?: PointOfInterestCoordinates
  /** Icon */
  icon: PointOfInterestIcon
  /** Color */
  color: PointOfInterestColor
  /** Timestamp */
  timestamp?: number
}

const migratePointOfInterest = (poi: LegacyPointOfInterest): PointOfInterest => {
  const legacyCoordinates = poi.coordinates ?? poi.lastKnownCoordinates ?? [0, 0]
  const latitude = poi.latitude ?? poi.latitudeExpression ?? legacyCoordinates[0]
  const longitude = poi.longitude ?? poi.longitudeExpression ?? legacyCoordinates[1]
  const fallbackCoordinates = poi.fallbackCoordinates ?? poi.lastKnownCoordinates ?? legacyCoordinates

  return {
    id: poi.id,
    name: poi.name,
    description: poi.description,
    latitude,
    longitude,
    fallbackCoordinates,
    icon: poi.icon,
    color: poi.color,
    timestamp: poi.timestamp ?? Date.now(),
  }
}

/**
 * Shared reactive state and actions for managing points of interest.
 */
interface PointsOfInterestState {
  /** Persisted POI definitions, always read as a list even when the stored value is not one */
  pointsOfInterest: ComputedRef<PointOfInterest[]>
  /** POIs with coordinates resolved from the data lake (consumed by the UI) */
  resolvedPointsOfInterest: ComputedRef<ResolvedPointOfInterest[]>
  /** Adds a new POI */
  addPointOfInterest: (poi: PointOfInterest) => void
  /** Updates an existing POI */
  updatePointOfInterest: (id: string, update: Partial<PointOfInterest>) => void
  /** Removes a POI */
  removePointOfInterest: (id: string) => void
  /** Moves a POI to a static position (used for drag interactions) */
  movePointOfInterest: (id: string, newCoordinates: PointOfInterestCoordinates) => void
}

let state: PointsOfInterestState | undefined

const createState = (): PointsOfInterestState => {
  const pointsOfInterest = useBlueOsStorage<PointOfInterest[]>(pointsOfInterestKey, [])

  // Migrate any legacy POIs to the current model (coordinates split into data-lake-backed sources).
  // POIs created before this feature lack `fallbackCoordinates`; those get a fresh human-friendly id
  // derived from their name (de-duplicated). POIs already in the current model keep their id.
  const storedPois = pointsOfInterest.value as unknown
  const storedPoisAreList = Array.isArray(storedPois)
  if (!storedPoisAreList) {
    console.warn(`[PointsOfInterest] Stored '${pointsOfInterestKey}' is not a list. Reading it as empty.`)
  }
  const rawPois = storedPoisAreList ? (storedPois as LegacyPointOfInterest[]) : []
  const usedIds = rawPois.filter((poi) => poi.fallbackCoordinates !== undefined).map((poi) => poi.id)
  const migrated = rawPois.map((raw) => {
    const poi = migratePointOfInterest(raw)
    if (raw.fallbackCoordinates !== undefined) return poi
    const id = generatePointOfInterestId(poi.name, usedIds)
    usedIds.push(id)
    return { ...poi, id }
  })

  // Only a real migration writes back. This key is vehicle-synced, so overwriting an unrecognized
  // value would delete the POIs of every operator of that vehicle, automatically and with no undo.
  if (storedPoisAreList && JSON.stringify(migrated) !== JSON.stringify(storedPois)) {
    pointsOfInterest.value = migrated
  }

  // Live coordinate values mirrored from the data lake, keyed by variable id.
  const liveCoordinateValues = reactive<Record<string, number | undefined>>({})

  // Listeners this composable holds on each POI's own coordinate variables.
  const outputListeners: Record<
    string,
    {
      /** Id of the POI coordinate variable being listened to */
      variableId: string
      /** Listener handle returned by `listenDataLakeVariable` */
      listenerId: string
    }[]
  > = {}

  const mirrorLiveValue = (variableId: string): void => {
    const value = getDataLakeVariableData(variableId)
    liveCoordinateValues[variableId] = typeof value === 'number' ? value : undefined
  }

  const syncOutputListeners = (pois: PointOfInterest[]): void => {
    const presentIds = new Set(pois.map((poi) => poi.id))

    Object.keys(outputListeners).forEach((poiId) => {
      if (presentIds.has(poiId)) return
      outputListeners[poiId].forEach(({ variableId, listenerId }) => unlistenDataLakeVariable(variableId, listenerId))
      delete outputListeners[poiId]
      delete liveCoordinateValues[poiLatitudeVariableId(poiId)]
      delete liveCoordinateValues[poiLongitudeVariableId(poiId)]
    })

    pois.forEach((poi) => {
      if (outputListeners[poi.id]) return
      const latitudeVariableId = poiLatitudeVariableId(poi.id)
      const longitudeVariableId = poiLongitudeVariableId(poi.id)
      mirrorLiveValue(latitudeVariableId)
      mirrorLiveValue(longitudeVariableId)
      outputListeners[poi.id] = [
        {
          variableId: latitudeVariableId,
          listenerId: listenDataLakeVariable(latitudeVariableId, () => mirrorLiveValue(latitudeVariableId)),
        },
        {
          variableId: longitudeVariableId,
          listenerId: listenDataLakeVariable(longitudeVariableId, () => mirrorLiveValue(longitudeVariableId)),
        },
      ]
    })
  }

  // Fixed (number) coordinates are reflected into the reactive mirror immediately, so dragging or
  // editing a POI moves its marker without waiting on the transforming function's delayed re-eval.
  const seedLiteralCoordinateValues = (pois: PointOfInterest[]): void => {
    pois.forEach((poi) => {
      if (typeof poi.latitude === 'number') liveCoordinateValues[poiLatitudeVariableId(poi.id)] = poi.latitude
      if (typeof poi.longitude === 'number') liveCoordinateValues[poiLongitudeVariableId(poi.id)] = poi.longitude
    })
  }

  let coordinateSyncFailureReported = false

  // The only place downstream code may assume a list, since this shared singleton is created during the
  // setup of every POI consumer and a throw here would take all of them down at once.
  const storedListIsReadable = computed(() => Array.isArray(pointsOfInterest.value))
  const validPointsOfInterest = computed<PointOfInterest[]>(() =>
    storedListIsReadable.value ? pointsOfInterest.value : []
  )

  watch(
    validPointsOfInterest,
    (pois) => {
      // An unreadable value means the POI list is unknown, not empty, and `syncPoiCoordinateVariables`
      // prunes every POI transforming function it is not given, so syncing an empty list here would
      // delete them all and push that deletion to the vehicle.
      if (!storedListIsReadable.value) {
        console.warn(`[PointsOfInterest] Stored '${pointsOfInterestKey}' is not a list. Skipping coordinate sync.`)
        return
      }
      // The data lake and its transforming functions are shared state the POIs neither own nor can
      // validate, so a malformed entry there degrades the POI coordinates rather than the consumers.
      try {
        syncPoiCoordinateVariables(pois)
        syncOutputListeners(pois)
        seedLiteralCoordinateValues(pois)
      } catch (error) {
        console.error(`[PointsOfInterest] Failed to sync the points of interest. Error: ${error}`)
        // Every later POI edit hits the same failure, so tell the user once instead of on each one.
        if (!coordinateSyncFailureReported) {
          coordinateSyncFailureReported = true
          const failureMessage = 'Could not update the points of interest. Their positions may be out of date.'
          openSnackbar({ message: failureMessage, variant: 'error', closeButton: true })
        }
      }
    },
    { deep: true, immediate: true }
  )

  const resolvedPointsOfInterest = computed<ResolvedPointOfInterest[]>(() =>
    validPointsOfInterest.value.map((poi) => {
      const latitudeVariableId = poiLatitudeVariableId(poi.id)
      const longitudeVariableId = poiLongitudeVariableId(poi.id)
      // Every POI follows its data-lake-backed coordinates. A fixed number is just an expression that
      // resolves to itself; a string is a live data-lake expression that may track another variable.
      const isLiveTracked = typeof poi.latitude === 'string' || typeof poi.longitude === 'string'

      const latitude = liveCoordinateValues[latitudeVariableId]
      const longitude = liveCoordinateValues[longitudeVariableId]
      const hasValidPosition = typeof latitude === 'number' && typeof longitude === 'number'
      const coordinates: PointOfInterestCoordinates = hasValidPosition
        ? [latitude as number, longitude as number]
        : poi.fallbackCoordinates

      return { ...poi, coordinates, isLiveTracked, hasValidPosition, latitudeVariableId, longitudeVariableId }
    })
  )

  // The mutators go through the normalized list, so an unreadable stored value makes an edit a no-op
  // instead of a throw. Adding is the exception: the user asked for a POI, so the list is rewritten.
  const addPointOfInterest = (poi: PointOfInterest): void => {
    pointsOfInterest.value = [...validPointsOfInterest.value, poi]
  }

  const updatePointOfInterest = (id: string, update: Partial<PointOfInterest>): void => {
    const index = validPointsOfInterest.value.findIndex((poi) => poi.id === id)
    if (index === -1) return
    pointsOfInterest.value[index] = { ...pointsOfInterest.value[index], ...update, timestamp: Date.now() }
  }

  const removePointOfInterest = (id: string): void => {
    const index = validPointsOfInterest.value.findIndex((poi) => poi.id === id)
    if (index !== -1) pointsOfInterest.value.splice(index, 1)
  }

  const movePointOfInterest = (id: string, newCoordinates: PointOfInterestCoordinates): void => {
    updatePointOfInterest(id, {
      latitude: newCoordinates[0],
      longitude: newCoordinates[1],
      fallbackCoordinates: newCoordinates,
    })
  }

  return {
    pointsOfInterest: validPointsOfInterest,
    resolvedPointsOfInterest,
    addPointOfInterest,
    updatePointOfInterest,
    removePointOfInterest,
    movePointOfInterest,
  }
}

/**
 * Reactive access to the points of interest, with coordinates backed by the data lake.
 * State is created once and shared across all callers.
 * @returns {PointsOfInterestState} The shared points-of-interest state and actions
 */
export const usePointsOfInterest = (): PointsOfInterestState => {
  if (!state) state = createState()
  return state
}
