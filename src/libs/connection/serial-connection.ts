import init, { ParserEmitter } from 'mavlink2rest-wasm'
// @ts-ignore
import wasmUrl from 'mavlink2rest-wasm/mavlink2rest_wasm_bg.wasm?url'

import * as Connection from './connection'

/**
 * Serial port abstraction using IPC
 */
class SerialPortConnection {
  private path: string
  private baudRate: number
  private _onRead: ((data: Uint8Array) => void) | undefined
  private _isOpen = false

  private _uri: Connection.URI

  /**
   * Serial port constructor
   * @param {Connection.URI} uri
   */
  constructor(uri: Connection.URI) {
    this._uri = uri
    this._onRead = undefined

    const baudrateStr = this._uri.entries().get('baudrate') ?? '115200'
    this.baudRate = parseInt(baudrateStr, 10)
    this.path = this._uri.hostname || this._uri.pathname
  }

  /**
   * Initialize serial port connection
   */
  async initialize(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available')
    }

    this._isOpen = await window.electronAPI.serialOpen(this.path, this.baudRate)

    if (!this._isOpen) {
      throw new Error('Failed to open serial port')
    }
  }

  /**
   * Set callback for reading serial port
   * @param {Function} callback
   */
  onRead(callback: (data: Uint8Array) => void): void {
    this._onRead = callback
  }

  /**
   * Write data to serial port
   * @param {Uint8Array} data
   */
  async write(data: Uint8Array): Promise<void> {
    await window!.electronAPI!.serialWrite(this.path, data)
  }

  /**
   * Close serial port connection
   */
  async close(): Promise<void> {
    await window!.electronAPI!.serialClose(this.path)
  }

  /**
   * Check if port is open
   * @returns {boolean}
   */
  isOpen(): boolean {
    return this._isOpen
  }

  /**
   * Get the port path
   * @returns {string}
   */
  getPath(): string {
    return this.path
  }
}

/**
 * Connection abstraction for serial communication
 */
export class SerialConnection extends Connection.Abstract {
  private _serial: SerialPortConnection | undefined
  private _textEncoder = new TextEncoder()
  private _textDecoder = new TextDecoder()
  private _mavlink2rest: ParserEmitter | undefined

  /**
   * Initialize the connection
   */
  async initialize(): Promise<void> {
    await init(wasmUrl)
    this._mavlink2rest = new ParserEmitter()
    this._serial = this.createSerial(this.uri())
    await this._serial.initialize()

    window!.electronAPI!.onSerialData((data) => {
      if (data.path === this._serial?.getPath()) {
        this.processRawMavlink(new Uint8Array(data.data))
      }
    })
  }

  /**
   * Disconnect the serial
   * @returns {boolean}
   */
  disconnect(): boolean {
    if (this._serial) {
      this._serial.close()
      this._serial = undefined
    }
    return true
  }

  /**
   * Do the serial connection
   * @returns {boolean}
   */
  connect(): boolean {
    return true
  }

  /**
   * Check if connection is still alive
   * @returns {boolean}
   */
  isConnected(): boolean {
    return this._serial?.isOpen() ?? false
  }

  /**
   * Write data to serial
   * @param  {Uint8Array} data
   * @returns {boolean}
   */
  write(data: Uint8Array): boolean {
    try {
      const decoded = this._textDecoder.decode(data)
      const serial_data = this._mavlink2rest?.rest2mavlink(decoded)
      if (this._serial) {
        Promise.resolve().then(async () => {
          await this._serial?.write(serial_data)
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Error writing to serial:', error)
      return false
    }
  }

  /**
   * Create internal websocket connection
   * @param  {Connection.URI} uri
   * @returns {SerialPortConnection}
   */
  private createSerial(uri: Connection.URI): SerialPortConnection {
    const serial = new SerialPortConnection(uri)
    return serial
  }

  /**
   * Process raw mavlink data
   * @param {Uint8Array} raw_data
   */
  private processRawMavlink(raw_data: Uint8Array): void {
    this._mavlink2rest?.parser(raw_data)
    this._mavlink2rest?.emit((mavlink_json: string) => {
      this.onRead.emit_value(this._textEncoder.encode(mavlink_json))
    })
  }
}
