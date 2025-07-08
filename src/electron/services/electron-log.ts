import { ipcMain } from 'electron'
import logger from 'electron-log'

/**
 * Setup electron-log service for system logging
 */
export const setupElectronLogService = (): void => {
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
