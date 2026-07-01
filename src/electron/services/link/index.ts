import { BrowserWindow, ipcMain } from 'electron'

import type { SerialPortInfo } from '../../../types/serial'
import { Link } from './link'
import { SerialLink } from './serial'
import { TcpLink } from './tcp'
import { UdpLink } from './udp'

// We need to use SerialPort with require here (as done in serial.ts), because bundling the ESM import as a
// value pulls the native @serialport/bindings-cpp binary into the bundle and breaks its runtime resolution.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SerialPortObject = require('serialport').SerialPort

/**
 * Serial service for electron
 */
class LinkService {
  private links: Map<string, Link> = new Map()
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
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })
  }

  /**
   * Setup IPC handlers
   */
  private setupIpcHandlers(): void {
    ipcMain.handle('serial-list-ports', async () => {
      const ports = await SerialPortObject.list()
      return ports.map((port: SerialPortInfo) => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        vendorId: port.vendorId,
        productId: port.productId,
      }))
    })

    ipcMain.handle('link-open', async (_, { path }): Promise<boolean> => {
      console.log(`Attempting to open link: ${path}`)

      if (this.links.has(path)) {
        console.warn(`Serial port ${path} is already open`)
        return true
      }

      const uri = new URL(path)
      let link

      switch (uri.protocol) {
        case 'serial:':
          link = new SerialLink(uri)
          break
        case 'tcpin:':
        case 'tcpout:':
          link = new TcpLink(uri)
          break
        case 'udpin:':
        case 'udpout:':
        case 'udpbcast:':
          link = new UdpLink(uri)
          break
        default:
          return false
      }

      try {
        await link.open()
        this.links.set(path, link)

        link.on('data', (data: Buffer) => {
          this.mainWindow?.webContents.send('link-data', {
            path,
            data: Array.from(data),
          })
        })

        link.on('error', (inner_error: any) => {
          console.error(`Serial port ${path} error:`, inner_error)
        })

        link.on('close', () => {
          this.links.delete(path)
          console.warn(`Link ${path} closed`)
        })

        return true
      } catch (error) {
        console.error(`Failed to open link ${path}:`, error)
        return false
      }
    })

    ipcMain.handle('link-write', async (_, { path, data }): Promise<boolean> => {
      const link = this.links.get(path)
      if (!link?.isOpen) {
        return false
      }

      try {
        await link.write(data)
        return true
      } catch (error) {
        console.error(`Failed to write to link ${path}:`, error)
        return false
      }
    })

    ipcMain.handle('link-close', async (_, { path }): Promise<boolean> => {
      const link = this.links.get(path)
      if (!link) {
        return true
      }

      try {
        await link.close()
        this.links.delete(path)
        return true
      } catch (error) {
        console.error(`Failed to close link ${path}:`, error)
        return false
      }
    })
  }

  /**
   * Handle incoming data from a link
   * @param {string} path - The data received from the link
   * @returns {Function} - The function to handle the data
   * @private
   */
  private _getOnData(path: string) {
    return (data: Buffer) => {
      try {
        this.mainWindow!.webContents.send('link-data', {
          path: path,
          data: Array.from(data),
        })
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Error sending data for link ${path}:`, err.message)
        }
      }
    }
  }
}

export const linkService = new LinkService()
