import * as Vehicle from '@/libs/vehicle/vehicle'

import { Abstract, Scheme } from './connection'

/**
 * Connection abstraction for websocket communication
 */
export class WebSocketConnection extends Abstract {
  _socket: WebSocket
  private _readCallback: (data: Uint8Array) => void

  /**
   * Websocket constructor
   *
   * @param  {Scheme} scheme
   * @param  {Vehicle.ProtocolType} vehicleProtocol
   */
  constructor(scheme: Scheme, vehicleProtocol: Vehicle.ProtocolType) {
    super(scheme, vehicleProtocol)

    this._socket = this.createSocket(scheme)
  }

  /**
   * Disconnect the websocket
   *
   * @returns {boolean}
   */
  disconnect(): boolean {
    unimplemented()
    return true
  }

  /**
   * Do the websocket connection
   *
   * @returns {boolean}
   */
  connect(): boolean {
    unimplemented()
    return true
  }

  /**
   * Check if connection is still alive
   *
   * @returns {boolean}
   */
  isConnected(): boolean {
    unimplemented()
    return true
  }

  /**
   * Write data to websocket
   *
   * @param  {Uint8Array} data
   * @returns {boolean}
   */
  write(data: Uint8Array): boolean {
    unused(data)
    unimplemented()
    return true
  }

  /**
   * Create internal websocket connection
   *
   * @param  {Scheme} scheme
   * @returns {WebSocket}
   */
  protected createSocket(scheme: Scheme): WebSocket {
    const socket = new WebSocket(scheme)

    // TODO:
    // We need to parse the websocket message to a simple string and let the one that
    // receives do the json parsing
    // We need to have the same abstraction for all onRead
    socket.onmessage = this._readCallback
    socket.onclose = () => {
      setTimeout(() => {
        this._socket = this.createSocket(scheme)
      }, 2000)
    }
    return socket
  }

  /**
   * Sets callback to be used when new data is received
   *
   * @param  {(data:Uint8Array)=>void} callback
   */
  onRead(callback: (data: Uint8Array) => void): void {
    this._readCallback = callback
    this._socket.onmessage = this._readCallback
  }
}
