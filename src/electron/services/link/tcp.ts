import { createConnection, createServer, Socket } from 'net'

import { Link } from './link'

/**
 * TCP Link Service
 * @module TcpLink
 * @description This class is used to manage TCP links in the Electron app.
 * It extends the Link class and provides methods to connect, disconnect, open, and close the TCP link.
 * It also includes properties for the protocol, host, port, and whether it is a server link.
 * The URI should be in the format: [tcpin|tcpout]:host:port
 * For example: tcpin:localhost:12345
 * @throws {Error} If the URI is invalid or the protocol is not supported
 */
export class TcpLink extends Link {
  private _isOpen = false
  protocol: string
  host: string
  port: number
  isServer: boolean
  socket?: Socket

  /**
   * TCP Link Constructor
   * @param {URL} uri - The URI of the TCP link
   * @throws {Error} If the URI is invalid or the protocol is not supported
   * @description The URI should be in the format: [tcpin|tcpout]://host:port
   * For example: tcpin://localhost:12345
   */
  constructor(uri: URL) {
    super(uri)
    this.protocol = uri.protocol.replace(':', '')
    this.host = uri.hostname
    this.port = parseInt(uri.port)
    this.isServer = uri.protocol === 'tcpin:'

    if (isNaN(this.port) || this.port <= 0 || this.port > 65535) {
      throw new Error(`Invalid port: ${uri.port}`)
    }
    if (!this.host) {
      throw new Error(`Invalid host: ${uri.hostname}`)
    }
    if (!(this.protocol === 'tcpin' || this.protocol === 'tcpout')) {
      throw new Error(`Invalid protocol: ${this.protocol}`)
    }
  }

  /**
   * Open the TCP link
   * @returns {Promise<void>}
   * @description This method should create a TCP socket and connect it to the specified host and port.
   * If the link is a server, it should listen for incoming connections.
   * If the link is a client, it should connect to the server at the specified host and port.
   * @throws {Error} If the connection fails
   * @example
   * const tcpLink = new TcpLink(new URL('tcpin://localhost:12345'))
   * await tcpLink.open()
   */
  open(): Promise<void> {
    console.log(`Opening TCP link at ${this.host}:${this.port} as ${this.isServer ? 'server' : 'client'}`)

    return new Promise((resolve) => {
      if (this.isOpen) {
        console.warn(`TCP link at ${this.host}:${this.port} is already open`)
        resolve()
        return
      }

      if (this.isServer) {
        const server = createServer((socket) => {
          console.log(`New TCP connection from ${socket.remoteAddress}:${socket.remotePort}`)
          this._setupSocketHandlers(socket)
          this.socket = socket
          this._isOpen = true
        })

        server.listen(this.port, this.host, () => {
          console.log(`TCP server listening on ${this.host}:${this.port}`)
          this._isOpen = true
          resolve()
        })
      } else {
        this.socket = createConnection({ host: this.host, port: this.port }, () => {
          console.log(`Connected to TCP server at ${this.host}:${this.port}`)
          this._isOpen = true
          resolve()
        })
        this._setupSocketHandlers(this.socket)
      }
    })
  }

  /**
   * Close the TCP link
   * @returns {Promise<void>}
   * @description This method should close the TCP socket and clean up any resources.
   * If the link is a server, it should stop listening for incoming connections.
   * If the link is a client, it should disconnect from the server.
   * @throws {Error} If the disconnection fails
   * @example
   * const tcpLink = new TcpLink(new URL('tcpout://localhost:12345'))
   * await tcpLink.close()
   */
  async close(): Promise<void> {
    console.log(`Closing TCP link at ${this.host}:${this.port}`)
    return new Promise((resolve, reject) => {
      if (this.socket) {
        this.socket.removeAllListeners()
        this.socket.once('error', reject)
        this.socket.end(() => {
          this.socket?.off('error', reject)
          this._isOpen = false
          console.log(`TCP link closed at ${this.host}:${this.port}`)
          resolve()
        })
      } else {
        console.warn('No TCP socket to close')
        this._isOpen = false
        resolve()
      }
    })
  }

  /**
   * Write data to the TCP link
   * @param {Uint8Array} data - The data to write to the TCP link
   * @returns {Promise<void>}
   * @description This method should send data over the TCP link.
   * It should handle the data format and ensure it is sent to the correct host and port.
   * @example
   */
  async write(data: Uint8Array): Promise<void> {
    this.socket?.write(data, (err) => {
      if (err) {
        console.error(`Error sending data: ${err.message}`)
      } else {
        console.log(`Data sent successfully to ${this.host}:${this.port}`)
      }
    })
  }

  /**
   * Check if the TCP link is open
   * @returns {boolean}
   * @description This method should return true if the TCP link is open, false otherwise.
   * @example
   * const tcpLink = new TcpLink(new URL('tcpin://localhost:12345'));
   * console.log(tcpLink.isOpen()); // true or false depending on the link state
   */
  get isOpen(): boolean {
    return this._isOpen
  }

  /**
   * Setup socket handlers
   * @param {Socket} socket - The TCP socket to setup handlers for
   */
  _setupSocketHandlers(socket: Socket): void {
    socket.on('data', (data: Buffer) => this.emit('data', data))

    socket.on('error', (err) => {
      console.error(`Socket error: ${err.message}`)
      this.close()
    })

    socket.on('close', () => {
      console.warn(`Socket closed for ${this.host}:${this.port}`)
      this._isOpen = false
      this.emit('close')
    })
  }
}
