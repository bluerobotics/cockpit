import init, { ParserEmitter } from 'mavlink2rest-wasm'
// @ts-ignore
import wasmUrl from 'mavlink2rest-wasm/mavlink2rest_wasm_bg.wasm?url'

import * as Connection from './connection'

/**
 * Electron connection abstraction using IPC
 */
class ElectronConnectionIPC {
  private path: string
  private _onRead: ((data: Uint8Array) => void) | undefined
  private _isOpen = false

  private _uri: Connection.URI

  /**
   * Connection link constructor
   * @param {Connection.URI} uri
   */
  constructor(uri: Connection.URI) {
    this._uri = uri
    this._onRead = undefined

    // Fix the path to be compatible with WHATWG URL standard
    // otherwise URL won't separate port from ip address
    // eg. (udpin:) -> (udpin://), (udpin://) -> (udpin://)
    // would not work with: (udpin:/), (:0.0.0.0)
    this.path = uri.toString().replace(/^([^:]+):(\/\/)?/, '$1://')
  }

  /**
   * Initialize connection link connection
   */
  async initialize(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('This connection is only available in desktop version')
    }

    this._isOpen = await window.electronAPI.linkOpen(this.path)

    if (!this._isOpen) {
      throw new Error('Failed to open connection link')
    }
  }

  /**
   * Set callback for reading connection link
   * @param {Function} callback
   */
  onRead(callback: (data: Uint8Array) => void): void {
    this._onRead = callback
  }

  /**
   * Write data to connection port
   * @param {Uint8Array} data
   */
  async write(data: Uint8Array): Promise<void> {
    await window!.electronAPI!.linkWrite(this.path, data)
  }

  /**
   * Close connection port connection
   */
  async close(): Promise<void> {
    await window!.electronAPI!.linkClose(this.path)
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
 * Connection abstraction for connection communication
 */
export class ElectronConnection extends Connection.Abstract {
  private _connection: ElectronConnectionIPC | undefined
  private _textEncoder = new TextEncoder()
  private _textDecoder = new TextDecoder()
  private _mavlink2rest: ParserEmitter | undefined

  /**
   * Initialize the connection
   */
  async initialize(): Promise<void> {
    await init(wasmUrl)
    this._mavlink2rest = new ParserEmitter()
    this._connection = this.createConnection(this.uri())
    await this._connection.initialize()

    window!.electronAPI!.onLinkData((data) => {
      if (data.path === this._connection?.getPath()) {
        this.processRawMavlink(new Uint8Array(data.data))
      }
    })
  }

  /**
   * Disconnect the connection
   * @returns {boolean}
   */
  disconnect(): boolean {
    if (this._connection) {
      this._connection.close()
      this._connection = undefined
    }
    return true
  }

  /**
   * Do the connection connection
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
    return this._connection?.isOpen() ?? false
  }

  /**
   * Write data to connection
   * @param  {Uint8Array} data
   * @returns {boolean}
   */
  write(data: Uint8Array): boolean {
    try {
      const decoded = this._textDecoder.decode(data)
      const connection_data = this._mavlink2rest?.rest2mavlink(decoded)
      if (this._connection) {
        Promise.resolve().then(async () => {
          await this._connection?.write(connection_data)
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Error writing to connection:', error)
      return false
    }
  }

  /**
   * Create internal websocket connection
   * @param  {Connection.URI} uri
   * @returns {ElectronConnectionIPC}
   */
  private createConnection(uri: Connection.URI): ElectronConnectionIPC {
    const connection = new ElectronConnectionIPC(uri)
    return connection
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
