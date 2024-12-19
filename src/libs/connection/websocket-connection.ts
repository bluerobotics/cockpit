import { MAVLink20Processor } from 'mavlink-browser'

import * as Protocol from '@/libs/vehicle/protocol/protocol'

import * as Connection from './connection'

/**
 * Connection abstraction for websocket communication
 */
export class WebSocketConnection extends Connection.Abstract {
  _socket: WebSocket
  private _textEncoder = new TextEncoder()
  private _textDecoder = new TextDecoder()
  private mavlinkParser = new MAVLink20Processor()
  /**
   * Websocket constructor
   * @param  {Connection.URI} uri
   * @param  {Protocol.Type} vehicleProtocol
   */
  constructor(uri: Connection.URI, vehicleProtocol: Protocol.Type) {
    super(uri, vehicleProtocol)
    this.mavlinkParser.on('message', (message: any) => {
      const data = this._textEncoder.encode(this.mavlink2restfy(message))
      this.onRead.emit_value(data)
    })
    this._socket = this.createSocket(uri)
  }

  /**
   * Disconnect the websocket
   * @returns {boolean}
   */
  disconnect(): boolean {
    unimplemented()
    return true
  }

  /**
   * Do the websocket connection
   * @returns {boolean}
   */
  connect(): boolean {
    unimplemented()
    return true
  }

  /**
   * Check if connection is still alive
   * @returns {boolean}
   */
  isConnected(): boolean {
    unimplemented()
    return true
  }

  /**
   * Write data to websocket
   * @param  {Uint8Array} data
   * @returns {boolean}
   */
  write(data: Uint8Array): boolean {
    this._socket?.send(this._textDecoder.decode(data))
    return true
  }

  /**
   * Create internal websocket connection
   * @param  {Connection.URI} uri
   * @returns {WebSocket}
   */
  protected createSocket(uri: Connection.URI): WebSocket {
    const socket = new WebSocket(uri)

    // TODO:
    // We need to parse the websocket message to a simple string and let the one that
    // receives do the json parsing
    // We need to have the same abstraction for all onRead
    socket.onmessage = (message: MessageEvent) => {
      try {
        if (String.fromCharCode(message.data[0]) == '{') {
          this.onRead.emit_value(this._textEncoder.encode(message.data))
        } else {
          new Response(message.data).arrayBuffer().then((buffer) => {
            this.mavlinkParser.parseBuffer(new Uint8Array(buffer))
          })
        }
      } catch (error) {
        console.error('Error reading websocket message: ', error)
      }
    }
    socket.onclose = () => {
      setTimeout(() => {
        this._socket = this.createSocket(uri)
      }, 2000)
    }
    return socket
  }

  /**
   *
   * @param {any} message a "raw" MAVLink message as it comes from Mavlink20Processor
   * @returns {string} a MAVLink2Rest-like stringified json object
   */
  mavlink2restfy(message): any {
    return JSON.stringify(this.mavlinkParser.toMavlink2RestV1Format(message))
  }
}
