import { createSocket, Socket } from 'dgram'
import { isIP } from 'net'

import { Link } from './link'

type UdpProtocol = 'udpin' | 'udpout' | 'udpbcast'

/**
 * UDP Link Service
 * @module UdpLink
 * @description This class is used to manage UDP links in the Electron app.
 * It extends the Link class and provides methods to connect, disconnect, open, and close the UDP link.
 * It also includes properties for the protocol, host, port, multicast, and broadcast options.
 */
export class UdpLink extends Link {
  private _isOpen = false
  destination_host?: string
  destination_port?: number
  ipVersion: number
  protocol: UdpProtocol
  host: string
  port: number
  socket?: Socket

  /**
   * UDP Link Constructor
   * @param {URL} uri - The URI of the UDP link
   * @description The URI should be in the format: [udpin|udpout|udpbcast]:host:port
   * For example: udpin:0.0.0.0:14550
   */
  constructor(uri: URL) {
    super(uri)

    this._validateUri(uri)
    this.ipVersion = isIP(uri.hostname)
    this.protocol = uri.protocol.replace(':', '') as UdpProtocol
    this.host = uri.hostname
    this.port = parseInt(uri.port)

    if (this.protocol !== 'udpin') {
      this.destination_host = this.host
      this.destination_port = this.port
    }
  }

  /**
   * Open the UDP link
   * @returns {Promise<void>}
   * @description This method should create a UDP socket and bind it to the specified host and port.
   * It should also handle any necessary setup for multicast or broadcast if applicable.
   */
  open(): Promise<void> {
    this.socket = createSocket(this.ipVersion === 4 ? 'udp4' : 'udp6')
    if (this.protocol === 'udpbcast') {
      this.socket.setBroadcast(true)
    }

    this.socket.on('listening', () => {
      console.log('UDP socket is listening')
      this._isOpen = true
    })

    this.socket.on('close', () => {
      console.log('UDP socket closed')
      this._isOpen = false
      this.emit('close')
    })

    this.socket.on('message', (msg, rinfo) => {
      this.emit('data', msg)
      if (this.protocol === 'udpin') {
        this.destination_host = rinfo.address
        this.destination_port = rinfo.port
      }
    })

    return new Promise((resolve, reject) => {
      this.socket!.on('error', (err) => {
        console.error(`UDP socket error: ${err.message}`)
        this.socket!.close()
        reject(err)
      })

      console.log(`Binding UDP socket to ${this.host}:${this.port} with protocol ${this.protocol}`)
      this.socket!.bind(
        this.protocol === 'udpin' ? this.port : 0,
        this.protocol == 'udpin' ? this.host : '0.0.0.0',
        () => {
          resolve()
        }
      )
    })
  }

  /**
   * Close the UDP link
   * @returns {Promise<void>}
   * @description This method should close the UDP socket and clean up any resources.
   */
  close(): Promise<void> {
    console.log(`Closing UDP link at ${this.host}:${this.port}`)
    return new Promise((resolve, reject) => {
      if (this.socket) {
        this.socket.removeAllListeners()
        this.socket.once('error', reject)
        this.socket.close(() => {
          this.socket?.off('error', reject)
          resolve()
        })
      } else {
        console.warn('No UDP socket to close')
        resolve()
      }
    })
  }

  /**
   * Write data to the UDP link
   * @param {Uint8Array} data - The data to write to the UDP link
   * @returns {Promise<void>}
   * @description This method should send data over the UDP link.
   * It should handle the data format and ensure it is sent to the correct host and port.
   * @example
   */
  write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(Error('UDP socket is not defined'))
        return
      }

      if (!this.isOpen) {
        reject(Error('UDP socket is not open'))
        return
      }

      this.socket.send(data, 0, data.length, this.destination_port, this.destination_host, (err) => {
        if (err) {
          console.error(`Error sending data: ${err.message}`)
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Check if the UDP link is open
   * @returns {boolean}
   * @description This method should return true if the UDP link is open, false otherwise.
   * @example
   * const udpLink = new UdpLink(new URL('udpin://localhost:12345'));
   * console.log(udpLink.isOpen()); // true or false depending on the link state
   */
  get isOpen(): boolean {
    return this._isOpen
  }

  /**
   * Validate the URI for the UDP link
   * @param {URL} uri - The URI to validate
   * @throws {Error} If the URI is invalid
   * @description This method checks if the URI is in the correct format and throws an error if it is not.
   */
  _validateUri(uri: URL): void {
    if (!(uri.protocol === 'udpin:' || uri.protocol === 'udpout:' || uri.protocol === 'udpbcast:')) {
      throw new Error(`Invalid protocol: ${uri.protocol}. Supported protocols are udpin:, udpout:, and udpbcast:`)
    }

    const port = parseInt(uri.port)
    if (!port || port <= 0 || port > 65535) {
      throw new Error(`Invalid port: ${port}`)
    }
  }
}
