/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from 'date-fns'
import localforage from 'localforage'

import { systemLoggingEnablingKey } from '@/stores/development'

export const cockpitSytemLogsDB = localforage.createInstance({
  driver: localforage.INDEXEDDB,
  name: 'Cockpit - System Logs',
  storeName: 'cockpit-system-logs-db',
  version: 1.0,
  description: 'Local backups of Cockpit system logs, to be retrieved in case of failure.',
})

const initialTime = new Date()
const fileName = `Cockpit (${format(initialTime, 'LLL dd, yyyy - HH꞉mm꞉ss O')}).syslog`

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
  initialDate: format(initialDatetime, 'LLL dd, yyyy'),
  initialTime: format(initialDatetime, 'HH꞉mm꞉ss O'),
  events: [],
}
/* eslint-enable jsdoc/require-jsdoc */

const saveLogEventInDB = (event: LogEvent): void => {
  currentSystemLog.events.push(event)
  cockpitSytemLogsDB.setItem(fileName, currentSystemLog)
}

const enableSystemLogging = localStorage.getItem(systemLoggingEnablingKey)
if (enableSystemLogging === 'true') {
  const oldConsoleError = window.console.error
  window.console.error = (o) => {
    oldConsoleError(o)
    saveLogEventInDB({ epoch: new Date().getTime(), level: 'error', msg: o })
  }

  const oldConsoleWarn = window.console.warn
  window.console.warn = (o) => {
    oldConsoleWarn(o)
    saveLogEventInDB({ epoch: new Date().getTime(), level: 'warn', msg: o })
  }

  const oldConsoleInfo = window.console.info
  window.console.info = (o) => {
    oldConsoleInfo(o)
    saveLogEventInDB({ epoch: new Date().getTime(), level: 'info', msg: o })
  }

  const oldConsoleDebug = window.console.debug
  window.console.debug = (o) => {
    oldConsoleDebug(o)
    saveLogEventInDB({ epoch: new Date().getTime(), level: 'debug', msg: o })
  }

  const oldConsoleTrace = window.console.trace
  window.console.trace = (o) => {
    oldConsoleTrace(o)
    saveLogEventInDB({ epoch: new Date().getTime(), level: 'trace', msg: o })
  }

  const oldConsoleLog = window.console.log
  window.console.log = (o) => {
    oldConsoleLog(o)
    saveLogEventInDB({ epoch: new Date().getTime(), level: 'Log', msg: o })
  }
}
