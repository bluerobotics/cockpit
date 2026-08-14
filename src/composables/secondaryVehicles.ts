import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { openSnackbar } from '@/composables/snackbar'
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
