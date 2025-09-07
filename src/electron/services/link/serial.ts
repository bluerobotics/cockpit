import { PortInfo } from '@serialport/bindings-cpp'
import { SerialPort } from 'serialport'

import { Link } from './link'

// We need to use the SerialPort with require here, we are importing the object
// not the type.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SerialPortObject = require('serialport').SerialPort

/**
 * SerialLink class for managing serial connections
 */
export class SerialLink extends Link {
  protocol: string
  path: string
  baudRate = 115200 // Default baud rate, can be adjusted as needed
  socket?: SerialPort

  /**
   * Serial Link Constructor
   * @param {URL} uri - The URI of the TCP link
   * @throws {Error} If the URI is invalid or the protocol is not supported
   * @description The URI should be in the format: serial:path?baudrate=[baudrate default:115200]
   * For example: serial:/dev/ttyUSB0?baudrate=115200
   */
  constructor(uri: URL) {
    super(uri)
    this.protocol = uri.protocol.replace(':', '')
    this.path = uri.pathname
    this.baudRate = parseInt(uri.searchParams.get('baudrate') || '115200', 10)
    if (isNaN(this.baudRate) || this.baudRate <= 0) {
      throw new Error(`Invalid baud rate: ${uri.searchParams.get('baudrate')}`)
    }
  }

  /**
   * Open the serial link
   * @returns {void}
   * @description This method should create a serial port connection using the specified path and baud rate.
   * It should handle any necessary setup for the serial port, such as configuring the data bits, stop bits, and parity.
   * @example
   * const serialLink = new SerialLink(new URL('serial:///dev/ttyUSB0?baudRate=115200'))
   * serialLink.open()
   */
  async open(): Promise<void> {
    try {
      const ports = await SerialPortObject.list()
      console.log(
        `Available serial ports:`,
        ports.map((p: PortInfo) => p.path)
      )
      const portExists = ports.some((p: PortInfo) => p.path === this.path)
      if (!portExists) {
        throw new Error(`Port ${this.path} not found`)
      }
    } catch (listError: any) {
      console.error('Error listing ports:', listError)
    }

    const port = new SerialPortObject({
      path: this.path,
      baudRate: this.baudRate,
      autoOpen: false,
    })

    return new Promise((resolve, reject) => {
      port.open((error: Error | null) => {
        if (error) {
          console.error(`Error opening serial port ${this.path}:`, error)
          reject()
          return
        }

        this.socket = port

        port.on('data', (data: Buffer) => this.emit('data', data))

        port.on('error', (inner_error: any) => {
          this.emit('error', inner_error)
        })

        port.on('close', () => {
          this.emit('close')
        })

        resolve()
      })
    })
  }

  /**
   * Close the serial link
   * @returns {Promise<void>}
   * @description This method should close the serial port connection and clean up any resources.
   * It should ensure that the port is properly closed to avoid any resource leaks.
   * @throws {Error} If the method is not implemented
   * @example
   * const serialLink = new SerialLink(new URL('serial:///dev/ttyUSB0?baudRate=115200'))
   * await serialLink.close()
   */
  async close(): Promise<void> {
    if (!this.isOpen) {
      console.warn(`Serial link on path ${this.path} is already closed.`)
      return
    }

    return new Promise((resolve, reject) => {
      this.socket?.removeAllListeners()
      this.socket?.close((error: Error | null) => {
        if (error) {
          console.error(`Error closing serial port ${this.path}:`, error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Write data to the serial link
   * @param {Uint8Array} data - The data to write to the serial link
   * @returns {Promise<void>}
   * @description This method should send data over the serial link.
   * It should handle the data format and ensure it is sent correctly.
   * @throws {Error} If the method is not implemented
   * @example
   * const data = new Uint8Array([0x01, 0x02, 0x03])
   * serialLink.write(data)
   */
  async write(data: Uint8Array): Promise<void> {
    if (!this.isOpen) {
      console.warn(`Serial link on path ${this.path} is already closed.`)
      return
    }

    return new Promise((resolve, reject) => {
      this.socket!.write(Buffer.from(data), (error: Error | null | undefined) => {
        if (error) {
          console.error(`Error writing to serial port ${this.path}:`, error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Check if the serial link is open
   * @returns {boolean}
   * @description This method should return true if the serial link is currently open, otherwise false.
   * @example
   * const serialLink = new SerialLink(new URL('serial:///dev/ttyUSB0?baudRate=115200'))
   * serialLink.isOpen() // returns true or false based on the link status
   */
  get isOpen(): boolean {
    return this.socket?.isOpen ?? false
  }
}
