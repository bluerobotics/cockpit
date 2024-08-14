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
  try {
    currentSystemLog.events.push(event)
    cockpitSytemLogsDB.setItem(fileName, currentSystemLog)
  } catch (error) {
    // We do not want to log this error, as it would create an infinite loop
  }
}

const enableSystemLogging = localStorage.getItem(systemLoggingEnablingKey)
if (enableSystemLogging === 'true') {
  const oldConsoleFunction = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    trace: console.trace,
    log: console.log,
  }
  Object.entries(oldConsoleFunction).forEach(([level, fn]) => {
    // @ts-ignore
    window.console[level] = (...o: any[]) => {
      fn(...o)
      let wholeMessage = ''
      o.forEach((m) => {
        let msg = m
        try {
          msg = m.toString()
        } catch {
          msg = ''
        }
        if (msg !== '') {
          wholeMessage += ' '
          wholeMessage += msg
        }
      })
      saveLogEventInDB({ epoch: new Date().getTime(), level: level, msg: wholeMessage })
    }
  })
}
