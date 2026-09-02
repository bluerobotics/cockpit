import { format } from 'date-fns'

import {
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  listenDataLakeVariable,
  unlistenDataLakeVariable,
} from './actions/data-lake'
import { IndexedDbStore } from './indexed-db-store'
import { settingsManager } from './settings-management'
import {
  go2rtcStreamStatKeys,
  go2rtcStreamStatVariableId,
  streamStatVariableId,
  webRtcStreamStatKeys,
} from './video/stream-stats'
import { type ZipFileEntry, createZipBlob } from './zip'

export const recordedDataLakeVariablesKey = 'cockpit-data-lake-recorded-variables'
const exportVariableKeySetting = 'cockpit-data-lake-export-variable-key'
const logIntervalKey = 'cockpit-data-lake-log-interval'
const defaultLogInterval = 1000

// How often buffered points are flushed to IndexedDB as a single batched entry. Batching keeps
// high-frequency raw-mode logging from overwhelming IndexedDB; at most this much data is buffered
// in memory and would be lost on a hard crash/reload.
const flushIntervalMs = 250

let recordedVariableIdsChangedHandler = (): void => undefined

/**
 * Register a callback invoked after the recorded-variable selection is persisted, so a consumer can
 * react to a newly armed recording without polling for it.
 * @param {() => void} handler - Callback to run after the selection changes
 */
export const setRecordedVariableIdsChangedHandler = (handler: () => void): void => {
  recordedVariableIdsChangedHandler = handler
}

/**
 * How variable keys are labeled in exported CSV and JSON files
 */
export type DataLakeExportVariableKey = 'id' | 'short-id' | 'name'

/**
 * Logging cadence: a fixed interval in milliseconds, or 'raw' to log on every variable change
 */
export type DataLakeLogInterval = number | 'raw'

/**
 * A single recorded data point for selected data lake variables
 */
export interface DataLakeLogPoint {
  /**
   * Universal Linux epoch time (milliseconds since January 1st, 1970, UTC)
   */
  epoch: number
  /**
   * Raw variable values keyed by data lake variable ID
   */
  data: Record<string, string | number | boolean | undefined>
}

/**
 * A sequence of recorded data lake log points
 */
export type DataLakeLog = DataLakeLogPoint[]

/**
 * Result of building a ZIP archive from recorded data sessions
 */
export interface SessionsZipResult {
  /**
   * The generated ZIP archive
   */
  blob: Blob
  /**
   * Number of non-empty sessions written into the archive
   */
  includedCount: number
}

/**
 * Information about a recorded data session
 */
export interface DataLakeSessionInfo {
  /**
   * Unique identifier for the session
   */
  id: string
  /**
   * Identifier of the Cockpit run that produced the session
   */
  bootId: number
  /**
   * Start time of the session (epoch ms)
   */
  startTime: number
  /**
   * End time of the session (epoch ms)
   */
  endTime: number
  /**
   * Formatted date/time string
   */
  dateTimeFormatted: string
  /**
   * Number of data points in the session
   */
  dataPointCount: number
  /**
   * Duration of the session in seconds
   */
  durationSeconds: number
  /**
   * Whether this is the current active session
   */
  isCurrentSession: boolean
}

/**
 * Lightweight session metadata persisted alongside the raw log points
 */
export interface DataLakeSessionRecord {
  /**
   * Unique identifier for the session
   */
  id: string
  /**
   * Identifier of the Cockpit run that produced the session
   */
  bootId: number
  /**
   * Start time of the session (epoch ms)
   */
  startTime: number
  /**
   * Time of the most recent point in the session (epoch ms)
   */
  endTime: number
  /**
   * Number of data points recorded in the session
   */
  dataPointCount: number
}

const sessionGapThresholdMs = 5 * 60 * 1000

const isRtspUrlStreamStatId = (id: string): boolean => /^stream-rtsps?:\/\//i.test(id)

// Peel `stream-<name>` from an id that ends with a minting-function suffix, then remint to confirm.
// endsWith alone is not enough: one published key can be a suffix of another, and stream names have hyphens.
const nameBeforeStreamStatSuffix = (id: string, suffix: string): string | undefined => {
  if (!id.startsWith('stream-') || !id.endsWith(suffix)) return undefined
  const name = id.slice('stream-'.length, id.length - suffix.length)
  return name.length > 0 ? name : undefined
}

const publishedWebRtcStatSuffix = (key: string): string => streamStatVariableId('', key).slice('stream-'.length)

const isWebRtcStreamStatId = (id: string): boolean =>
  webRtcStreamStatKeys.some((key) => {
    const publishedSuffix = publishedWebRtcStatSuffix(key)
    const publishedName = nameBeforeStreamStatSuffix(id, publishedSuffix)
    if (publishedName !== undefined && streamStatVariableId(publishedName, key) === id) return true

    // When minting remaps a key, also treat stream-<name>-<rawKey> as a stream-stat id so the old form can be pruned.
    const rawSuffix = `-${key}`
    if (rawSuffix === publishedSuffix) return false
    const rawName = nameBeforeStreamStatSuffix(id, rawSuffix)
    return rawName !== undefined && streamStatVariableId(rawName, key) === `stream-${rawName}${publishedSuffix}`
  })

const isGo2rtcStreamStatId = (id: string): boolean =>
  go2rtcStreamStatKeys.some((key) => {
    const suffix = go2rtcStreamStatVariableId('', key).slice('stream-'.length)
    const name = nameBeforeStreamStatSuffix(id, suffix)
    return name !== undefined && go2rtcStreamStatVariableId(name, key) === id
  })

const isStreamStatVariableId = (id: string): boolean => isWebRtcStreamStatId(id) || isGo2rtcStreamStatId(id)

/**
 * Drop recorded stream-stat IDs that are no longer live: deleted streams, and pre-switch IDs keyed
 * by external id (an RTSP URL may carry credentials into an export header).
 * @param {string[]} recordedIds - Currently recorded data-lake variable IDs
 * @param {string[]} liveInternalNames - Internal stream names currently in the correspondency
 * @returns {string[]} Recorded IDs with stale stream-stat entries removed
 */
export const pruneStaleStreamStatRecordedIds = (recordedIds: string[], liveInternalNames: string[]): string[] => {
  const liveIds = new Set(
    liveInternalNames.flatMap((name) => [
      ...webRtcStreamStatKeys.map((key) => streamStatVariableId(name, key)),
      ...go2rtcStreamStatKeys.map((key) => go2rtcStreamStatVariableId(name, key)),
    ])
  )

  return recordedIds.filter((id) => {
    if (isRtspUrlStreamStatId(id)) return false
    if (!isStreamStatVariableId(id)) return true
    return liveIds.has(id)
  })
}

/**
 * Widen a session's time range to cover a flushed batch, starting a new session when the gap is too
 * large. Leaves dataPointCount unchanged so the count is credited only after the batch write lands.
 * @param {DataLakeSessionRecord | null} session - Session currently being written, if any
 * @param {number} bootId - Identifier of the Cockpit run producing the session
 * @param {number} firstEpoch - Epoch of the first point in the batch
 * @param {number} lastEpoch - Epoch of the last point in the batch
 * @returns {DataLakeSessionRecord} Session covering the batch's range
 */
export const sessionRangeCoveringBatch = (
  session: DataLakeSessionRecord | null,
  bootId: number,
  firstEpoch: number,
  lastEpoch: number
): DataLakeSessionRecord => {
  if (!session || firstEpoch - session.endTime > sessionGapThresholdMs) {
    return {
      id: `session-${firstEpoch}`,
      bootId,
      startTime: firstEpoch,
      endTime: lastEpoch,
      dataPointCount: 0,
    }
  }

  return { ...session, endTime: lastEpoch }
}

/**
 * Credit a landed batch to the session covering it. Returns null when the epoch falls outside the
 * session, so a late credit after a new session has started is dropped rather than applied to the wrong one.
 * @param {DataLakeSessionRecord} session - Session that should own the batch
 * @param {number} epoch - Epoch of the landed batch's first point
 * @param {number} pointCount - Number of points in the landed batch
 * @returns {DataLakeSessionRecord | null} Session with the points credited, or null when the epoch is out of range
 */
export const sessionWithCreditedPoints = (
  session: DataLakeSessionRecord,
  epoch: number,
  pointCount: number
): DataLakeSessionRecord | null => {
  if (epoch < session.startTime || epoch > session.endTime) return null

  return { ...session, dataPointCount: session.dataPointCount + pointCount }
}

/**
 * Records raw data lake variable values to a dedicated IndexedDB store
 */
export class DataLakeLogger {
  private isLogging = false
  private _recordedVariableIds?: string[]
  private _exportVariableKey?: DataLakeExportVariableKey
  private _logInterval?: DataLakeLogInterval
  private intervalTimer: ReturnType<typeof setTimeout> | null = null
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private rawListeners: Record<string, string> = {}
  private pendingPoints: DataLakeLogPoint[] = []

  // Epoch of the last raw-mode point buffered, used to detect when a new session begins so it can be
  // seeded with a baseline snapshot of every recorded variable.
  private lastRawActivityEpoch: number | null = null

  // Identifies the current Cockpit run, so each restart starts a fresh session even without a time gap.
  private readonly bootId = Date.now()

  // Monotonic per-run counter that keeps log-point keys unique even within the same millisecond.
  private logPointSequence = 0

  // Metadata of the session currently being written, kept in memory and mirrored to sessionsDB.
  private currentSession: DataLakeSessionRecord | null = null

  /**
   * Create a logger that flushes whatever is still buffered before the window goes away, so the
   * last points aren't lost
   */
  constructor() {
    window.addEventListener('beforeunload', () => this.flushPendingPoints())
  }

  static logsDB = new IndexedDbStore({
    name: 'Cockpit - Data Lake Logs',
    storeName: 'cockpit-data-lake-logs-db',
    version: 1,
    description: 'Raw data lake variable logs for CSV and JSON export.',
  })

  static sessionsDB = new IndexedDbStore({
    name: 'Cockpit - Data Lake Sessions',
    storeName: 'cockpit-data-lake-sessions-db',
    version: 1,
    description: 'Metadata for recorded data lake sessions (point count and time range).',
  })

  static SESSION_GAP_THRESHOLD_MS = sessionGapThresholdMs

  // ID of the session the running logger is currently writing to; only this one is "current".
  private static activeSessionId: string | null = null

  /**
   * Build an IndexedDB key range covering all log-point keys of a session.
   *
   * Log-point keys are `boot=<bootId>;epoch=<epoch>;seq=<seq>`. Because bootId and epoch are
   * fixed-width (13-digit) millisecond timestamps, lexicographic key order matches numeric order, so
   * a bounded string range selects exactly the session's points (same bootId, epoch within range).
   * @param {DataLakeSessionInfo} session - Session whose key range is needed
   * @returns {IDBKeyRange} Range covering the session's log-point keys
   */
  private static sessionKeyRange(session: DataLakeSessionInfo): IDBKeyRange {
    const lowerKey = `boot=${session.bootId};epoch=${session.startTime}`
    const upperKey = `boot=${session.bootId};epoch=${session.endTime}\uffff`
    return IDBKeyRange.bound(lowerKey, upperKey)
  }

  /**
   * @param {string} variableId - Data lake variable ID
   * @returns {string} Human-readable variable name for export
   */
  static getVariableExportName(variableId: string): string {
    const name = getDataLakeVariableInfo(variableId)?.name ?? variableId

    if (variableId.includes('mavlink/') && name.includes('(')) {
      return name.substring(0, name.lastIndexOf('(')).trim()
    }

    return name
  }

  /**
   * Return the last path segment of a slash-separated variable ID
   * @param {string} variableId - Data lake variable ID
   * @returns {string} Final segment of the variable ID, or the full ID when no slashes are present
   */
  static shortVariableId(variableId: string): string {
    const lastSlashIndex = variableId.lastIndexOf('/')
    if (lastSlashIndex === -1) {
      return variableId
    }

    return variableId.substring(lastSlashIndex + 1)
  }

  /**
   * @param {string} variableId - Data lake variable ID
   * @param {DataLakeExportVariableKey} keyMode - How variable keys should be labeled in exports
   * @returns {string} Export key for the variable
   */
  static getExportVariableKey(variableId: string, keyMode: DataLakeExportVariableKey): string {
    if (keyMode === 'name') {
      return DataLakeLogger.getVariableExportName(variableId)
    }

    if (keyMode === 'short-id') {
      return DataLakeLogger.shortVariableId(variableId)
    }

    return variableId
  }

  /**
   * Build a stable variable-ID-to-export-key map for a whole log. When two variable IDs would
   * produce the same export key, both fall back to their full (always unique) IDs.
   * @param {string[]} variableIds - All variable IDs present in the log
   * @param {DataLakeExportVariableKey} keyMode - How variable keys should be labeled in exports
   * @returns {Map<string, string>} Map from variable ID to its export key
   */
  static buildExportKeyMap(variableIds: string[], keyMode: DataLakeExportVariableKey): Map<string, string> {
    const desiredKeys = new Map<string, string>()
    const desiredKeyCounts = new Map<string, number>()

    for (const variableId of variableIds) {
      const desiredKey = DataLakeLogger.getExportVariableKey(variableId, keyMode)
      desiredKeys.set(variableId, desiredKey)
      desiredKeyCounts.set(desiredKey, (desiredKeyCounts.get(desiredKey) ?? 0) + 1)
    }

    const exportKeyMap = new Map<string, string>()
    for (const [variableId, desiredKey] of desiredKeys) {
      const isColliding = (desiredKeyCounts.get(desiredKey) ?? 0) > 1
      exportKeyMap.set(variableId, isColliding ? variableId : desiredKey)
    }

    return exportKeyMap
  }

  /**
   * Re-key a log point's data for export using a precomputed export-key map
   * @param {Record<string, string | number | boolean | undefined>} data - Log data keyed by variable ID
   * @param {Map<string, string>} exportKeyMap - Map from variable ID to export key
   * @returns {Record<string, string | number | boolean | undefined>} Log data keyed for export
   */
  static applyExportKeyMap(
    data: Record<string, string | number | boolean | undefined>,
    exportKeyMap: Map<string, string>
  ): Record<string, string | number | boolean | undefined> {
    const exportedData: Record<string, string | number | boolean | undefined> = {}

    for (const [variableId, value] of Object.entries(data)) {
      exportedData[exportKeyMap.get(variableId) ?? variableId] = value
    }

    return exportedData
  }

  /**
   * @param {DataLakeLog} log - Log to inspect
   * @returns {string[]} All unique variable IDs present across the log
   */
  static collectVariableIds(log: DataLakeLog): string[] {
    const variableIds = new Set<string>()
    log.forEach((logPoint) => Object.keys(logPoint.data).forEach((variableId) => variableIds.add(variableId)))
    return [...variableIds]
  }

  /**
   * @returns {string[]} IDs of data lake variables selected for recording
   */
  get recordedVariableIds(): string[] {
    if (this._recordedVariableIds === undefined) {
      const savedValue = settingsManager.getKeyValue(recordedDataLakeVariablesKey) as string[] | undefined
      this._recordedVariableIds = savedValue ?? []
    }
    return this._recordedVariableIds
  }

  /**
   * @param {string[]} value - Variable IDs to record
   */
  set recordedVariableIds(value: string[]) {
    this._recordedVariableIds = value
    settingsManager.setKeyValue(recordedDataLakeVariablesKey, value)
    recordedVariableIdsChangedHandler()
  }

  /**
   * @returns {DataLakeExportVariableKey} How variable keys are labeled in exports
   */
  get exportVariableKey(): DataLakeExportVariableKey {
    if (this._exportVariableKey === undefined) {
      const savedValue = settingsManager.getKeyValue(exportVariableKeySetting) as DataLakeExportVariableKey | undefined
      this._exportVariableKey = savedValue ?? 'id'
    }
    return this._exportVariableKey
  }

  /**
   * @param {DataLakeExportVariableKey} value - How variable keys are labeled in exports
   */
  set exportVariableKey(value: DataLakeExportVariableKey) {
    this._exportVariableKey = value
    settingsManager.setKeyValue(exportVariableKeySetting, value)
  }

  /**
   * @returns {DataLakeLogInterval} Log interval in milliseconds, or 'raw' for change-driven logging
   */
  get logInterval(): DataLakeLogInterval {
    if (this._logInterval === undefined) {
      const savedValue = settingsManager.getKeyValue(logIntervalKey) as DataLakeLogInterval | undefined
      this._logInterval = savedValue ?? defaultLogInterval
    }
    return this._logInterval
  }

  /**
   * @param {DataLakeLogInterval} value - Log interval in milliseconds, or 'raw' for change-driven logging
   */
  set logInterval(value: DataLakeLogInterval) {
    if (value === this.logInterval) return

    this._logInterval = value
    settingsManager.setKeyValue(logIntervalKey, value)

    if (this.shouldBeLogging()) {
      // A config change closes the current session; flush leftovers into it, then the next point
      // opens a fresh session with the new config.
      this.flushPendingPoints()
      this.currentSession = null
      DataLakeLogger.activeSessionId = null
      this.applyLoggingMode()
    }
  }

  /**
   * Toggle whether a data lake variable should be recorded. IDs are only ever added or removed
   * here, in direct response to the user's selection; nothing prunes the list automatically.
   * @param {string} variableId - Data lake variable ID
   * @param {boolean} recorded - Whether the variable should be recorded
   */
  setVariableRecorded(variableId: string, recorded: boolean): void {
    const currentIds = [...this.recordedVariableIds]

    if (recorded && !currentIds.includes(variableId)) {
      this.recordedVariableIds = [...currentIds, variableId]
    } else if (!recorded) {
      this.recordedVariableIds = currentIds.filter((id) => id !== variableId)
    }

    // Interval logging reads the recorded list on every tick, but raw logging holds per-variable
    // listeners that must be rebuilt whenever the selection changes.
    if (this.shouldBeLogging() && this.logInterval === 'raw') {
      this.applyLoggingMode()
    }
  }

  /**
   * Swap recorded variable IDs in one write. Used when a stream rename moves armed stats onto the
   * new ids, so the selection is persisted and raw listeners are rebuilt once.
   * @param {Record<string, string>} replacements - Map of old variable id to new variable id
   */
  replaceRecordedVariableIds(replacements: Record<string, string>): void {
    if (Object.keys(replacements).length === 0) return

    const nextIds: string[] = []
    const seen = new Set<string>()
    let changed = false

    this.recordedVariableIds.forEach((id) => {
      const next = replacements[id] ?? id
      if (next !== id) changed = true
      if (seen.has(next)) return
      seen.add(next)
      nextIds.push(next)
    })

    if (!changed) return

    this.recordedVariableIds = nextIds

    if (this.shouldBeLogging() && this.logInterval === 'raw') {
      this.applyLoggingMode()
    }
  }

  /**
   * Disarm recorded stream-stat IDs whose stream is no longer in the correspondency, including
   * pre-switch IDs keyed by external id.
   * @param {string[]} liveInternalNames - Internal stream names currently in the correspondency
   */
  pruneStaleStreamStatIds(liveInternalNames: string[]): void {
    const nextIds = pruneStaleStreamStatRecordedIds(this.recordedVariableIds, liveInternalNames)
    if (nextIds.length === this.recordedVariableIds.length) return

    this.recordedVariableIds = nextIds

    if (this.shouldBeLogging() && this.logInterval === 'raw') {
      this.applyLoggingMode()
    }
  }

  /**
   * Start recording. Re-reads the recorded selection from settings on each fresh start, so a
   * stop/start cycle applies external changes. No-op when already running.
   */
  startLogging(): void {
    if (this.isLogging) return

    this.isLogging = true
    this._recordedVariableIds = undefined
    this.applyLoggingMode()
  }

  /**
   * Stop recording and tear down the timer/listeners.
   */
  stopLogging(): void {
    if (!this.isLogging) return

    this.isLogging = false
    this.teardownLogging()
  }

  /**
   * @returns {boolean} True if logging should continue
   */
  shouldBeLogging(): boolean {
    return this.isLogging
  }

  /**
   * Persist all buffered points as a single batched IndexedDB entry and widen the session range.
   * Point count is credited after the write lands. No-op when the buffer is empty.
   */
  private flushPendingPoints(): void {
    if (this.pendingPoints.length === 0) return

    const batch = this.pendingPoints
    this.pendingPoints = []

    const firstEpoch = batch[0].epoch
    const lastEpoch = batch[batch.length - 1].epoch
    const key = `boot=${this.bootId};epoch=${firstEpoch};seq=${this.logPointSequence++}`

    // Advance the session range synchronously so export and deletion can find the batch even on
    // beforeunload, whose promise callbacks may never run. Count only after the batch write lands.
    this.updateCurrentSessionRange(firstEpoch, lastEpoch)

    DataLakeLogger.logsDB
      .setItem(key, batch)
      .then(() => this.creditSessionPointCount(firstEpoch, batch.length))
      .catch((error) => {
        console.error('Failed to store data lake log points:', error)
      })
  }

  /**
   * Credit a batch that finished storing to the session covering it, so the session's point count
   * never overstates what is on disk
   * @param {number} epoch - Epoch of the landed batch's first point
   * @param {number} pointCount - Number of points in the landed batch
   */
  private creditSessionPointCount(epoch: number, pointCount: number): void {
    const session = this.currentSession
    if (!session) return

    const credited = sessionWithCreditedPoints(session, epoch, pointCount)
    if (credited === null) return

    this.currentSession = credited
    DataLakeLogger.sessionsDB.setItem(credited.id, { ...credited }).catch((error) => {
      console.error('Failed to update data lake session record:', error)
    })
  }

  /**
   * Advance the current session's time range for a freshly flushed batch, starting a new session
   * when the gap since the last point exceeds the threshold (a restart already starts with no session).
   * @param {number} firstEpoch - Epoch of the first point in the batch
   * @param {number} lastEpoch - Epoch of the last point in the batch
   */
  private updateCurrentSessionRange(firstEpoch: number, lastEpoch: number): void {
    this.currentSession = sessionRangeCoveringBatch(this.currentSession, this.bootId, firstEpoch, lastEpoch)
    DataLakeLogger.activeSessionId = this.currentSession.id
    DataLakeLogger.sessionsDB.setItem(this.currentSession.id, { ...this.currentSession }).catch((error) => {
      console.error('Failed to update data lake session record:', error)
    })
  }

  /**
   * Snapshot the current value of every recorded variable, keyed by variable ID.
   * @returns {Record<string, string | number | boolean | undefined>} Cloned current values
   */
  private snapshotRecordedValues(): Record<string, string | number | boolean | undefined> {
    const data: Record<string, string | number | boolean | undefined> = {}
    for (const variableId of this.recordedVariableIds) {
      data[variableId] = getDataLakeVariableData(variableId)
    }

    return structuredClone(data)
  }

  /**
   * Buffer a point snapshotting the current value of every recorded variable (interval mode)
   */
  private bufferSnapshotPoint(): void {
    if (this.recordedVariableIds.length === 0) return

    this.pendingPoints.push({ epoch: Date.now(), data: this.snapshotRecordedValues() })
  }

  /**
   * Tear down any active logging and restart it in the currently configured mode
   */
  private applyLoggingMode(): void {
    this.teardownLogging()
    if (!this.shouldBeLogging()) return

    // Buffered points are flushed to IndexedDB in batches to keep write pressure low.
    this.flushTimer = setInterval(() => this.flushPendingPoints(), flushIntervalMs)

    // Raw mode buffers only the variable that changed, so each change becomes its own single-value point.
    if (this.logInterval === 'raw') {
      this.lastRawActivityEpoch = null
      for (const variableId of this.recordedVariableIds) {
        this.rawListeners[variableId] = listenDataLakeVariable(variableId, (value) => {
          const epoch = Date.now()
          // Variables only emit on change, so one that hasn't changed since before a session would be
          // missing from it. Seed each new session's first point with a full baseline snapshot so every
          // recorded variable is present; later points stay sparse single-value changes.
          const startsNewSession =
            this.lastRawActivityEpoch === null ||
            epoch - this.lastRawActivityEpoch > DataLakeLogger.SESSION_GAP_THRESHOLD_MS
          this.pendingPoints.push(
            startsNewSession ? { epoch, data: this.snapshotRecordedValues() } : { epoch, data: { [variableId]: value } }
          )
          this.lastRawActivityEpoch = epoch
        })
      }
      return
    }

    const interval = this.logInterval
    const logRoutine = (): void => {
      this.bufferSnapshotPoint()
      if (this.shouldBeLogging() && this.logInterval !== 'raw') {
        this.intervalTimer = setTimeout(logRoutine, interval)
      }
    }
    logRoutine()
  }

  /**
   * Stop the timers, remove all raw-mode listeners, and flush any buffered points.
   */
  private teardownLogging(): void {
    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer)
      this.intervalTimer = null
    }

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    for (const [variableId, listenerId] of Object.entries(this.rawListeners)) {
      unlistenDataLakeVariable(variableId, listenerId)
    }
    this.rawListeners = {}

    this.flushPendingPoints()
  }

  /**
   * Get all recorded data sessions
   * @returns {Promise<DataLakeSessionInfo[]>} Detected sessions, newest first
   */
  static async getDataSessions(): Promise<DataLakeSessionInfo[]> {
    const records: DataLakeSessionRecord[] = []
    await DataLakeLogger.sessionsDB.iterate<DataLakeSessionRecord, void>((record) => {
      if (record?.id !== undefined) records.push(record)
    })

    return records
      .map((record) => ({
        id: record.id,
        bootId: record.bootId,
        startTime: record.startTime,
        endTime: record.endTime,
        dateTimeFormatted: format(new Date(record.startTime), 'LLL dd, yyyy - HH:mm:ss'),
        dataPointCount: record.dataPointCount,
        durationSeconds: Math.round((record.endTime - record.startTime) / 1000),
        isCurrentSession: record.id === DataLakeLogger.activeSessionId,
      }))
      .sort((a, b) => b.startTime - a.startTime)
  }

  /**
   * Build a log from a session's stored data points
   * @param {DataLakeSessionInfo} session - Session to export
   * @returns {Promise<DataLakeLog>} Log points in chronological order
   */
  static async generateLogFromSession(session: DataLakeSessionInfo): Promise<DataLakeLog> {
    // Native key-range query fetches only this session's batches, in ascending (chronological) key order.
    const batches = await DataLakeLogger.logsDB.getAll<DataLakeLog>(DataLakeLogger.sessionKeyRange(session))

    const log: DataLakeLog = []
    for (const batch of batches) {
      if (Array.isArray(batch)) {
        log.push(...batch.filter((point) => point?.epoch !== undefined && point.data !== undefined))
      }
    }

    return log
  }

  /**
   * Build the export file name for a session
   * @param {DataLakeSessionInfo} session - Session being exported
   * @param {string} extension - File extension without the leading dot
   * @returns {string} File name for the session's export
   */
  static sessionExportFileName(session: DataLakeSessionInfo, extension: string): string {
    const dateStr = format(new Date(session.startTime), 'yyyy-MM-dd_HH-mm-ss')
    return `Cockpit_Data_Log_${dateStr}.${extension}`
  }

  /**
   * Build a ZIP archive holding one export file per session, skipping sessions with no data points.
   * @param {DataLakeSessionInfo[]} sessions - Sessions to include
   * @param {'json' | 'csv'} formatType - Export format used for each session file
   * @returns {Promise<SessionsZipResult>} ZIP blob and the number of non-empty sessions written
   */
  async generateSessionsZip(sessions: DataLakeSessionInfo[], formatType: 'json' | 'csv'): Promise<SessionsZipResult> {
    const entries: ZipFileEntry[] = []

    for (const session of sessions) {
      const log = await DataLakeLogger.generateLogFromSession(session)
      if (log.length === 0) continue

      const content = formatType === 'json' ? this.toJson(log) : this.toCsv(log)
      entries.push({ name: DataLakeLogger.sessionExportFileName(session, formatType), blob: new Blob([content]) })
    }

    const blob = await createZipBlob(entries)
    return { blob, includedCount: entries.length }
  }

  /**
   * Remove the log points and metadata records of the given sessions, deleting each session's points
   * with a single native key-range delete.
   * @param {DataLakeSessionInfo[]} sessions - Sessions to delete
   */
  private static async removeSessions(sessions: DataLakeSessionInfo[]): Promise<void> {
    if (sessions.length === 0) return

    await Promise.all([
      ...sessions.map((session) => DataLakeLogger.logsDB.removeRange(DataLakeLogger.sessionKeyRange(session))),
      ...sessions.map((session) => DataLakeLogger.sessionsDB.removeItem(session.id)),
    ])
  }

  /**
   * Delete all log points belonging to a session
   * @param {DataLakeSessionInfo} session - Session to delete
   */
  static async deleteDataSession(session: DataLakeSessionInfo): Promise<void> {
    await DataLakeLogger.removeSessions([session])
  }

  /**
   * Delete all log points belonging to the given sessions
   * @param {DataLakeSessionInfo[]} sessions - Sessions to delete
   */
  static async deleteDataSessions(sessions: DataLakeSessionInfo[]): Promise<void> {
    await DataLakeLogger.removeSessions(sessions)
  }

  /**
   * Delete sessions older than the given number of days
   * @param {number} daysOld - Age threshold in days
   * @returns {Promise<number>} Number of deleted sessions
   */
  static async deleteOldDataSessions(daysOld = 1): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    const cutoffMs = cutoffDate.getTime()

    const sessions = await DataLakeLogger.getDataSessions()
    const sessionsToDelete = sessions.filter((session) => session.endTime < cutoffMs && !session.isCurrentSession)

    await DataLakeLogger.removeSessions(sessionsToDelete)

    return sessionsToDelete.length
  }

  /**
   * Convert a data lake log to JSON
   * @param {DataLakeLog} log - Log to serialize
   * @returns {string} JSON string
   */
  toJson(log: DataLakeLog): string {
    const exportKeyMap = DataLakeLogger.buildExportKeyMap(
      DataLakeLogger.collectVariableIds(log),
      this.exportVariableKey
    )
    const exportedLog = log.map((logPoint) => ({
      ...logPoint,
      data: DataLakeLogger.applyExportKeyMap(logPoint.data, exportKeyMap),
    }))

    return JSON.stringify(exportedLog, null, 2)
  }

  /**
   * Convert a data lake log to CSV. Each stored point becomes a row; columns for variables that did
   * not change in that point carry forward their most recent value (so raw logs have many repeats).
   * @param {DataLakeLog} log - Log to serialize
   * @returns {string} CSV string
   */
  toCsv(log: DataLakeLog): string {
    if (log.length === 0) return ''

    const exportKeyMap = DataLakeLogger.buildExportKeyMap(
      DataLakeLogger.collectVariableIds(log),
      this.exportVariableKey
    )
    const exportedLog = log.map((logPoint) => ({
      ...logPoint,
      data: DataLakeLogger.applyExportKeyMap(logPoint.data, exportKeyMap),
    }))

    const escapeCSV = (value: string | number | boolean | undefined | null): string => {
      if (value === undefined || value === null) return ''
      const str = String(value).trim()
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const sortedExportKeys = [...new Set(exportKeyMap.values())].sort()
    const headers = ['epoch', 'timestamp', ...sortedExportKeys.map((key) => escapeCSV(key))]

    const latestValues = new Map<string, string | number | boolean | undefined>()
    const rows = exportedLog.map((logPoint) => {
      for (const [exportKey, value] of Object.entries(logPoint.data)) {
        latestValues.set(exportKey, value)
      }

      const timestamp = new Date(logPoint.epoch).toISOString()
      const values = sortedExportKeys.map((exportKey) => escapeCSV(latestValues.get(exportKey)))
      return [logPoint.epoch, escapeCSV(timestamp), ...values].join(',')
    })

    return [headers.join(','), ...rows].join('\n')
  }
}

export const dataLakeLogger = new DataLakeLogger()
