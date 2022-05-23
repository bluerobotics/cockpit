import * as Vehicle from '@/libs/vehicle/protocol/protocol'

import * as Connection from './connection'
import { WebSocketConnection } from './websocket-connection'

/**
 * Manager to handle multiple connections
 */
export class ConnectionManager {
  private static _self: ConnectionManager
  private static _connections: Connection.Abstract[] = []
  private static _mainConnection: WeakRef<Connection.Abstract> = undefined

  /**
   * Return the connections available
   *
   * @returns {Connection.Abstract[]}
   */
  static connections(): Connection.Abstract[] {
    console.warn(
      'This function should not be used, only a single connection is supported for now'
    )
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
    let connection = undefined
    switch (scheme.type()) {
      case Connection.Type.WebSocket:
        connection = new WebSocketConnection(scheme, vehicleProtocol)
        break

      default:
        unimplemented(`connection type not supported: ${scheme.type()}`)
        return
    }

    ConnectionManager._addConnection(connection)
  }

  /**
   * Add a connection on connection manager
   *
   * @param  {Connection.Abstract} connection
   */
  private static _addConnection(connection: Connection.Abstract): void {
    ConnectionManager._connections.push(connection)
    unimplemented(
      'Needs to handle multiple connections and change the main connection when necessary.' +
        'This can be done by checking the data coming from the connection and changing after a timeout.'
    )
    ConnectionManager._updateMainConnection()
  }

  /**
   * Update the main connection if necessary
   *
   * @returns {void}
   */
  private static _updateMainConnection(): void {
    const connection = ConnectionManager._connections.last() ?? undefined
    if (connection === undefined) {
      return
    }

    const previousConnection = ConnectionManager._mainConnection?.deref()
    previousConnection?.onRead(undefined)
    ConnectionManager._mainConnection = new WeakRef(connection)
  }

  /**
   * Return the main connection used as data source
   *
   * @returns {Connection.Abstract}
   */
  static mainConnection(): Connection.Abstract | undefined {
    // Be sure that we have a valid connection
    ConnectionManager._updateMainConnection()
    return this._mainConnection.deref()
  }

  /**
   * Write data to main connection
   *
   * @param  {Uint8Array} data
   * @returns {boolean}
   */
  static write(data: Uint8Array): boolean {
    ConnectionManager.mainConnection()?.write(data)
    return true
  }

  /**
   * Register callback to receive data from main connection
   *
   * @param  {(data:Uint8Array)=>void} callback
   * @returns {void}
   */
  static onRead(callback: (data: Uint8Array) => void): void {
    ConnectionManager.mainConnection()?.onRead(callback)
  }
}
