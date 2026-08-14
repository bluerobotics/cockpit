/**
 * Manages the secondary MAVLink2Rest connections: extra vehicles on the network whose telemetry is mirrored
 * into the data lake, so widgets and live-tracked points of interest can follow them without any of them
 * becoming the main vehicle.
 *
 * These links are read-only by design, so no command can ever reach a vehicle the user is not piloting.
 * They also bypass `ConnectionManager`, since adding a connection there replaces the main connection (and
 * disconnects the previous one), and its `onRead` is what feeds the main vehicle and the vehicle factory.
 *
 * This module has no Vue dependencies; reactive orchestration lives in the `secondaryVehicles` composable.
 */

import {
  createDataLakeVariable,
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import * as Connection from '@/libs/connection/connection'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MavAutopilot, MAVLinkType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { WebSocketConnection } from '@/libs/connection/websocket-connection'
import type { ConnectionStatus } from '@/libs/utils/ui'
import { injectMavlinkPackageIntoDataLake } from '@/libs/vehicle/mavlink/data-lake-injection'
import * as Protocol from '@/libs/vehicle/protocol/protocol'

/** Persistence key for the configured secondary connection addresses. Machine-local: these are addresses on the local network. */
export const secondaryVehicleUrisKey = 'cockpit-secondary-mavlink2rest-uris'

const LOG_PREFIX = '[SecondaryVehicles]'

/**
 * Runtime state of a secondary connection, used for UI feedback.
 */
export interface SecondaryConnectionState {
  /**
   * Whether the underlying websocket is currently open.
   */
  isConnected: boolean
  /**
   * Epoch of the last message received, or undefined while nothing has arrived yet.
   */
  lastMessageAt: number | undefined
  /**
   * System IDs of the vehicles announced on this link, which is what names their data-lake variables.
   */
  systemIds: number[]
}

const connections = new Map<string, WebSocketConnection>()
const lastMessageAt = new Map<string, number>()
const systemIds = new Map<string, Set<number>>()

// A data-lake id names exactly one system, so the first link to announce a vehicle with a given system ID is
// the only one allowed to write that system's variables.
const systemIdOwners = new Map<number, string>()

// Per vehicle instead of per link, since one link carries every system on the vehicle's network.
const lastMessageAtBySystemId = new Map<number, number>()

const isReceivingDataPollIntervalMs = 1000

let isReceivingDataPoll: ReturnType<typeof setInterval> | undefined

const textDecoder = new TextDecoder()

// A MAVLink stream carries every system on the vehicle's network, including BlueOS services and other ground
// stations, so a vehicle is only counted when it announces a real autopilot, as the vehicle factory does.
const isVehicleHeartbeat = (mavlinkPackage: Package): boolean =>
  mavlinkPackage.message.type === MAVLinkType.HEARTBEAT &&
  (mavlinkPackage.message as Message.Heartbeat).autopilot?.type !== MavAutopilot.MAV_AUTOPILOT_INVALID

/**
 * Whether a system still counts as being received, from when it was last heard and how long it may stay
 * silent. Pure, so the same decision serves both the per-link status and the per-vehicle data-lake variables.
 * @param {number | undefined} lastMessageEpoch Epoch of the last message from the system, or undefined if it
 * has never been heard from
 * @param {number} nowEpoch Epoch to measure the silence against
 * @param {number} timeoutMs How long the system may stay silent before it stops counting as received
 * @returns {boolean} Whether data from the system is currently arriving
 */
export const isReceivingData = (lastMessageEpoch: number | undefined, nowEpoch: number, timeoutMs: number): boolean =>
  lastMessageEpoch !== undefined && nowEpoch - lastMessageEpoch < timeoutMs

// Created on the first message of each system, since the systems on a link are only discovered from its
// stream, as the '/mavlink/<system id>/...' variables are.
const setIsReceivingDataVariable = (systemId: number, isReceiving: boolean): void => {
  const id = `/vehicles/mavlink/${systemId}/isReceivingData`
  if (getDataLakeVariableInfo(id) === undefined) {
    createDataLakeVariable({
      id,
      name: `Receiving data from vehicle ${systemId}`,
      type: 'boolean',
      description: `Whether data from the vehicle with system ID ${systemId} is currently arriving, so widgets can tell live values from the last ones received.`,
    })
  }
  setDataLakeVariableData(id, isReceiving)
}

const refreshIsReceivingDataVariables = (watchdogTimeoutMs: number): void => {
  const now = Date.now()
  lastMessageAtBySystemId.forEach((systemLastMessageAt, systemId) => {
    setIsReceivingDataVariable(systemId, isReceivingData(systemLastMessageAt, now, watchdogTimeoutMs))
  })
}

/**
 * Whether a value announced as a MAVLink system or component ID really is one. A secondary link's payload is
 * remote JSON whose header is only typed by assertion, and an ID that is not a number would still name
 * data-lake variables, slip past the numeric guards in `onSecondaryData`, and reach the coordinate
 * expressions generated from it.
 * @param {unknown} id Value announced in the package header
 * @returns {boolean} Whether it is a valid identifier
 */
export const isValidMavlinkId = (id: unknown): id is number =>
  typeof id === 'number' && Number.isInteger(id) && id >= 1 && id <= 255

const onSecondaryData = (uri: string, data: Uint8Array): void => {
  let mavlinkPackage: Package
  try {
    mavlinkPackage = JSON.parse(textDecoder.decode(data)) as Package
  } catch {
    return
  }
  const systemId = mavlinkPackage?.header?.system_id
  if (!isValidMavlinkId(systemId) || !isValidMavlinkId(mavlinkPackage.header?.component_id)) return
  if (mavlinkPackage.message?.type === undefined) return

  lastMessageAt.set(uri, Date.now())
  if (isVehicleHeartbeat(mavlinkPackage)) {
    systemIds.get(uri)?.add(systemId)
    if (!systemIdOwners.has(systemId)) systemIdOwners.set(systemId, uri)
  }

  // Only mirror systems this link announced as a vehicle, and never one using the piloted vehicle's ID, so no
  // other system can overwrite the variables the flight view reads. The main vehicle can also claim an ID
  // after a link did, which is why it is checked on every message instead of only when the ID is claimed.
  if (systemIdOwners.get(systemId) !== uri) return

  // ponytail: the piloted vehicle's ID is only known once it has connected, so a link using that ID can write
  // its variables until then. Listen to 'autopilotSystemId' and clear what it wrote if the window ever matters.
  if (systemId === getDataLakeVariableData('autopilotSystemId')) return

  // Tracked past the guards above so a vehicle only reports as received while its variables are being written.
  if (!lastMessageAtBySystemId.has(systemId)) setIsReceivingDataVariable(systemId, true)
  lastMessageAtBySystemId.set(systemId, Date.now())

  // ponytail: every message of every secondary link is turned into data-lake variables at whatever rate the
  // vehicle streams, so the cost grows with vehicles x message rate. Filter by message type here if needed.
  injectMavlinkPackageIntoDataLake(mavlinkPackage)
}

/**
 * Returns the current state of a secondary connection. Pull-based: this state is not pushed, the UI reads it
 * while it is on screen.
 * @param {string} uri Address of the secondary connection
 * @returns {SecondaryConnectionState} The connection's current state
 */
export const getSecondaryConnectionState = (uri: string): SecondaryConnectionState => ({
  isConnected: connections.get(uri)?.isConnected() ?? false,
  lastMessageAt: lastMessageAt.get(uri),
  systemIds: [...(systemIds.get(uri) ?? [])],
})

/**
 * Maps a connection's state to a status, distinguishing an open socket that is delivering data from one that
 * has gone silent. Silence is measured against the same timeout that recycles the socket, so the reported
 * status cannot contradict what the connection is about to do.
 * @param {SecondaryConnectionState} state State of the connection
 * @param {number} watchdogTimeoutMs How long the socket may stay silent before being recycled
 * @returns {ConnectionStatus} The corresponding status
 */
export const secondaryConnectionStatus = (
  state: SecondaryConnectionState,
  watchdogTimeoutMs: number
): ConnectionStatus => {
  if (!state.isConnected) return 'disconnected'
  return isReceivingData(state.lastMessageAt, Date.now(), watchdogTimeoutMs) ? 'connected' : 'connecting'
}

const statusLabels: Record<ConnectionStatus, string> = {
  connected: 'receiving data',
  connecting: 'connected, waiting for data',
  disconnected: 'disconnected',
}

/**
 * Maps a connection's state to a human-readable status label.
 * @param {SecondaryConnectionState} state State of the connection
 * @param {number} watchdogTimeoutMs How long the socket may stay silent before being recycled
 * @returns {string} The label
 */
export const secondaryConnectionStatusLabel = (state: SecondaryConnectionState, watchdogTimeoutMs: number): string =>
  statusLabels[secondaryConnectionStatus(state, watchdogTimeoutMs)]

/**
 * Opens and closes secondary connections so the open ones match the given addresses. Data-lake variables
 * already created by a removed connection are left in place, since widgets may still reference them; they
 * simply stop updating, as they do for any vehicle that goes away, after a final `false` on the vehicle's
 * `isReceivingData` variable.
 * @param {string[]} uris Addresses that should be connected
 * @param {() => number} getWatchdogTimeoutMs Returns the user-configured vehicle connection watchdog timeout
 * @returns {void}
 */
export const syncSecondaryVehicleConnections = (uris: string[], getWatchdogTimeoutMs: () => number): void => {
  const wantedUris = new Set(uris)

  connections.forEach((connection, uri) => {
    if (wantedUris.has(uri)) return
    connection.disconnect()
    connections.delete(uri)
    lastMessageAt.delete(uri)
    systemIds.delete(uri)
    systemIdOwners.forEach((owner, systemId) => {
      if (owner !== uri) return
      systemIdOwners.delete(systemId)
      // Only for the systems actually mirrored: one dropped by the guards in `onSecondaryData` never reported
      // as being received, so it has no variable to close out.
      if (lastMessageAtBySystemId.delete(systemId)) setIsReceivingDataVariable(systemId, false)
    })
    console.info(`${LOG_PREFIX} Closed the connection to '${uri}'.`)
  })

  wantedUris.forEach((uri) => {
    if (connections.has(uri)) return
    try {
      const parsedUri = new Connection.URI(uri)
      if (parsedUri.type() !== Connection.Type.WebSocket) {
        throw new Error('the address should start with ws:// or wss://')
      }
      systemIds.set(uri, new Set())
      const connection = new WebSocketConnection(parsedUri, Protocol.Type.MAVLink, { getWatchdogTimeoutMs })
      connection.onRead.add((data: Uint8Array) => onSecondaryData(uri, data))
      connections.set(uri, connection)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.error(`${LOG_PREFIX} Could not connect to '${uri}': ${reason}.`)
    }
  })

  // A vehicle going quiet sends no message to notice it by, so the per-vehicle variables are recomputed on a
  // timer, which only exists while at least one link does.
  if (connections.size === 0) {
    clearInterval(isReceivingDataPoll)
    isReceivingDataPoll = undefined
    return
  }
  isReceivingDataPoll ??= setInterval(
    () => refreshIsReceivingDataVariables(getWatchdogTimeoutMs()),
    isReceivingDataPollIntervalMs
  )
}
