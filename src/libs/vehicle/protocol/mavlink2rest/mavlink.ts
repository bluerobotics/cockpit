import * as Protocol from '../protocol'

/**
 * Abstraction over MAVLink2Rest tool
 * From: https://github.com/patrickelectric/mavlink2rest
 */
export class MAVLink2Rest extends Protocol.Abstract {
  /**
   * Return the protocol type used
   *
   * @returns {Protocol}
   */
  type(): Protocol.ProtocolType {
    return Protocol.ProtocolType.MAVLink2Rest
  }

  /**
   * Write data over the protocol
   *
   * @param {Uint8Array} data
   * @returns {Protocol}
   */
  write(data: Uint8Array): boolean {
    unused(data)
    unimplemented()
    return true
  }

  /**
   * Set callback used for communication
   *
   * @param {(data: Uint8Array) => void} callback
   */
  onRead(callback: (data: Uint8Array) => void): void {
    unused(callback)
    unimplemented()
  }
}
