import { SerialPort } from 'dom-serial'
import init, { ParserEmitter } from 'mavlink2rest-wasm'
// @ts-ignore
import wasmUrl from 'mavlink2rest-wasm/mavlink2rest_wasm_bg.wasm?url'

import * as Connection from './connection'

/**
 * Serial port abstraction
 */
class SerialPortConnection {
  private port: SerialPort | undefined
  private readTimer: number | undefined
  private reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  private writer: WritableStreamDefaultWriter<Uint8Array> | undefined
  private _onRead: ((data: Uint8Array) => void) | undefined

  private _uri: Connection.URI

  /**
   * Serial port constructor
   * @param {Connection.URI} uri
   */
  constructor(uri: Connection.URI) {
    this._uri = uri
    this._onRead = undefined
  }

  /**
   * Initialize serial port connection
   */
  async initialize(): Promise<void> {
    const baudrateStr = this._uri.entries().get('baudrate') ?? '115200'
    const baudrate = parseInt(baudrateStr, 10)
    const port = await navigator.serial.requestPort()
    this.port = port
    await port.open({ baudRate: baudrate })

    port.addEventListener('error', (event: Event) => {
      console.error('Serial port error: ', event)
    })

    port.addEventListener('close', () => {
      console.debug('Serial port closed')
      if (this.readTimer) {
        clearInterval(this.readTimer)
        this.readTimer = undefined
      }
      this.releaseWriter()
    })

    this.readTimer = window.setInterval(() => this.readSerial(), 10)
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
    if (!this.port?.writable) {
      return
    }

    try {
      if (!this.writer) {
        this.writer = this.port.writable.getWriter()
      }
      await this.writer.write(data)
    } catch (error) {
      console.error('Error writing to serial port:', error)
      this.releaseWriter()
    }
  }

  /**
   * Release writer
   */
  private releaseWriter(): void {
    if (this.writer) {
      this.writer.releaseLock()
      this.writer = undefined
    }
  }

  /**
   * Read data from serial port
   */
  private async readSerial(): Promise<void> {
    if (!this.port?.readable) {
      return
    }

    try {
      if (!this.reader) {
        this.reader = this.port.readable.getReader()
        if (!this.reader) {
          return
        }
      }

      const { value, done } = await this.reader.read()
      if (done) {
        this.reader.releaseLock()
        this.reader = undefined
      }

      if (value) {
        this._onRead?.(value)
      }
    } catch (error) {
      console.error('Error reading from serial port:', error)
      if (this.reader) {
        this.reader.releaseLock()
        this.reader = undefined
      }
    }
  }

  /**
   * Close serial port connection
   */
  async close(): Promise<void> {
    if (this.readTimer) {
      clearInterval(this.readTimer)
      this.readTimer = undefined
    }

    if (this.reader) {
      this.reader.releaseLock()
      this.reader = undefined
    }

    this.releaseWriter()

    if (this.port) {
      await this.port.close()
      this.port = undefined
    }
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
    this._serial.onRead((data: Uint8Array) => {
      // For some reason it needs to be called inside a callback
      this.processRawMavlink(data)
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
    return this._serial !== undefined
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
