/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from 'date-fns'
import localforage from 'localforage'

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
type LogEvent = {
  epoch: number
  level: string
  msg: string
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

const saveLogEventInDB = (event: LogEvent): void => {
  try {
    currentSystemLog.events.push(event)
    cockpitSytemLogsDB.setItem(fileName, currentSystemLog)
  } catch (error) {
    // We do not want to log this error, as it would create an infinite loop
  }
}

const sendLogToElectron = (level: string, message: string): void => {
  try {
    if (window.electronAPI?.systemLog) {
      window.electronAPI.systemLog(level, message)
    }
  } catch (error) {
    // We do not want to log this error, as it would create an infinite loop
  }
}

const enableSystemLogging = localStorage.getItem(systemLoggingEnablingKey)
if (enableSystemLogging === 'true') {
  const isRunningInElectron = isElectron()

  console.log(`
    System logging is enabled.
    This means that all console logs will be saved ${isRunningInElectron ? 'to electron-log' : 'to the database'}, and
    won't be displayed in the console.
    To disable system logging go to "Settings" -> "Dev".
  `)

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

      if (isRunningInElectron) {
        sendLogToElectron(level, wholeMessage)
      } else {
        saveLogEventInDB({ epoch: new Date().getTime(), level: level, msg: wholeMessage })
      }
    }
  })
}
