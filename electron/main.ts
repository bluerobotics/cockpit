import { app, BrowserWindow, protocol, screen } from 'electron'
import logger from 'electron-log'
import { join } from 'path'

import { setupAutoUpdater } from './services/auto-update'
import { setupNetworkService } from './services/network'

// If the app is packaged, push logs to the system instead of the console
if (app.isPackaged) {
  Object.assign(console, logger.functions)
}

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
      preload: join(ROOT_PATH.dist, 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    width,
    height,
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(ROOT_PATH.dist, 'index.html'))
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

setupNetworkService()

app.whenReady().then(async () => {
  console.log('Electron app is ready.')
  console.log(`Cockpit version: ${app.getVersion()}`)

  console.log('Creating window...')
  createWindow()

  setTimeout(() => {
    setupAutoUpdater(mainWindow as BrowserWindow)
  }, 5000)
})

app.on('before-quit', () => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (import.meta.env.DEV) {
    app.exit()
  }
})
