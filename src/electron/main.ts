import { app, BrowserWindow, protocol, screen, session } from 'electron'
import { join } from 'path'

import { setupAutoUpdater } from './services/auto-update'
import store from './services/config-store'
import { setupElectronLogService } from './services/electron-log'
import { setupJoystickMonitoring } from './services/joystick'
import { linkService } from './services/link'
import { setupNetworkService } from './services/network'
import { setupResourceMonitoringService } from './services/resource-monitoring'
import { setupFilesystemStorage } from './services/storage'
import { setupSystemInfoService } from './services/system-info'
import { setupUserAgentService } from './services/user-agent'
import { setupVideoRecordingService } from './services/video-recording'
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
      webSecurity: !process.env.VITE_DEV_SERVER_URL, // Disable CORS in dev mode - workaround for BlueOS extensions with broken CORS headers
    },
    autoHideMenuBar: true,
    width: store.get('windowBounds')?.width ?? screen.getPrimaryDisplay().workAreaSize.width,
    height: store.get('windowBounds')?.height ?? screen.getPrimaryDisplay().workAreaSize.height,
    x: store.get('windowBounds')?.x ?? screen.getPrimaryDisplay().bounds.x,
    y: store.get('windowBounds')?.y ?? screen.getPrimaryDisplay().bounds.y,
    title: `Cockpit (${app.getVersion()})`,
  })

  linkService.setMainWindow(mainWindow)

  mainWindow.on('move', () => {
    const windowBounds = mainWindow!.getBounds()
    const { x, y, width, height } = windowBounds
    store.set('windowBounds', { x, y, width, height })
  })

  // Don't use the browser page title
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
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
setupSystemInfoService()
setupUserAgentService()
setupWorkspaceService()
setupJoystickMonitoring()
setupVideoRecordingService()

app.whenReady().then(async () => {
  console.log('Electron app is ready.')
  console.log(`Cockpit version: ${app.getVersion()}`)

  // TODO: Remove this workaround once BlueOS extensions fix their CORS headers
  // This fixes extensions that send duplicate 'Access-Control-Allow-Origin: *, *' headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }

    // Normalize CORS headers - some extensions send duplicate values like "*, *"
    const corsHeader = responseHeaders['Access-Control-Allow-Origin'] || responseHeaders['access-control-allow-origin']
    if (corsHeader) {
      const headerKey = responseHeaders['Access-Control-Allow-Origin']
        ? 'Access-Control-Allow-Origin'
        : 'access-control-allow-origin'
      // Take only the first value if there are duplicates
      responseHeaders[headerKey] = [corsHeader[0].split(',')[0].trim()]
    }

    callback({ responseHeaders })
  })

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
