import { ipcMain } from 'electron'
import * as os from 'os'

import type { BasicSystemInfo } from '@/types/platform'

/**
 * Get system info synchronously (for use in main process)
 * @returns {BasicSystemInfo} Basic system information
 */
export const getSystemInfo = (): BasicSystemInfo => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    processArch: process.arch,
  }
}

/**
 * Setup system info service
 * Exposes IPC handler for getting system information including platform and architecture
 */
export const setupSystemInfoService = (): void => {
  ipcMain.handle('get-system-info', (): BasicSystemInfo => {
    return getSystemInfo()
  })
}
