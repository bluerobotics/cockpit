import { format } from 'date-fns'

import {
  getDataLakeVariableData,
  getDataLakeVariableInfo,
  listenDataLakeVariable,
  unlistenDataLakeVariable,
} from './actions/data-lake'
import { IndexedDbStore } from './indexed-db-store'
import { settingsManager } from './settings-management'

export const recordedDataLakeVariablesKey = 'cockpit-data-lake-recorded-variables'
const exportVariableKeySetting = 'cockpit-data-lake-export-variable-key'
const logIntervalKey = 'cockpit-data-lake-log-interval'
const defaultLogInterval = 1000

// How often buffered points are flushed to IndexedDB as a single batched entry. Batching keeps
// high-frequency raw-mode logging from overwhelming IndexedDB; at most this much data is buffered
// in memory and would be lost on a hard crash/reload.
const flushIntervalMs = 250
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
interface DataLakeSessionRecord {
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

  static SESSION_GAP_THRESHOLD_MS = 5 * 60 * 1000

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
   * Persist all buffered points as a single batched IndexedDB entry and update the session metadata
   * once. No-op when the buffer is empty.
   */
  private flushPendingPoints(): void {
    if (this.pendingPoints.length === 0) return

    const batch = this.pendingPoints
    this.pendingPoints = []

    const firstEpoch = batch[0].epoch
    const lastEpoch = batch[batch.length - 1].epoch
    const key = `boot=${this.bootId};epoch=${firstEpoch};seq=${this.logPointSequence++}`

    DataLakeLogger.logsDB.setItem(key, batch).catch((error) => {
      console.error('Failed to store data lake log points:', error)
    })

    this.updateCurrentSession(firstEpoch, lastEpoch, batch.length)
  }

  /**
   * Advance the current session's metadata for a freshly flushed batch, starting a new session when
   * the gap since the last point exceeds the threshold (a restart already starts with no session).
   * @param {number} firstEpoch - Epoch of the first point in the batch
   * @param {number} lastEpoch - Epoch of the last point in the batch
   * @param {number} pointCount - Number of points in the batch
   */
  private updateCurrentSession(firstEpoch: number, lastEpoch: number, pointCount: number): void {
    if (!this.currentSession || firstEpoch - this.currentSession.endTime > DataLakeLogger.SESSION_GAP_THRESHOLD_MS) {
      this.currentSession = {
        id: `session-${firstEpoch}`,
        bootId: this.bootId,
        startTime: firstEpoch,
        endTime: lastEpoch,
        dataPointCount: pointCount,
      }
    } else {
      this.currentSession.endTime = lastEpoch
      this.currentSession.dataPointCount += pointCount
    }

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
