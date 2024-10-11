import { app, BrowserWindow, protocol, screen } from 'electron'
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

app.on('before-quit', () => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (import.meta.env.DEV) {
    app.exit()
  }
})
