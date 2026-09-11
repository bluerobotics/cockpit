import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MAVLinkType, MavMissionType } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { type Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import type { SignalTyped } from '@/libs/signal'
import { type MissionLoadingCallback, defaultLoadingCallback } from '@/types/mission'

const MISSION = MavMissionType.MAV_MISSION_TYPE_MISSION

// ponytail: idle backoff grows on silence and does not reset when an item lands, so a
// slow link does not re-burst the window per waypoint. IN_FLIGHT=64 caps a hostile
// MISSION_COUNT. Per-seq request age if the first idle still duplicates a large window.
const RETRY_IDLE_MS = 80
const MAX_RETRY_IDLE_MS = 1280
const IN_FLIGHT = 64
const MAX_MISSION_ITEMS = 4096

const COUNT_TIMEOUT = 'Timed out waiting for the mission size from the vehicle. Check the connection and try again.'
const ITEMS_TIMEOUT = 'Timed out waiting for mission items from the vehicle. Check the connection and try again.'
const COUNT_TOO_LARGE = `The vehicle reported more than ${MAX_MISSION_ITEMS} mission items, which Cockpit will not download. Check the mission on the vehicle and try again.`

/**
 * Vehicle surface used to download a regular mission. Matches the methods already on `MAVLinkVehicle`.
 */
export type MissionDownloadPort = {
  /**
   * Ask the vehicle for MISSION_COUNT.
   * @param {MavMissionType} missionType Mission type to list
   * @returns {void}
   */
  requestMissionItemsList: (missionType: MavMissionType) => void
  /**
   * Ask the vehicle for one MISSION_ITEM_INT.
   * @param {number} seq Item sequence
   * @param {MavMissionType} missionType Mission type
   * @returns {void}
   */
  requestMissionItem: (seq: number, missionType: MavMissionType) => void
  /**
   * Acknowledge the finished transfer.
   * @param {boolean} success Whether every item arrived
   * @param {MavMissionType} missionType Mission type
   * @returns {void}
   */
  sendMissionAck: (success: boolean, missionType: MavMissionType) => void
  /**
   * Incoming MAVLink stream used to collect MISSION_COUNT / MISSION_ITEM_INT.
   */
  onIncomingMAVLinkMessage: SignalTyped
}

/**
 * Wait until `pulse` is called or `ms` elapses.
 * @param {number} ms Idle timeout
 * @param {(cb: (() => void) | null) => void} setPulse Register or clear the current waiter
 * @returns {Promise<void>} Resolves on pulse, rejects with `idle` on timeout
 */
const waitPulse = (ms: number, setPulse: (cb: (() => void) | null) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      setPulse(null)
      reject(new Error('idle'))
    }, ms)
    setPulse(() => {
      clearTimeout(timer)
      setPulse(null)
      resolve()
    })
  })

const fail = (log: string, user: string): never => {
  console.error(log)
  throw new Error(user)
}

/**
 * Download every regular-mission item.
 *
 * After MISSION_COUNT, keep a window of outstanding `MISSION_REQUEST_INT`s so RTTs overlap,
 * then retry only the in-flight holes after a short idle (with backoff). The old loop asked
 * for one item, waited for it (and at least 250 ms before retrying), then asked for the next.
 * @param {MissionDownloadPort} vehicle Vehicle used to send requests and receive items
 * @param {MissionLoadingCallback} loadingCallback Progress from 0 to 100
 * @param {number} stallTimeoutMs Fail if the count or a new item does not arrive for this long
 * @returns {Promise<Message.MissionItemInt[]>} Items in sequence order
 */
export const downloadMissionItems = async (
  vehicle: MissionDownloadPort,
  loadingCallback: MissionLoadingCallback = defaultLoadingCallback,
  stallTimeoutMs = 10000
): Promise<Message.MissionItemInt[]> => {
  const items = new Map<number, Message.MissionItemInt>()
  const inFlight = new Set<number>()
  let total: number | undefined
  let pulse: (() => void) | null = null
  const setPulse = (cb: (() => void) | null): void => {
    pulse = cb
  }

  const onCount = (pack: Package): void => {
    if (total !== undefined) return
    const raw = Number((pack.message as Message.MissionCount).count)
    if (!Number.isFinite(raw) || raw < 0) return
    total = raw
    pulse?.()
  }
  const onItem = (pack: Package): void => {
    if (total === undefined) return
    const item = pack.message as Message.MissionItemInt
    const seq = item.seq
    if (!Number.isFinite(seq) || seq < 0 || seq >= total) return
    items.set(seq, item)
    inFlight.delete(seq)
    pulse?.()
  }

  vehicle.onIncomingMAVLinkMessage.add(MAVLinkType.MISSION_COUNT, onCount)
  vehicle.onIncomingMAVLinkMessage.add(MAVLinkType.MISSION_ITEM_INT, onItem)

  // ponytail: full-range scan per item, O(n²) at MAX_MISSION_ITEMS; cursor past the contiguous prefix if 4096-waypoint missions are real.
  const holes = (): number[] => {
    const missing: number[] = []
    if (total === undefined) return missing
    for (let seq = 0; seq < total; seq++) {
      if (!items.has(seq)) missing.push(seq)
    }
    return missing
  }

  const refill = (): number => {
    const missing = holes()
    for (const seq of missing) {
      if (inFlight.size >= IN_FLIGHT) break
      if (inFlight.has(seq)) continue
      vehicle.requestMissionItem(seq, MISSION)
      inFlight.add(seq)
    }
    return missing.length
  }

  const retryInFlight = (): void => {
    for (const seq of inFlight) vehicle.requestMissionItem(seq, MISSION)
  }

  try {
    void loadingCallback(0)
    console.debug('[Mission download] Requesting number of mission items to be downloaded...')
    vehicle.requestMissionItemsList(MISSION)
    const countDeadline = Date.now() + stallTimeoutMs
    while (total === undefined) {
      const remaining = countDeadline - Date.now()
      if (remaining <= 0) {
        fail('[Mission download] Timeout reached while fetching mission count.', COUNT_TIMEOUT)
      }
      try {
        await waitPulse(remaining, setPulse)
      } catch {
        fail('[Mission download] Timeout reached while fetching mission count.', COUNT_TIMEOUT)
      }
    }

    console.debug(`[Mission download] Mission count received! ${total} items to be downloaded.`)
    if (total > MAX_MISSION_ITEMS) {
      fail('[Mission download] Mission count exceeds the download limit.', COUNT_TOO_LARGE)
    }
    if (total === 0) {
      console.debug('[Mission download] No mission items to download.')
      vehicle.sendMissionAck(true, MISSION)
      void loadingCallback(100)
      return []
    }

    let remainingHoles = refill()
    void loadingCallback((100 * items.size) / total)

    let lastProgress = Date.now()
    let lastHave = items.size
    let idleMs = RETRY_IDLE_MS
    while (remainingHoles > 0) {
      if (Date.now() - lastProgress > stallTimeoutMs) {
        fail('[Mission download] Timeout reached while downloading mission items.', ITEMS_TIMEOUT)
      }
      try {
        await waitPulse(idleMs, setPulse)
      } catch {
        retryInFlight()
        idleMs = Math.min(idleMs * 2, MAX_RETRY_IDLE_MS)
      }
      remainingHoles = refill()
      if (items.size > lastHave) {
        lastHave = items.size
        lastProgress = Date.now()
      }
      void loadingCallback((100 * items.size) / total)
    }

    const ordered: Message.MissionItemInt[] = []
    for (let seq = 0; seq < total; seq++) ordered.push(items.get(seq) as Message.MissionItemInt)
    console.debug('[Mission download] Successfully downloaded all mission items.')
    vehicle.sendMissionAck(true, MISSION)
    void loadingCallback(100)
    return ordered
  } finally {
    vehicle.onIncomingMAVLinkMessage.remove(MAVLinkType.MISSION_COUNT, onCount)
    vehicle.onIncomingMAVLinkMessage.remove(MAVLinkType.MISSION_ITEM_INT, onItem)
  }
}
