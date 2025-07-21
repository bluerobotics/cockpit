import { app, BrowserWindow, protocol, screen } from 'electron'
import { join } from 'path'

import { setupAutoUpdater } from './services/auto-update'
import store from './services/config-store'
import { setupElectronLogService } from './services/electron-log'
import { setupJoystickMonitoring } from './services/joystick'
import { setupNetworkService } from './services/network'
import { setupResourceMonitoringService } from './services/resource-monitoring'
import { serialService } from './services/serial'
import { setupFilesystemStorage } from './services/storage'
import { setupWorkspaceService } from './services/workspace'

// Setup the logger service as soon as possible to avoid different behaviors across runtime
setupElectronLogService()

export const ROOT_PATH = {
  dist: join(__dirname, '..'),
}

let mainWindow: BrowserWindow | null

/**
 * Create electron window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    icon: join(ROOT_PATH.dist, 'pwa-512x512.png'),
    webPreferences: {
      preload: join(ROOT_PATH.dist, 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    width: store.get('windowBounds')?.width ?? screen.getPrimaryDisplay().workAreaSize.width,
    height: store.get('windowBounds')?.height ?? screen.getPrimaryDisplay().workAreaSize.height,
    x: store.get('windowBounds')?.x ?? screen.getPrimaryDisplay().bounds.x,
    y: store.get('windowBounds')?.y ?? screen.getPrimaryDisplay().bounds.y,
  })

  serialService.setMainWindow(mainWindow)

  mainWindow.on('move', () => {
    const windowBounds = mainWindow!.getBounds()
    const { x, y, width, height } = windowBounds
    store.set('windowBounds', { x, y, width, height })
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

setupFilesystemStorage()
setupNetworkService()
setupResourceMonitoringService()
setupWorkspaceService()
setupJoystickMonitoring()

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
