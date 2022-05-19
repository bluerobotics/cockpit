import '@/libs/cosmos'

import * as Vehicle from '@/libs/vehicle/protocol/protocol'

//TODO: Find a way to generate this strings automatically, maybe decorators ?
/**
 * Possible connection types
 */
export enum Type {
  Http = 'http',
  WebSocket = 'ws',
  None = 'none',
}

// Necessary to add functions
//eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Type {
  /**
   * Return a connection type from a scheme protocol
   *
   * @param  {string} protocol
   * @returns {Type}
   */
  export function fromProtocol(protocol: string): Type {
    return (
      Object.values(Type)
        .filter((item) => protocol.startsWith(item as string))
        .first() ?? Type.None
    )
  }
}

/**
 *  Abstraction over URL component
 */
export class Scheme extends URL {
  /**
   * Check if protocol is secure
   *
   * @returns {boolean}
   */
  isSecure(): boolean {
    return ![Type.Http + 's:', Type.WebSocket + 's:']
      .filter((item) => this.protocol.startsWith(item))
      .isEmpty()
  }
  /**
   * Return connection type from URL string
   *
   * @returns {Type}
   */
  type(): Type {
    return Type.fromProtocol(this.protocol)
  }
}

/* c8 ignore start */
/**
 * Abstract class for connections
 */
export abstract class Abstract {
  private _scheme: Scheme
  private _protocolType: Vehicle.ProtocolType

  /**
   * Return the connection scheme
   *
   * @returns {Scheme}
   */
  scheme(): Scheme {
    return this._scheme
  }

  /**
   * Abstract class constructor
   *
   * @param {Scheme} scheme
   * @param {Vehicle.ProtocolType} vehicleProtocol
   */
  constructor(scheme: Scheme, vehicleProtocol: Vehicle.ProtocolType) {
    this._scheme = scheme
    this._protocolType = vehicleProtocol
  }

  /**
   * Return vehicle communication protocol
   *
   * @returns {Vehicle}
   */
  protocolType(): Vehicle.ProtocolType {
    return this._protocolType
  }

  abstract connect(): boolean
  abstract isConnected(): boolean
  abstract disconnect(): boolean

  abstract write(data: Uint8Array): boolean
  abstract onRead(callback: (data: Uint8Array) => void): void
}
/* c8 ignore stop */
