/**
 * Interface for serial data
 */
export interface SerialData {
  /**
   * The path of the serial port
   */
  path: string
  /**
   * The data received from the serial port
   */
  data: number[]
}

/**
 * Information about an available serial port, as reported by the OS.
 */
export interface SerialPortInfo {
  /**
   * The system path of the port (e.g. /dev/ttyUSB0 or COM3)
   */
  path: string
  /**
   * The manufacturer of the device, when available
   */
  manufacturer?: string
  /**
   * The device serial number, when available
   */
  serialNumber?: string
  /**
   * The USB vendor id, when available
   */
  vendorId?: string
  /**
   * The USB product id, when available
   */
  productId?: string
}
