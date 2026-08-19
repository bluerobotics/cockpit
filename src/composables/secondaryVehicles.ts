import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
import { generatePointOfInterestId, usePointsOfInterest } from '@/composables/usePointsOfInterest'
import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import {
  type SecondaryConnectionState,
  getSecondaryConnectionState,
  secondaryVehicleUrisKey,
  syncSecondaryVehicleConnections,
} from '@/libs/vehicle/mavlink/secondary-connections'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import type { PointOfInterestCoordinates } from '@/types/mission'

const storedUris = useStorage<string[]>(secondaryVehicleUrisKey, [])

/** Configured addresses, always read as a list even when the stored value is not one */
export const secondaryVehicleUris = computed<string[]>(() => (Array.isArray(storedUris.value) ? storedUris.value : []))

/** Runtime state of each configured address, as of the last {@link refreshSecondaryVehicleStates} call */
export const secondaryVehicleStates = ref<Record<string, SecondaryConnectionState>>({})

/** System IDs claimed by more than one other vehicle, so all but the first to announce each are being ignored */
export const duplicatedSecondaryVehicleSystemIds = computed<number[]>(() => {
  const systemIds = Object.values(secondaryVehicleStates.value).flatMap((state) => state.systemIds)
  return [...new Set(systemIds.filter((systemId, index) => systemIds.indexOf(systemId) !== index))]
})

/** Whether another vehicle uses the piloted vehicle's system ID, in which case it is dropped instead of ignored */
export const secondaryVehicleUsesMainVehicleSystemId = computed<boolean>(() => {
  const mainVehicleSystemId = getDataLakeVariableData('autopilotSystemId')
  if (typeof mainVehicleSystemId !== 'number') return false
  return Object.values(secondaryVehicleStates.value).some((state) => state.systemIds.includes(mainVehicleSystemId))
})

/**
 * Re-reads the runtime state of every connection, which the connections do not push on their own.
 * @returns {void}
 */
export const refreshSecondaryVehicleStates = (): void => {
  const states = secondaryVehicleUris.value.map((uri) => [uri, getSecondaryConnectionState(uri)] as const)
  secondaryVehicleStates.value = Object.fromEntries(states)
}

const refuse = (message: string): false => {
  openSnackbar({ message, variant: 'error', closeButton: true })
  return false
}

/**
 * Adds a vehicle by the address of its MAVLink stream, telling the user why it was refused when it cannot be
 * used.
 * @param {string} uri Address of the vehicle
 * @returns {boolean} Whether the vehicle was added
 */
export const addSecondaryVehicle = (uri: string): boolean => {
  const trimmedUri = uri.trim()
  if (trimmedUri === '') return false

  let normalizedUri: string
  try {
    const parsedUri = new Connection.URI(trimmedUri)
    if (parsedUri.type() !== Connection.Type.WebSocket) {
      throw new Error('the address should start with ws:// or wss://')
    }
    normalizedUri = parsedUri.toString()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return refuse(`Could not add the vehicle: ${reason}.`)
  }

  if (secondaryVehicleUris.value.includes(normalizedUri)) {
    return refuse('That vehicle has already been added.')
  }
  if (normalizedUri === ConnectionManager.mainConnection()?.uri().toString()) {
    return refuse('That is the address of the main vehicle, which is already connected.')
  }

  storedUris.value = [...secondaryVehicleUris.value, normalizedUri]
  logUserAction(`Added the secondary vehicle at '${normalizedUri}'`)
  openSnackbar({
    message: 'Vehicle added. Its telemetry will show up as data-lake variables once it starts arriving.',
    variant: 'success',
    duration: 5000,
  })
  return true
}

/**
 * Removes a vehicle and closes its connection.
 * @param {string} uri Address of the vehicle
 * @returns {void}
 */
export const removeSecondaryVehicle = (uri: string): void => {
  storedUris.value = secondaryVehicleUris.value.filter((entry) => entry !== uri)
  logUserAction(`Removed the secondary vehicle at '${uri}'`)
  openSnackbar({ message: 'Vehicle removed.', variant: 'success', duration: 3000 })
}

// The autopilot is component 1, as in every other place the vehicle position is read from, and it reports
// degrees scaled by 1e7.
const vehicleCoordinateVariable = (systemId: number, field: 'lat' | 'lon'): string =>
  `/mavlink/${systemId}/1/GLOBAL_POSITION_INT/${field}`

const vehiclePosition = (systemId: number): PointOfInterestCoordinates | undefined => {
  const latitude = getDataLakeVariableData(vehicleCoordinateVariable(systemId, 'lat'))
  const longitude = getDataLakeVariableData(vehicleCoordinateVariable(systemId, 'lon'))
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined
  return [latitude / 1e7, longitude / 1e7]
}

/**
 * Whether any of the given vehicles can be placed on the map, which takes a position having arrived from
 * it: the marker is stored with a fallback location for whoever has no live data for it, and there is no
 * honest one to store before the vehicle says where it is.
 * @param {number[]} systemIds System IDs of the vehicles to check
 * @returns {boolean} Whether at least one of them reported a position
 */
export const canPlaceSecondaryVehiclesOnMap = (systemIds: number[]): boolean =>
  systemIds.some((systemId) => vehiclePosition(systemId) !== undefined)

/**
 * Places a point of interest following the live position of each given vehicle, so the user gets it on the
 * map without writing its coordinate expressions by hand.
 * @param {number[]} systemIds System IDs of the vehicles to place
 * @returns {void}
 */
export const placeSecondaryVehiclesOnMap = (systemIds: number[]): void => {
  const { pointsOfInterest, addPointOfInterest } = usePointsOfInterest()

  const placedNames: string[] = []
  const alreadyPlacedNames: string[] = []
  const waitingNames: string[] = []

  systemIds.forEach((systemId) => {
    const name = `Vehicle ${systemId}`

    const position = vehiclePosition(systemId)
    if (position === undefined) {
      waitingNames.push(name)
      return
    }

    const latitude = `{{ ${vehicleCoordinateVariable(systemId, 'lat')} }} / 1e7`
    const longitude = `{{ ${vehicleCoordinateVariable(systemId, 'lon')} }} / 1e7`
    // The coordinate expression is what marks a POI as this vehicle's, unlike an id the user can also
    // produce by naming a POI after the vehicle.
    if (pointsOfInterest.value.some((poi) => poi.latitude === latitude)) {
      alreadyPlacedNames.push(name)
      return
    }

    addPointOfInterest({
      id: generatePointOfInterestId(
        name,
        pointsOfInterest.value.map((poi) => poi.id)
      ),
      name,
      description: `Live position of the vehicle with system ID ${systemId}.`,
      latitude,
      longitude,
      fallbackCoordinates: position,
      icon: 'mdi-map-marker',
      color: '#87CEEB',
      timestamp: Date.now(),
    })
    placedNames.push(name)
  })

  // An address can carry several vehicles, so each outcome is reported on its own instead of letting the
  // ones that were skipped, and why, go unmentioned.
  const outcomes: string[] = []
  if (placedNames.length > 0) outcomes.push(`${placedNames.join(', ')} placed on the map, tracking the live position.`)
  if (alreadyPlacedNames.length > 0) {
    outcomes.push(`${alreadyPlacedNames.join(', ')} ${alreadyPlacedNames.length === 1 ? 'was' : 'were'} already there.`)
  }
  if (waitingNames.length > 0) {
    const verb = waitingNames.length === 1 ? 'has' : 'have'
    outcomes.push(`${waitingNames.join(', ')} ${verb} not reported a position yet, and stayed off the map.`)
  }
  if (outcomes.length === 0) return

  if (placedNames.length > 0) logUserAction(`Placed ${placedNames.join(', ')} on the map`)
  openSnackbar({
    message: outcomes.join(' '),
    variant: placedNames.length > 0 ? 'success' : 'info',
    duration: 5000,
  })
}

/**
 * Keeps the open connections matching the configured addresses, so the telemetry mirroring runs without any
 * UI mounted.
 * @returns {void}
 */
export const initSecondaryVehicleConnections = (): void => {
  const mainVehicleStore = useMainVehicleStore()

  watch(
    secondaryVehicleUris,
    (uris) => {
      syncSecondaryVehicleConnections(uris, () => mainVehicleStore.vehicleConnectionWatchdogTimeoutMs)
      refreshSecondaryVehicleStates()
    },
    { immediate: true }
  )
}
