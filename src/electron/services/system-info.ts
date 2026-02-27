import { ipcMain, screen } from 'electron'
import * as os from 'os'

import type { BasicSystemInfo } from '@/types/platform'

/**
 * Get system info synchronously (for use in main process)
 * @returns {BasicSystemInfo} Basic system information
 */
export const getSystemInfo = (): BasicSystemInfo => {
  const displays = screen.getAllDisplays().map((display) => ({
    width: display.size.width,
    height: display.size.height,
    scaleFactor: display.scaleFactor,
  }))

  return {
    platform: os.platform(),
    arch: os.arch(),
    processArch: process.arch,
    displays,
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
