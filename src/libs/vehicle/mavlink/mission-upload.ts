import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavMissionResult, MavMissionType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import type { SignalTyped } from '@/libs/signal'
import { fail, MISSION, waitPulse } from '@/libs/vehicle/mavlink/mission-transfer'
import { isFromMissionType } from '@/libs/vehicle/mavlink/types'
import { type MissionLoadingCallback, defaultLoadingCallback } from '@/types/mission'

// ponytail: cannot window items — ArduPilot rejects out-of-sequence seq. Retry only the last
// requested item (or MISSION_COUNT if none yet). Per-seq timeout if idle still duplicates on a slow FC.
const RETRY_IDLE_MS = 250
const MAX_RETRY_IDLE_MS = 1280

/**
 * Vehicle surface used to upload a mission micro-service. Matches the methods already on `MAVLinkVehicle`.
 */
export type MissionUploadPort = {
  /**
   * Tell the vehicle how many MISSION_ITEM_INT messages will follow.
   * @param {number} itemsCount Number of items
   * @param {MavMissionType} missionType Mission type
   * @returns {void}
   */
  sendMissionCount: (itemsCount: number, missionType: MavMissionType) => void
  /**
   * Send one pre-built MISSION_ITEM_INT.
   * @param {Message.MissionItemInt} item Item to send
   * @returns {void}
   */
  sendMissionItemInt: (item: Message.MissionItemInt) => void
  /**
   * Incoming MAVLink stream used to collect MISSION_REQUEST / MISSION_REQUEST_INT / MISSION_ACK.
   */
  onIncomingMAVLinkMessage: SignalTyped
}

/**
 * Upload every item of one mission micro-service (regular mission, geofence or rally points).
 *
 * The vehicle asks for one sequence at a time; out-of-order items are dropped, so this cannot
 * burst a window the way download does. It still answers each `MISSION_REQUEST` / `MISSION_REQUEST_INT`
 * immediately on the incoming stream (instead of polling the last message and waiting 250 ms before
 * even looking at an ACK), and resends the outstanding count or item after a short idle.
 * @param {MissionUploadPort} vehicle Vehicle used to send count/items and receive requests
 * @param {Message.MissionItemInt[]} items Items to send, already converted and sequenced
 * @param {MavMissionType} missionType Mission micro-service to upload to
 * @param {MissionLoadingCallback} loadingCallback Progress from 0 to 100
 * @param {number} stallTimeoutMs Fail if a new request or an accepted ACK does not arrive for this long
 * @returns {Promise<void>} Resolves when the vehicle accepts the transfer
 */
export const uploadMissionItems = async (
  vehicle: MissionUploadPort,
  items: Message.MissionItemInt[],
  missionType: MavMissionType = MISSION,
  loadingCallback: MissionLoadingCallback = defaultLoadingCallback,
  stallTimeoutMs = 3000
): Promise<void> => {
  const kind = missionType === MavMissionType.MAV_MISSION_TYPE_FENCE ? 'geofence' : 'mission'
  let lastSeq: number | undefined
  let accepted = false
  let refused: MavMissionResult | undefined
  let lastProgress = Date.now()
  let pulse: (() => void) | null = null
  const setPulse = (cb: (() => void) | null): void => {
    pulse = cb
  }

  const sendItem = (seq: number): void => {
    vehicle.sendMissionItemInt(items[seq])
    lastSeq = seq
    void loadingCallback((100 * (seq + 1)) / items.length)
  }

  const onRequest = (pack: Package): void => {
    if (!isFromMissionType(pack.message, missionType)) return
    const seq = Number((pack.message as Message.MissionRequestInt).seq)
    if (!Number.isFinite(seq) || seq < 0 || seq >= items.length) return
    sendItem(seq)
    lastProgress = Date.now()
    pulse?.()
  }
  const onAck = (pack: Package): void => {
    if (!isFromMissionType(pack.message, missionType)) return
    const result = (pack.message as Message.MissionAck).mavtype?.type
    if (result === MavMissionResult.MAV_MISSION_ACCEPTED) {
      accepted = true
      lastProgress = Date.now()
      pulse?.()
      return
    }
    if (result === undefined) return
    // A late retry of lastSeq can provoke this; the next request still finishes the upload.
    if (result === MavMissionResult.MAV_MISSION_INVALID_SEQUENCE) return
    refused = result
    pulse?.()
  }

  vehicle.onIncomingMAVLinkMessage.add(MAVLinkType.MISSION_REQUEST, onRequest)
  vehicle.onIncomingMAVLinkMessage.add(MAVLinkType.MISSION_REQUEST_INT, onRequest)
  vehicle.onIncomingMAVLinkMessage.add(MAVLinkType.MISSION_ACK, onAck)

  const retry = (): void => {
    if (lastSeq === undefined) {
      vehicle.sendMissionCount(items.length, missionType)
      return
    }
    sendItem(lastSeq)
  }

  try {
    void loadingCallback(0)
    console.debug(`[Mission upload] Sending ${items.length} mission items.`)
    vehicle.sendMissionCount(items.length, missionType)

    lastProgress = Date.now()
    let idleMs = RETRY_IDLE_MS
    while (!accepted) {
      if (refused !== undefined) {
        fail(
          `[Mission upload] Mission upload failed (${refused}).`,
          `The vehicle refused the ${kind}. Check that it has room for one this size and try again.`
        )
      }
      if (Date.now() - lastProgress > stallTimeoutMs) {
        fail(
          '[Mission upload] Timeout reached while uploading mission.',
          `Timed out waiting for the vehicle to accept the ${kind}. Check the connection and try again.`
        )
      }
      try {
        await waitPulse(idleMs, setPulse)
      } catch {
        retry()
        idleMs = Math.min(idleMs * 2, MAX_RETRY_IDLE_MS)
      }
    }

    console.debug('[Mission upload] Successfully sent all mission items.')
    void loadingCallback(100)
  } finally {
    vehicle.onIncomingMAVLinkMessage.remove(MAVLinkType.MISSION_REQUEST, onRequest)
    vehicle.onIncomingMAVLinkMessage.remove(MAVLinkType.MISSION_REQUEST_INT, onRequest)
    vehicle.onIncomingMAVLinkMessage.remove(MAVLinkType.MISSION_ACK, onAck)
  }
}
