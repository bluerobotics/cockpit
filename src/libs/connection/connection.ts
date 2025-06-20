import '@/libs/cosmos'

import { Signal } from '@/libs/signal'
import * as Protocol from '@/libs/vehicle/protocol/protocol'

// TODO: Find a way to generate this strings automatically, maybe decorators ?
/**
 * Possible connection types
 */
export enum Type {
  Http = 'http',
  WebSocket = 'ws',
  Serial = 'serial',
  None = 'none',
}

// Necessary to add functions
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Type {
  /**
   * Return a connection type from a uri protocol
   * @param  {string} protocol
   * @returns {Type}
   */
  export function fromProtocol(protocol: string): Type {
    const result = Object.values(Type)
      .filter((item) => protocol.startsWith(item as string))
      .first()
    /* c8 ignore start */
    if (typeof result === 'function') {
      return Type.None
    }
    /* c8 ignore end */
    return result ?? Type.None
  }
}

/**
 *  Abstraction over URL component
 */
export class URI extends URL {
  /**
   * Check if protocol is secure
   * @returns {boolean}
   */
  isSecure(): boolean {
    return ![Type.Http + 's:', Type.WebSocket + 's:', Type.Serial]
      .filter((item) => this.protocol.startsWith(item))
      .isEmpty()
  }
  /**
   * Return connection type from URL string
   * @returns {Type}
   */
  type(): Type {
    return Type.fromProtocol(this.protocol)
  }
  /**
   * Return the entries of the URL search params
   * @returns {Map<string, string>}
   */
  entries(): Map<string, string> {
    return new Map(new URLSearchParams(this.search).entries())
  }
}

/* c8 ignore start */
/**
 * Abstract class for connections
 */
export abstract class Abstract {
  private _uri: URI
  private _protocolType: Protocol.Type

  // Signals
  public onRead = new Signal<Uint8Array>()
  public onWrite = new Signal<Uint8Array>()

  /**
   * Return the connection uri
   * @returns {URI}
   */
  uri(): URI {
    return this._uri
  }

  /**
   * Abstract class constructor
   * @param {URI} uri
   * @param {Protocol.Type} vehicleProtocol
   */
  constructor(uri: URI, vehicleProtocol: Protocol.Type) {
    this._uri = uri
    this._protocolType = vehicleProtocol
  }

  /**
   * Return vehicle communication protocol
   * @returns {Protocol.Type}
   */
  protocolType(): Protocol.Type {
    return this._protocolType
  }

  abstract connect(): boolean
  abstract disconnect(): boolean
  abstract isConnected(): boolean

  abstract write(data: Uint8Array): boolean
}
/* c8 ignore stop */
