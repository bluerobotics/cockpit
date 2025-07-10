import { format } from 'date-fns'
import { app, ipcMain } from 'electron'
import logger from 'electron-log'
import { readdir, readFile, stat, unlink } from 'fs/promises'
import { join } from 'path'

import { type ElectronLog } from '@/types/electron-general'

// Import the same date format used in system-logging.ts
const systemLogDateFormat = 'LLL dd, yyyy'
const systemLogTimeFormat = 'HH꞉mm꞉ss O'
const systemLogDateTimeFormat = `${systemLogDateFormat} - ${systemLogTimeFormat}`

/**
 * Get the electron log file path based on the platform
 * @returns {string} The path to the electron log file
 */
const getElectronLogsPath = (): string => {
  const appName = app.getName()

  switch (process.platform) {
    case 'win32':
      return join(app.getPath('appData'), appName, 'logs')
    case 'darwin':
      return join(app.getPath('logs'))
    case 'linux':
      return join(app.getPath('logs'))
    default:
      return join(app.getPath('logs'))
  }
}

/**
 * Setup electron-log service for system logging
 */
export const setupElectronLogService = (): void => {
  // Configure file transport to create a new log file for each session
  logger.transports.file.fileName = `Cockpit (${format(new Date(), systemLogDateTimeFormat)}).syslog`
  logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  logger.transports.file.maxSize = 10 * 1024 * 1024 // 10MB max file size
  logger.transports.file.archiveLog = (file) => file + '.old' // Archive old logs

  // Get all electron logs
  ipcMain.handle('get-electron-logs', async (): Promise<ElectronLog[]> => {
    try {
      const logFiles = await readdir(getElectronLogsPath())
      const syslogFiles = logFiles.filter((file) => file.endsWith('.syslog') || file.endsWith('.syslog.old'))

      return await Promise.all(
        syslogFiles.map(async (logFile) => {
          const logContent = await readFile(join(getElectronLogsPath(), logFile), 'utf-8')

          // Extract date and time from filename
          const match = logFile.match(/Cockpit \((.+?)\)\.syslog/)
          let initialDate = format(new Date(), systemLogDateFormat)
          let initialTime = format(new Date(), systemLogTimeFormat)
          if (match) {
            const dateTimeString = match[1]
            const parts = dateTimeString.split(' - ')
            if (parts.length >= 2) {
              initialDate = parts[0]
              initialTime = parts[1]
            }
          }

          return {
            content: logContent,
            path: logFile,
            initialTime,
            initialDate,
          }
        })
      )
    } catch (error) {
      throw new Error(`Failed to read electron logs. ${error}`)
    }
  })

  // Get specific electron log content
  ipcMain.handle('get-electron-log-content', async (_event, logName: string): Promise<string> => {
    try {
      const logPath = join(getElectronLogsPath(), logName)
      return await readFile(logPath, 'utf-8')
    } catch (error) {
      throw new Error(`Failed to read electron log ${logName}. ${error}`)
    }
  })

  // Delete specific electron log
  ipcMain.handle('delete-electron-log', async (_event, logName: string): Promise<boolean> => {
    try {
      const logPath = join(getElectronLogsPath(), logName)
      await unlink(logPath)
      return true
    } catch (error) {
      throw new Error(`Failed to delete electron log ${logName}. ${error}`)
    }
  })

  // Delete old electron logs
  ipcMain.handle('delete-old-electron-logs', async (): Promise<string[]> => {
    try {
      const logFiles = await readdir(getElectronLogsPath())
      const syslogFiles = logFiles.filter((file) => file.endsWith('.syslog') || file.endsWith('.syslog.old'))

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const deletedFiles: string[] = []

      for (const file of syslogFiles) {
        const filePath = join(getElectronLogsPath(), file)
        const stats = await stat(filePath)

        if (stats.mtime < yesterday) {
          await unlink(filePath)
          deletedFiles.push(file)
        }
      }

      return deletedFiles
    } catch (error) {
      throw new Error(`Failed to delete old electron logs. ${error}`)
    }
  })

  // Set up system logging IPC handler
  ipcMain.on('system-log', (_event, { level, message }) => {
    switch (level) {
      case 'error':
        logger.error(message)
        break
      case 'warn':
        logger.warn(message)
        break
      case 'info':
        logger.info(message)
        break
      case 'debug':
        logger.debug(message)
        break
      case 'trace':
        logger.verbose(message) // electron-log uses verbose instead of trace
        break
      case 'log':
      default:
        logger.log(message)
        break
    }
  })
}
