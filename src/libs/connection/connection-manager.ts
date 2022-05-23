import * as Vehicle from '@/libs/vehicle/protocol/protocol'

import * as Connection from './connection'
import { WebSocketConnection } from './websocket-connection'

/**
 * Manager to handle multiple connections
 */
export class ConnectionManager {
  private static _self: ConnectionManager
  private static _connections: Connection.Abstract[] = []

  /**
   * Return the connections available
   *
   * @returns {Connection.Abstract[]}
   */
  static connections(): Connection.Abstract[] {
    return ConnectionManager._connections
  }

  /**
   * Add a specific connection
   *
   * @param  {Connection.Scheme} scheme
   * @param  {Vehicle.ProtocolType} vehicleProtocol
   */
  static addConnection(
    scheme: Connection.Scheme,
    vehicleProtocol: Vehicle.ProtocolType
  ): void {
    switch (scheme.type()) {
      case Connection.Type.WebSocket:
        ConnectionManager._connections.push(
          new WebSocketConnection(scheme, vehicleProtocol)
        )
        break
      default:
        unimplemented(`connection type not supported: ${scheme.type()}`)
    }
  }
}
