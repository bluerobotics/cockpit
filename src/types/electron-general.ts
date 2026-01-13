/**
 * Interface for the electron log
 */
export interface ElectronLog {
  /**
   * The size of the log file in bytes
   */
  size: number
  /**
   * The path to the log file
   */
  path: string
  /**
   * The initial time when logging started
   */
  initialTime: string
  /**
   * The initial date when logging started
   */
  initialDate: string
}
