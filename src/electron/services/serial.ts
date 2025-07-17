import { PortInfo } from '@serialport/bindings-interface'
import { BrowserWindow, ipcMain } from 'electron'
import { SerialPort } from 'serialport'

// We need to use the SerialPort with require here, we are importing the object
// not the type.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SerialPortObject = require('serialport').SerialPort

/**
 * Serial service for electron
 */
class SerialService {
  private ports: Map<string, SerialPort> = new Map()
  private mainWindow: BrowserWindow | null = null

  /**
   * Serial Service Constructor
   */
  constructor() {
    this.setupIpcHandlers()
  }

  /**
   * Set the main window
   * @param {BrowserWindow} window - The main window
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * Setup IPC handlers
   */
  private setupIpcHandlers(): void {
    ipcMain.handle('serial-list-ports', SerialPortObject.list)

    ipcMain.handle('serial-open', async (_, { path, baudRate = 115200 }): Promise<boolean> => {
      console.log(`Attempting to open serial port: ${path}:${baudRate}`)

      if (this.ports.has(path)) {
        console.warn(`Serial port ${path} is already open`)
        return true
      }

      try {
        const ports = await SerialPortObject.list()
        console.log(
          `Available serial ports:`,
          ports.map((p: PortInfo) => p.path)
        )
        const portExists = ports.some((p: PortInfo) => p.path === path)
        if (!portExists) {
          console.error(`Port ${path} not found`)
          return false
        }
      } catch (listError: any) {
        console.error('Error listing ports:', listError)
      }

      const port = new SerialPortObject({
        path,
        baudRate,
        autoOpen: false,
      })

      return new Promise((resolve) => {
        port.open((error: Error | null) => {
          if (error) {
            console.error(`Error opening serial port ${path}:`, error)
            resolve(false)
            return
          }

          this.ports.set(path, port)

          port.on('data', (data: Buffer) => {
            this.mainWindow!.webContents.send('serial-data', {
              path,
              data: Array.from(data),
            })
          })

          port.on('error', (inner_error: any) => {
            console.error(`Serial port ${path} error:`, inner_error)
          })

          port.on('close', () => {
            this.ports.delete(path)
          })

          resolve(true)
        })
      })
    })

    ipcMain.handle('serial-write', async (_, { path, data }): Promise<boolean> => {
      const port = this.ports.get(path)
      if (!port?.isOpen) {
        return false
      }

      return new Promise((resolve) => {
        port.write(Buffer.from(data), (error: Error | null | undefined) => {
          if (error) {
            console.error(`Error writing to serial port ${path}:`, error)
            resolve(false)
          } else {
            resolve(true)
          }
        })
      })
    })

    ipcMain.handle('serial-close', async (_, { path }): Promise<boolean> => {
      const port = this.ports.get(path)
      if (!port) {
        return true
      }

      return new Promise((resolve) => {
        port.close((error: Error | null) => {
          if (error) {
            console.error(`Error closing serial port ${path}:`, error)
            resolve(false)
          } else {
            this.ports.delete(path)
            resolve(true)
          }
        })
      })
    })

    ipcMain.handle('serial-is-open', async (_, { path }): Promise<boolean> => {
      const port = this.ports.get(path)
      return port?.isOpen ?? false
    })
  }
}

export const serialService = new SerialService()
