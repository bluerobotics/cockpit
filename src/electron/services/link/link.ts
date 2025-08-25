import { EventEmitter } from 'events'

/**
 * Link class
 * @module Link
 * @description This class is used to manage the link between the Electron app and the backend service.
 * It provides methods to initialize, connect, and disconnect the link.
 */
export abstract class Link extends EventEmitter {
  private _uri: URL
  abstract get isOpen(): boolean

  /**
   * Link Constructor
   * @param {URL} uri - The URI of the link
   * @description The URI should be in the format: protocol://path?query
   * For example: serial:///dev/ttyUSB0?baudRate=115200
   * @throws {Error} If the URI is invalid or the protocol is not supported
   * @example
   * const link = new Link(new URL('serial:///dev/ttyUSB0?baudRate=115200'))
   * @abstract
   * @class
   */
  constructor(uri: URL) {
    super()
    this._uri = uri
  }

  /**
   * Return the connection uri
   * @returns {URL}
   */
  uri(): URL {
    return this._uri
  }

  /**
   * Disconnect the link
   * @returns {Promise<void>}
   */
  abstract close(): Promise<void>

  /**
   * Connect the link
   * @returns {Promise<void>}
   */
  abstract open(): Promise<void>

  /**
   * Write data to the link
   * @param {Uint8Array} data - The data to write to the link
   * @returns {Promise<void>}
   * @description This method should send data over the link.
   * It should handle the data format and ensure it is sent to the correct destination.
   * @throws {Error} If the method is not implemented
   * @abstract
   */
  abstract write(data: Uint8Array): Promise<void>
}
