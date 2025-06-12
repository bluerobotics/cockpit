import { Signal } from '@/libs/signal'
import * as Protocol from '@/libs/vehicle/protocol/protocol'

import * as Connection from './connection'
import { SerialConnection } from './serial-connection'
import { WebSocketConnection } from './websocket-connection'

/**
 * Manager to handle multiple connections
 */
export class ConnectionManager {
  private static _connections: Connection.Abstract[] = []
  private static _mainConnection: WeakRef<Connection.Abstract> | undefined = undefined

  // Signals
  static onMainConnection = new Signal<WeakRef<Connection.Abstract>>()
  static onRead = new Signal<Uint8Array>()
  static onWrite = new Signal<Uint8Array>()

  /**
   * Return the connections available
   * @returns {Connection.Abstract[]}
   */
  static connections(): Connection.Abstract[] {
    console.warn('This function should not be used, only a single connection is supported for now')
    return ConnectionManager._connections
  }

  /**
   * Add a specific connection
   * @param  {Connection.URI} uri
   * @param  {Protocol.Type} vehicleProtocol
   */
  static addConnection(uri: Connection.URI, vehicleProtocol: Protocol.Type): void {
    let connection = undefined
    switch (uri.type()) {
      case Connection.Type.WebSocket:
        connection = new WebSocketConnection(uri, vehicleProtocol)
        break
      case Connection.Type.Serial:
        connection = new SerialConnection(uri, vehicleProtocol)
        connection.initialize()
        break

      default:
        unimplemented(`connection type not supported: ${uri.type()}`)
        return
    }

    ConnectionManager._addConnection(connection)
  }

  /**
   * Add a connection on connection manager
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
   * @returns {void}
   */
  private static _updateMainConnection(): void {
    const connection = ConnectionManager._connections.last() ?? undefined
    const previousConnection = ConnectionManager._mainConnection?.deref()
    if (connection === undefined || connection === previousConnection) {
      return
    }

    previousConnection?.onRead?.clear()
    previousConnection?.onWrite?.clear()
    connection.onRead.add((data: Uint8Array) => this.onRead.emit_value(data))
    connection.onWrite.add((data: Uint8Array) => this.onWrite.emit_value(data))
    ConnectionManager._mainConnection = new WeakRef(connection)
    // There is no constructor and updating the register is not expensive in this function
    ConnectionManager.onMainConnection.register_caller(
      // @ts-ignore: `_mainConnection is not undefined since we set it on previous line`
      (): Connection.Abstract => ConnectionManager._mainConnection
    )
    ConnectionManager.onMainConnection.emit()
  }

  /**
   * Return the main connection used as data source
   * @returns {Connection.Abstract}
   */
  static mainConnection(): Connection.Abstract | undefined {
    // Be sure that we have a valid connection
    ConnectionManager._updateMainConnection()
    return ConnectionManager._mainConnection?.deref()
  }

  /**
   * Write data to main connection
   * @param  {Uint8Array} data
   * @returns {boolean}
   */
  static write(data: Uint8Array): boolean {
    ConnectionManager.mainConnection()?.write(data)
    ConnectionManager.onWrite.emit_value(data)
    return true
  }
}
