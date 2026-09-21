import { BrowserWindow, ipcMain } from 'electron'
import electronUpdater, { type AppUpdater } from 'electron-updater'

import { PlatformUtils } from '../../types/platform'
import { getSystemInfo } from './system-info'

/**
 * Setup auto updater
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
export const setupAutoUpdater = (mainWindow: BrowserWindow): void => {
  const systemInfo = getSystemInfo()

  // Skip auto-updates for ARM64 Macs to prevent downloading wrong architecture
  if (PlatformUtils.isArm64Mac(systemInfo.platform, systemInfo.arch)) {
    console.log('Skipping auto-updater setup on ARM64 Mac to prevent architecture mismatch issues')
    ipcMain.handle('check-for-updates', () => false)
    return
  }

  const autoUpdater: AppUpdater = electronUpdater.autoUpdater
  autoUpdater.logger = console
  autoUpdater.autoDownload = false // Prevent automatic downloads

  // Cancelling an offer drops these so an abandoned download stops reaching the interface, so every check puts them
  // back — without that, the second offer of a session downloads behind a frozen progress bar.
  const forwardDownloadEvents = (): void => {
    autoUpdater.removeAllListeners('download-progress')
    autoUpdater.removeAllListeners('update-downloaded')

    autoUpdater.on('download-progress', (progressInfo) => {
      mainWindow.webContents.send('download-progress', progressInfo)
    })

    autoUpdater.on('update-downloaded', (info) => {
      mainWindow.webContents.send('update-downloaded', info)
    })
  }

  const checkForUpdates = (): void => {
    forwardDownloadEvents()
    autoUpdater
      .checkForUpdates()
      .then((e) => console.info(e))
      .catch((e) => console.error(e))
  }

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow.webContents.send('update-not-available', info)
  })

  autoUpdater.on('error', (error) => {
    mainWindow.webContents.send('update-error', error.message)
  })

  checkForUpdates()

  // Add handlers for update control
  ipcMain.handle('check-for-updates', () => {
    if (!autoUpdater.isUpdaterActive()) return false
    checkForUpdates()
    return true
  })

  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.on('cancel-update', () => {
    autoUpdater.removeAllListeners('update-downloaded')
    autoUpdater.removeAllListeners('download-progress')
  })
}
