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
