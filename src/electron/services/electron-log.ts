import { format } from 'date-fns'
import { ipcMain } from 'electron'
import logger from 'electron-log'

/**
 * Setup electron-log service for system logging
 */
export const setupElectronLogService = (): void => {
  // Configure file transport to create a new log file for each session
  logger.transports.file.fileName = `Cockpit (${format(new Date(), systemLogDateTimeFormat)}).syslog`
  logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  logger.transports.file.maxSize = 10 * 1024 * 1024 // 10MB max file size
  logger.transports.file.archiveLog = (file) => file + '.old' // Archive old logs

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
