import { computed, ComputedRef, reactive } from 'vue'

import { ConnectionManager } from '@/libs/connection/connection-manager'

/**
 * State for the MAVLink message dumper.
 */
interface DumperState {
  /**
   * Whether the dumper is currently capturing incoming messages.
   */
  isRecording: boolean
  /**
   * Number of messages captured in the current dump buffer.
   */
  messageCount: number
  /**
   * Approximate size of the dump buffer in bytes (sum of serialized line lengths).
   */
  dumpSizeBytes: number
  /**
   * Unix timestamp (ms) when the current recording started, or null if not recording.
   */
  startedAt: number | null
  /**
   * Monotonic counter bumped whenever the buffer is cleared or a new recording starts. Lives in
   * reactive state so consumers can `watch` it.
   */
  revision: number
}

const state = reactive<DumperState>({
  isRecording: false,
  messageCount: 0,
  dumpSizeBytes: 0,
  startedAt: null,
  revision: 0,
})

const decoder = new TextDecoder()
const lines: string[] = []
let onIncomingDataSlot: ((data: Uint8Array) => void) | undefined
let onOutgoingDataSlot: ((data: Uint8Array) => void) | undefined

/**
 * Direction of a captured MAVLink frame relative to Cockpit.
 * - `in`: received from the vehicle/main connection.
 * - `out`: sent by Cockpit to the vehicle/main connection.
 */
export type MavlinkDumperDirection = 'in' | 'out'

/**
 * Parsed JSONL entry shape used by both the dumper output and live consumers.
 */
export interface MavlinkDumperEntry {
  /** Timestamp the message was captured at (unix-ms). */
  ts: number
  /** Direction the message travelled. Omitted on dumps captured before bidirectional support. */
  dir?: MavlinkDumperDirection
  /** Parsed MAVLink2REST payload as received from / sent to the connection. */
  msg: unknown
}

type EntryListener = (entry: MavlinkDumperEntry) => void
const entryListeners = new Set<EntryListener>()

const bumpDumperRevision = (): void => {
  state.revision += 1
}

/**
 * Monotonic counter bumped whenever the in-memory dump buffer is cleared or a new recording starts.
 * Live plot uses this to discard stale parsed state.
 */
export const mavlinkDumperRevision: ComputedRef<number> = computed(() => state.revision)

/** Message count above which live plot should warn about resource usage. */
export const mavlinkDumperLargeBufferMessageThreshold = 10_000

/**
 * Capture one MAVLink2REST chunk (a complete JSON payload) into the buffer and notify listeners.
 * @param {Uint8Array} data - Raw bytes from `ConnectionManager.onRead` / `onWrite`.
 * @param {MavlinkDumperDirection} dir - Direction the bytes travelled.
 */
const captureFrame = (data: Uint8Array, dir: MavlinkDumperDirection): void => {
  const text = decoder.decode(data)
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    payload = text
  }
  const entry: MavlinkDumperEntry = { ts: Date.now(), dir, msg: payload }
  const line = JSON.stringify(entry)
  lines.push(line)
  state.messageCount += 1
  state.dumpSizeBytes += line.length + 1

  if (entryListeners.size > 0) {
    for (const listener of entryListeners) {
      try {
        listener(entry)
      } catch (error) {
        console.error('MAVLink dumper entry listener failed:', error)
      }
    }
  }
}

const handleIncomingData = (data: Uint8Array): void => captureFrame(data, 'in')
const handleOutgoingData = (data: Uint8Array): void => captureFrame(data, 'out')

/**
 * Subscribe to parsed dump entries as they arrive. Lets live consumers skip re-parsing the
 * stringified buffer on every refresh tick.
 * @param {EntryListener} listener - Called for every captured message while subscribed.
 * @returns {() => void} A function that removes the listener.
 */
export const addMavlinkDumperEntryListener = (listener: EntryListener): (() => void) => {
  entryListeners.add(listener)
  return () => {
    entryListeners.delete(listener)
  }
}

/**
 * Whether the dumper is currently capturing data.
 */
export const isMavlinkDumperRecording: ComputedRef<boolean> = computed(() => state.isRecording)

/**
 * Number of messages captured in the current dump buffer.
 */
export const mavlinkDumperMessageCount: ComputedRef<number> = computed(() => state.messageCount)

/**
 * Approximate size of the current dump buffer in bytes.
 */
export const mavlinkDumperDumpSizeBytes: ComputedRef<number> = computed(() => state.dumpSizeBytes)

/**
 * Unix timestamp (ms) when the current recording started, or null if not recording.
 */
export const mavlinkDumperStartedAt: ComputedRef<number | null> = computed(() => state.startedAt)

/**
 * Whether there is a dump available to download.
 */
export const mavlinkDumperHasDump: ComputedRef<boolean> = computed(() => state.messageCount > 0)

/**
 * Start capturing MAVLink messages (both incoming and outgoing) from the main connection. Clears
 * any previously captured dump. Subsequent calls while already recording are no-ops.
 */
export const startMavlinkDumperRecording = (): void => {
  if (state.isRecording) return
  lines.length = 0
  state.messageCount = 0
  state.dumpSizeBytes = 0
  state.startedAt = Date.now()
  bumpDumperRevision()
  onIncomingDataSlot = handleIncomingData
  onOutgoingDataSlot = handleOutgoingData
  ConnectionManager.onRead.add(onIncomingDataSlot)
  ConnectionManager.onWrite.add(onOutgoingDataSlot)
  state.isRecording = true
}

/**
 * Stop capturing MAVLink messages. The captured dump remains available for download until
 * `clearMavlinkDumperDump` is called or a new recording is started.
 */
export const stopMavlinkDumperRecording = (): void => {
  if (!state.isRecording) return
  if (onIncomingDataSlot) {
    ConnectionManager.onRead.remove(onIncomingDataSlot)
    onIncomingDataSlot = undefined
  }
  if (onOutgoingDataSlot) {
    ConnectionManager.onWrite.remove(onOutgoingDataSlot)
    onOutgoingDataSlot = undefined
  }
  state.isRecording = false
}

/**
 * Discard the current dump buffer and reset counters.
 */
export const clearMavlinkDumperDump = (): void => {
  lines.length = 0
  state.messageCount = 0
  state.dumpSizeBytes = 0
  state.startedAt = null
  bumpDumperRevision()
}

/**
 * Build the dump as a single JSONL string. Each line is a JSON object of the form
 * `{ "ts": <unix_ms>, "msg": <parsed_mavlink2rest_payload> }`.
 * @returns {string} The full dump as a JSONL string. Empty when no messages have been captured.
 */
export const getMavlinkDumperDump = (): string => {
  return lines.join('\n')
}

/**
 * Return captured dump lines without joining them. Useful for incremental live-plot updates.
 * @param {number} fromIndex - Index of the first line to include.
 * @param {number} [toIndex] - Index after the last line to include. Defaults to the buffer length.
 * @returns {string[]} The requested slice of JSONL lines.
 */
export const getMavlinkDumperLines = (fromIndex = 0, toIndex = lines.length): string[] => {
  return lines.slice(fromIndex, toIndex)
}
