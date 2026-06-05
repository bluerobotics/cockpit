/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from 'date-fns'
import localforage from 'localforage'

import { settingsManager } from '@/libs/settings-management'
import { systemLoggingEnablingKey } from '@/stores/development'

import { isElectron } from './utils'

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
const fileName = `Cockpit (${format(initialTime, systemLogDateTimeFormat)}).syslog`

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
    if (isRunningInElectron) {
      sendLogToElectron(level, message)
    } else {
      saveLogEventInDB({ epoch: Date.now(), level, msg: message })
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
