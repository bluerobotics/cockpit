import { BrowserWindow, ipcMain } from 'electron'
import electronUpdater, { type AppUpdater } from 'electron-updater'

/**
 * Setup auto updater
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
export const setupAutoUpdater = (mainWindow: BrowserWindow): void => {
  const autoUpdater: AppUpdater = electronUpdater.autoUpdater
  autoUpdater.logger = console
  autoUpdater.autoDownload = false // Prevent automatic downloads

  autoUpdater
    .checkForUpdates()
    .then((e) => console.info(e))
    .catch((e) => console.error(e))

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow.webContents.send('update-not-available', info)
  })

  autoUpdater.on('download-progress', (progressInfo) => {
    mainWindow.webContents.send('download-progress', progressInfo)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info)
  })

  // Add handlers for update control
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
