import { app, BrowserWindow, protocol, screen } from 'electron'
import electronUpdater, { type AppUpdater } from 'electron-updater'
import { join } from 'path'

export const ROOT_PATH = {
  dist: join(__dirname, '..'),
}

let mainWindow: BrowserWindow | null

/**
 * Create electron window
 */
function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({
    icon: join(ROOT_PATH.dist, 'pwa-512x512.png'),
    webPreferences: {
      webSecurity: false,
      contextIsolation: false,
      nodeIntegration: true,
      allowRunningInsecureContent: true,
    },
    width,
    height,
  })

  // Test active push message to Renderer-process.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(ROOT_PATH.dist, 'index.html'))
  }
}

// Function to log messages to the testSpan element
/**
 * Log a message to the testSpan element in the main window
 * @param {string} message - The message to log
 * @returns {void}
 */
function internalLog(message: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.log('Main window is not available.')
    return
  }

  console.log(message)
  mainWindow.webContents.executeJavaScript(`
    console.log('${message}')
  `)
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

app.whenReady().then(createWindow)

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

app.whenReady().then(() => {
  internalLog('Electron app is ready.')

  // Check for software updates
  internalLog('Will start update checking routine...')

  const autoUpdater = getAutoUpdater()
  autoUpdater.forceDevUpdateConfig = true

  autoUpdater.on('checking-for-update', () => {
    internalLog('Checking for update...')
  })
  autoUpdater.on('update-available', (info) => {
    internalLog('Update available.')
    internalLog(JSON.stringify(info))
  })
  autoUpdater.on('update-not-available', (info) => {
    internalLog('Update not available.')
    internalLog(JSON.stringify(info))
  })
  autoUpdater.on('error', (err) => {
    internalLog('Error in auto-updater. ' + err)
  })
  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Download speed: ' + progressObj.bytesPerSecond
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
    log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')'
    internalLog(log_message)
  })
  autoUpdater.on('update-downloaded', (info) => {
    internalLog('Update downloaded')
    internalLog(JSON.stringify(info))
  })

  autoUpdater
    .checkForUpdates()
    .then((e) => {
      internalLog(e)
    })
    .catch((e) => {
      internalLog(e)
    })

  internalLog(`Cockpit version: ${app.getVersion()}`)
})

app.on('before-quit', () => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (import.meta.env.DEV) {
    app.exit()
  }
})
