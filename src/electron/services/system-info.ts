import { app, ipcMain, screen } from 'electron'
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
    // os.arch() is the architecture this build was made for, so under Rosetta it reports x64 on an Apple Silicon Mac.
    arch: app.runningUnderARM64Translation ? 'arm64' : os.arch(),
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
