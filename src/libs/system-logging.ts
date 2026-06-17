/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from 'date-fns'
import localforage from 'localforage'

import { settingsManager } from '@/libs/settings-management'
import { systemLoggingEnablingKey } from '@/stores/development'

import { isElectron, sanitizeFilenameComponent } from './utils'

export const systemLogDateFormat = 'LLL dd, yyyy'
export const systemLogTimeFormat = 'HH꞉mm꞉ss O'
export const systemLogDateTimeFormat = `${systemLogDateFormat} - ${systemLogTimeFormat}`

export const cockpitSytemLogsDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - System Logs',
  storeName: 'cockpit-system-logs-db',
  version: 1.0,
  description: 'Local backups of Cockpit system logs, to be retrieved in case of failure.',
})

const initialTime = new Date()
// Sanitized to match the Electron syslog filename: the `O` timezone token emits a real colon for non-integer UTC offsets.
const fileName = `Cockpit (${sanitizeFilenameComponent(format(initialTime, systemLogDateTimeFormat))}).syslog`

/* eslint-disable jsdoc/require-jsdoc */

// Export the current session's log file name so it can be used to identify the current session
export const getCurrentSessionLogFileName = (): string => fileName

// Export function to get current session log file name and size
// For web version, returns event count instead of estimated size
export const getCurrentSessionLogInfo = async (): Promise<{ fileName: string; size: number }> => {
  const eventCount = currentSystemLog.events.length
  return { fileName, size: eventCount }
}

type LogEvent = {
  epoch: number
  level: string
  msg: string
}

type LogBatchEvent = {
  level: string
  message: string
}

const initialDatetime = new Date()
export interface SystemLog {
  initialDate: string
  initialTime: string
  events: LogEvent[]
}

const currentSystemLog: SystemLog = {
  initialDate: format(initialDatetime, systemLogDateFormat),
  initialTime: format(initialDatetime, systemLogTimeFormat),
  events: [],
}
/* eslint-enable jsdoc/require-jsdoc */

/**
 * A single captured console event, as exposed to the in-app console viewer.
 */
export interface SystemLogViewerEvent {
  /** Monotonic id, used as a stable key for virtualized rendering */
  id: number
  /** Time the event was captured (epoch ms) */
  epoch: number
  /** Console level (error, warn, info, debug, trace, log) */
  level: string
  /** The already-serialized message */
  msg: string
}

// Bounded in-memory ring buffer of recent console events, used to feed the in-app console viewer live without
// re-reading the persisted log. Capped so memory stays bounded regardless of how much is logged.
const maxRecentLogEvents = 2000
const recentLogEvents: SystemLogViewerEvent[] = []
let logEventIdCounter = 0
type SystemLogEventListener = (event: SystemLogViewerEvent) => void
const systemLogEventListeners = new Set<SystemLogEventListener>()

const recordLogEventForViewer = (level: string, msg: string): void => {
  logEventIdCounter += 1
  const event: SystemLogViewerEvent = { id: logEventIdCounter, epoch: Date.now(), level, msg }
  recentLogEvents.push(event)
  if (recentLogEvents.length > maxRecentLogEvents) recentLogEvents.shift()
  systemLogEventListeners.forEach((listener) => {
    try {
      listener(event)
    } catch {
      // Never let a viewer listener throw back into the logging path (could cause an infinite loop)
    }
  })
}

/**
 * Get a snapshot of the most recent in-memory console events.
 * @returns {SystemLogViewerEvent[]} A copy of the current ring buffer
 */
export const getRecentSystemLogEvents = (): SystemLogViewerEvent[] => recentLogEvents.slice()

/**
 * Subscribe to live console events as they are captured.
 * @param {SystemLogEventListener} listener - Called for each new event
 * @returns {() => void} Unsubscribe function
 */
export const subscribeToSystemLogEvents = (listener: SystemLogEventListener): (() => void) => {
  systemLogEventListeners.add(listener)
  return () => {
    systemLogEventListeners.delete(listener)
  }
}

// Oversized-message capping. A burst of huge console messages (e.g. [Vue warn] dumps that serialize the
// whole Vuetify theme inside the component trace) can grow the persisted log to gigabytes and choke the
// in-app log viewer with entries nobody reads. Observed legit messages stay under 1KB while these dumps
// reach ~80KB+. Budgets are measured in characters (message.length, i.e. UTF-16 code units) rather than
// bytes, which is a close-enough approximation for the ASCII-dominated console output. Messages up to
// `largeLogThresholdChars` always pass untouched; past it, each successive oversized message within
// `oversizedLogWindowMs` gets a smaller budget, and once the budget is spent every further oversized
// message is clamped to `oversizedLogFloorChars` until the window resets.
const largeLogThresholdChars = 1 * 1024
const oversizedLogWindowMs = 10_000
const oversizedLogBudgetsChars = [16, 8, 4, 2, 1].map((kb) => kb * 1024)
const oversizedLogFloorChars = 1 * 1024

let oversizedLogWindowStart = 0
let oversizedLogCountInWindow = 0

const capLogMessage = (message: string): string => {
  if (message.length <= largeLogThresholdChars) return message

  const now = Date.now()
  if (now - oversizedLogWindowStart >= oversizedLogWindowMs) {
    oversizedLogWindowStart = now
    oversizedLogCountInWindow = 0
  }

  const allowance = oversizedLogBudgetsChars[oversizedLogCountInWindow] ?? oversizedLogFloorChars
  oversizedLogCountInWindow += 1

  if (message.length <= allowance) return message

  const droppedChars = message.length - allowance
  return `${message.slice(0, allowance)}… [log capped: dropped ${droppedChars} chars to limit oversized-message bursts]`
}

// Buffer log events and flush them in batches, to avoid one IPC message (Electron) or one IndexedDB write
// (web) per console call. During logging bursts the per-call overhead is the dominant cost on the renderer.
const logFlushIntervalMs = 250
const maxBufferedEventsBeforeFlush = 100

let bufferedElectronEvents: LogBatchEvent[] = []
let electronFlushTimeout: ReturnType<typeof setTimeout> | undefined
let dbFlushTimeout: ReturnType<typeof setTimeout> | undefined

const flushElectronLogs = (): void => {
  if (electronFlushTimeout) {
    clearTimeout(electronFlushTimeout)
    electronFlushTimeout = undefined
  }
  if (bufferedElectronEvents.length === 0) return
  const batch = bufferedElectronEvents
  bufferedElectronEvents = []
  try {
    window.electronAPI?.systemLogBatch?.(batch)
  } catch (error) {
    // We do not want to log this error, as it would create an infinite loop
  }
}

const flushDBLogs = (): void => {
  if (dbFlushTimeout) {
    clearTimeout(dbFlushTimeout)
    dbFlushTimeout = undefined
  }
  try {
    cockpitSytemLogsDB.setItem(fileName, currentSystemLog)
  } catch (error) {
    // We do not want to log this error, as it would create an infinite loop
  }
}

const saveLogEventInDB = (event: LogEvent): void => {
  try {
    currentSystemLog.events.push(event)
    if (currentSystemLog.events.length % maxBufferedEventsBeforeFlush === 0) {
      flushDBLogs()
    } else if (!dbFlushTimeout) {
      dbFlushTimeout = setTimeout(flushDBLogs, logFlushIntervalMs)
    }
  } catch (error) {
    // We do not want to log this error, as it would create an infinite loop
  }
}

const sendLogToElectron = (level: string, message: string): void => {
  bufferedElectronEvents.push({ level, message })
  if (bufferedElectronEvents.length >= maxBufferedEventsBeforeFlush) {
    flushElectronLogs()
  } else if (!electronFlushTimeout) {
    electronFlushTimeout = setTimeout(flushElectronLogs, logFlushIntervalMs)
  }
}

const enableSystemLogging = settingsManager.getKeyValue(systemLoggingEnablingKey)

if (enableSystemLogging) {
  const isRunningInElectron = isElectron()

  console.log(`
    System logging is enabled.
    This means that all console logs will be saved ${isRunningInElectron ? 'to electron-log' : 'to the database'}, and
    won't be displayed in the console.
    To disable system logging go to "Settings" -> "Dev".
  `)

  const persistLogEvent = (level: string, message: string): void => {
    // Cap oversized messages once, before the fan-out, so the file, the IndexedDB store and the in-app
    // viewer are all protected from gigabyte-scale logs and unreadably long entries.
    const cappedMessage = capLogMessage(message)
    // Feed the in-app console viewer (bounded in-memory buffer), independent of where logs are persisted.
    recordLogEventForViewer(level, cappedMessage)
    if (isRunningInElectron) {
      sendLogToElectron(level, cappedMessage)
    } else {
      saveLogEventInDB({ epoch: Date.now(), level, msg: cappedMessage })
    }
  }

  // Repeated-log suppressor: collapses identical consecutive messages (same level + text) into a single entry
  // plus a "repeated N times" summary, so a tight loop logging the same thing doesn't flood the log. It is
  // intentionally O(1): only the previous message is remembered (one string comparison per call), with no map,
  // hashing, or history, so it never becomes a bottleneck during bursts — and it skips the persist work
  // entirely for suppressed duplicates.
  const repeatSummaryDelayMs = 1000
  let lastLevel: string | undefined
  let lastMessage: string | undefined
  let suppressedRepeatCount = 0
  let repeatSummaryTimeout: ReturnType<typeof setTimeout> | undefined

  const flushRepeatSummary = (): void => {
    if (repeatSummaryTimeout) {
      clearTimeout(repeatSummaryTimeout)
      repeatSummaryTimeout = undefined
    }
    if (suppressedRepeatCount > 0 && lastLevel !== undefined) {
      const times = suppressedRepeatCount === 1 ? 'time' : 'times'
      persistLogEvent(lastLevel, `↑ previous message repeated ${suppressedRepeatCount} more ${times}`)
    }
    suppressedRepeatCount = 0
    // Reset so a message that recurs after the summary is shown fresh instead of being suppressed forever.
    lastLevel = undefined
    lastMessage = undefined
  }

  const captureLogEvent = (level: string, message: string): void => {
    if (level === lastLevel && message === lastMessage) {
      suppressedRepeatCount += 1
      if (!repeatSummaryTimeout) repeatSummaryTimeout = setTimeout(flushRepeatSummary, repeatSummaryDelayMs)
      return
    }
    // Different message: report any pending repeats of the previous one first, then emit this one.
    flushRepeatSummary()
    lastLevel = level
    lastMessage = message
    persistLogEvent(level, message)
  }

  const oldConsoleFunction = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    trace: console.trace,
    log: console.log,
  }
  Object.entries(oldConsoleFunction).forEach(([level]) => {
    // @ts-ignore
    window.console[level] = (...o: any[]) => {
      let wholeMessage = ''
      o.forEach((m) => {
        let msg = m
        try {
          if (typeof m === 'object' && m !== null) {
            msg = JSON.stringify(m)
          } else {
            msg = m.toString()
          }
        } catch {
          msg = ''
        }
        if (msg !== '') {
          wholeMessage += ' '
          wholeMessage += msg
        }
      })

      captureLogEvent(level, wholeMessage)
    }
  })

  // Flush whatever is still buffered before the window goes away, so the last events aren't lost.
  window.addEventListener('beforeunload', () => {
    flushRepeatSummary()
    if (isRunningInElectron) {
      flushElectronLogs()
    } else {
      flushDBLogs()
    }
  })
}
