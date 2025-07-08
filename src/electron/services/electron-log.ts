import { app, ipcMain } from 'electron'
import * as fs from 'fs/promises'
import { join } from 'path'

import { type ElectronLog } from '@/types/electron-general'

/**
 * Get the electron log file path based on the platform
 * @returns {string} The path to the electron log file
 */
const getElectronLogPath = (): string => {
  const appName = app.getName()

  switch (process.platform) {
    case 'win32':
      return join(app.getPath('appData'), appName, 'logs', 'main.log')
    case 'darwin':
      return join(app.getPath('logs'), 'main.log')
    case 'linux':
      return join(app.getPath('logs'), 'main.log')
    default:
      return join(app.getPath('logs'), 'main.log')
  }
}

/**
 * Setup electron log service
 * Exposes IPC handler for getting electron log content
 */
export const setupElectronLogService = (): void => {
  ipcMain.handle('get-electron-log', async (): Promise<ElectronLog> => {
    try {
      const logPath = getElectronLogPath()
      const logContent = await fs.readFile(logPath, 'utf-8')
      return { content: logContent, path: logPath }
    } catch (error) {
      throw new Error(`Failed to read electron log. ${error}`)
    }
  })
}
