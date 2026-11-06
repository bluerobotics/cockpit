import { execFileSync } from 'child_process'
import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater, { type AppUpdater, type UpdateInfo } from 'electron-updater'

/**
 * Whether electron-updater would download the build for this Mac's processor. It falls back to the Intel build when
 * the feed lists no arm64 one, and takes "ARM" anywhere in `uname -a`, the computer name included, as Apple Silicon.
 * @param {UpdateInfo} info - The update the feed offers
 * @returns {boolean} False when the download would be a build this Mac should not run
 */
const offersBuildForThisMac = (info: UpdateInfo): boolean => {
  if (process.platform !== 'darwin') return true
  const offersArm64 = info.files.some((file) => file.url.includes('arm64'))
  if (process.arch === 'arm64') return offersArm64
  // Under Rosetta either build runs, so the arm64 one it prefers and the Intel fallback are both fine.
  if (app.runningUnderARM64Translation || !offersArm64) return true
  // ponytail: mirrors MacUpdater's `uname -a` check as of electron-updater 6.6.2-6.8.11; drop this once it stops
  // matching the computer name, or Intel Macs named like "PHARMA-MBP" stay refused updates they could install.
  try {
    return !execFileSync('uname', ['-a'], { encoding: 'utf8' }).includes('ARM')
  } catch {
    // electron-updater reads a failed uname as Intel too, so it picks the Intel build.
    return true
  }
}

/**
 * Setup auto updater
 * @param {BrowserWindow} mainWindow - The main Electron window
 */
export const setupAutoUpdater = (mainWindow: BrowserWindow): void => {
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
    if (!offersBuildForThisMac(info)) {
      const releasesUrl = 'https://github.com/bluerobotics/cockpit/releases'
      const message = `Cockpit cannot download version ${info.version} automatically on this Mac. Get it from ${releasesUrl}`
      mainWindow.webContents.send('update-error', message)
      return
    }
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
