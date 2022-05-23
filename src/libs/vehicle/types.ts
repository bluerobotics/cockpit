/**
 * Provide coordinates related information
 */
export class Coordinates {
  accuracy: number // Should be between 0 and 1
  altitude: number // Should be in meters
  altitudeAccuracy: number // Should be between 0 and 1
  latitude: number // Should be in de decimal degrees. E.g: -27.593500
  longitude: number // Should be in de decimal degrees. E.g: -48.558540
}

/**
 * Body frame attitude
 */
export class Attitude {
  roll: number
  pitch: number
  yaw: number
}

/**
 * Battery abstraction
 */
export class Battery {
  cells: number[] // List of cell voltage in volts
  voltage: number // In volts

  /**
   * Number of cells in the battery
   *
   * @returns {number}
   */
  numberOfCells(): number {
    return this.cells.length
  }

  /**
   * Update total voltage from cells voltage,
   * can be used when the total voltage is not available
   */
  updateVoltage(): void {
    this.voltage = this.cells.sum()
  }
}
