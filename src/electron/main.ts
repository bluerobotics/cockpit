import { app, BrowserWindow, protocol, screen } from 'electron'
import logger from 'electron-log'
import { join } from 'path'

import { setupAutoUpdater } from './services/auto-update'
import store from './services/config-store'
import { setupNetworkService } from './services/network'
import { setupFilesystemStorage } from './services/storage'

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

app.whenReady().then(async () => {
  console.log('Electron app is ready.')
  console.log(`Cockpit version: ${app.getVersion()}`)

  console.log('Creating window...')
  createWindow()

  setTimeout(() => {
    setupAutoUpdater(mainWindow as BrowserWindow)
  }, 5000)

  const HID = require('node-hid')
  const devices = await HID.devicesAsync()

  const knownDevicesRegistry = [
    {
      vendorId: 1356,
      productId: 3302,
      bufferPositions: {
        leftStickX: 1,
        leftStickY: 2,
        rightStickX: 3,
        rightStickY: 4,
        buttons1: 5,
        buttons2: 6,
        buttons3: null,
        buttons4: null,
        leftBumper: 8,
        rightBumper: 9,
      },
    },
    {
      vendorId: 1118,
      productId: 2835,
      bufferPositions: {
        leftStickX: 2,
        leftStickY: 4,
        rightStickX: 6,
        rightStickY: 8,
        buttons1: 14,
        buttons2: 15,
        buttons3: 13,
        buttons4: 16,
        leftBumper: 9,
        rightBumper: 11,
      },
    },
  ]

  const knownDevices = devices.filter((device) =>
    knownDevicesRegistry.some(
      (knownDevice) => knownDevice.vendorId === device.vendorId && knownDevice.productId === device.productId
    )
  )

  const knownGamepads = knownDevices.filter((device) => device.usage === 5)

  if (knownGamepads.length > 0) {
    console.log('Gamepads found:')
    console.log(knownGamepads)
    console.log('--------------------------------')
  }

  for (const gamepad of knownGamepads) {
    console.log(`Opening device: ${gamepad.product}`)
    try {
      const device = await HID.HIDAsync.open(gamepad.path)
      console.log('device', device)
      // const features = await device.getFeatureReport(0)
      // console.log('features', features)
      device.on('data', (data: Buffer) => {
        const buffer = Buffer.from(data)

        const registry = knownDevicesRegistry.find(
          (device) => device.vendorId === gamepad.vendorId && device.productId === gamepad.productId
        )
        if (!registry) {
          console.log('buffer:', buffer)
          for (let i = 0; i < 17; i++) {
            console.log(`Byte ${i}: ${buffer[i]}.`)
          }
        } else {
          const leftStickX = buffer[registry.bufferPositions.leftStickX]
          const leftStickY = buffer[registry.bufferPositions.leftStickY]
          const rightStickX = buffer[registry.bufferPositions.rightStickX]
          const rightStickY = buffer[registry.bufferPositions.rightStickY]
          const buttons1 = buffer[registry.bufferPositions.buttons1]
          const buttons2 = buffer[registry.bufferPositions.buttons2]
          let buttons3 = null
          if (registry.bufferPositions.buttons3 !== null) {
            buttons3 = buffer[registry.bufferPositions.buttons3]
          }
          const leftBumper = buffer[registry.bufferPositions.leftBumper]
          const rightBumper = buffer[registry.bufferPositions.rightBumper]

          console.log('leftStickX:', leftStickX)
          console.log('leftStickY:', leftStickY)
          console.log('rightStickX:', rightStickX)
          console.log('rightStickY:', rightStickY)
          console.log('buttons1:', buttons1)
          console.log('buttons2:', buttons2)
          console.log('buttons3:', buttons3)
          console.log('leftBumper:', leftBumper)
          console.log('rightBumper:', rightBumper)
        }

        // // Standard gamepad mapping based on HID data
        // const buttons = []
        // const axes = []

        // // First byte contains first 8 buttons
        // for (let i = 0; i < 8; i++) {
        //   buttons[i] = (buffer[0] & (1 << i)) !== 0
        // }

        // // Second byte contains next 8 buttons
        // for (let i = 0; i < 8; i++) {
        //   buttons[i + 8] = (buffer[1] & (1 << i)) !== 0
        // }

        // // Bytes 2-5 contain axes data
        // axes[0] = (buffer[2] - 128) / 128 // Left stick X
        // axes[1] = (buffer[3] - 128) / 128 // Left stick Y
        // axes[2] = (buffer[4] - 128) / 128 // Right stick X
        // axes[3] = (buffer[5] - 128) / 128 // Right stick Y

        // console.log('Gamepad state:', {
        //   buttons,
        //   axes
        // })
      })
    } catch (error) {
      console.error(`Error opening device. Error: ${error}`)
    }
    console.log('--------------------------------')
  }
})

app.on('before-quit', () => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (import.meta.env.DEV) {
    app.exit()
  }
})
