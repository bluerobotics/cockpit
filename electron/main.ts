import { app, BrowserWindow, ipcMain, protocol, screen } from 'electron'
// @ts-ignore: electron-updater is not a module
import electronUpdater, { type AppUpdater } from 'electron-updater'
import { join } from 'path'

export const ROOT_PATH = {
  dist: join(__dirname, '..'),
}

let mainWindow: BrowserWindow | null

/**
 * Get auto updater instance
 * @returns {AppUpdater}
 * @see https://www.electron.build/auto-update
 */
function getAutoUpdater(): AppUpdater {
  // Using destructuring to access autoUpdater due to the CommonJS module of 'electron-updater'.
  // It is a workaround for ESM compatibility issues, see https://github.com/electron-userland/electron-builder/issues/7976.
  const { autoUpdater } = electronUpdater
  autoUpdater.logger = require('electron-log')
  // @ts-ignore
  autoUpdater.logger.transports.file.level = 'info'
  return autoUpdater
}

/**
 * Create electron window
 */
async function createWindow(): Promise<void> {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({
    icon: join(ROOT_PATH.dist, 'pwa-512x512.png'),
    webPreferences: {
      preload: join(ROOT_PATH.dist, 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    width,
    height,
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow!.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow!.loadFile(join(ROOT_PATH.dist, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  console.log('Closing application.')
  mainWindow = null
  app.quit()
})

app.on('ready', () => {
  protocol.registerFileProtocol('file', (i, o) => {
    o({ path: i.url.substring('file://'.length) })
  })
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'file',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
    },
  },
])

app.whenReady().then(async () => {
  console.log('Electron app is ready.')
  console.log(`Cockpit version: ${app.getVersion()}`)

  console.log('Creating window...')
  await createWindow()

  console.log('Setting up auto updater...')
  setTimeout(() => {
    setupAutoUpdater()
  }, 5000)
})

const setupAutoUpdater = (): void => {
  const autoUpdater = getAutoUpdater()
  autoUpdater.autoDownload = false // Prevent automatic downloads

  autoUpdater
    .checkForUpdates()
    .then((e) => console.log(e))
    .catch((e) => console.log(e))

  autoUpdater.on('checking-for-update', () => {
    mainWindow!.webContents.send('checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow!.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow!.webContents.send('update-not-available', info)
  })

  autoUpdater.on('download-progress', (progressInfo) => {
    mainWindow!.webContents.send('download-progress', progressInfo)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow!.webContents.send('update-downloaded', info)
  })

  // Add handlers for update control
  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.on('cancel-update', () => {
    // Cancel any ongoing download
    autoUpdater.removeAllListeners('update-downloaded')
    autoUpdater.removeAllListeners('download-progress')
  })
}

app.on('before-quit', () => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (import.meta.env.DEV) {
    app.exit()
  }
})
