/**
 * Provide coordinates related information
 */
export class Coordinates {
  accuracy: number // Should be between 0 and 1
  altitude: number // Should be in meters
  altitudeAccuracy: number // Should be between 0 and 1
  latitude: number // Should be in de decimal degrees. E.g: -27.593500
  longitude: number // Should be in de decimal degrees. E.g: -48.558540

  /**
   * Create object
   *
   * @param {Partial<Coordinates>} init
   */
  public constructor(init?: Partial<Coordinates>) {
    Object.assign(this, init)
  }

  /**
   *
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} accuracy
   * @returns {Coordinates}
   */
  setPosition(
    latitude: number,
    longitude: number,
    accuracy?: number
  ): Coordinates {
    this.latitude = latitude
    this.longitude = longitude

    if (accuracy !== undefined) {
      if (accuracy < 0 || accuracy > 1) {
        console.error(`accuracy outside of valid range: ${accuracy}`)
        return this
      }
      this.accuracy = accuracy
    }

    return this
  }

  /**
   * Set altitude information
   *
   * @param  {number?} altitude
   * @param  {number?} altitudeAccuracy
   * @returns {Coordinates}
   */
  setAltitude(altitude?: number, altitudeAccuracy?: number): Coordinates {
    if (altitude !== undefined) {
      this.altitude = altitude
    }

    if (altitudeAccuracy !== undefined) {
      if (altitudeAccuracy < 0 || altitudeAccuracy > 1) {
        console.error(
          `altitudeAccuracy outside of valid range: ${altitudeAccuracy}`
        )
        return this
      }
      this.altitudeAccuracy = altitudeAccuracy
    }

    return this
  }
}

/**
 * Body frame attitude
 */
export class Attitude {
  roll: number
  pitch: number
  yaw: number

  /**
   * Create object
   *
   * @param {Partial<Attitude>} init
   */
  public constructor(init?: Partial<Attitude>) {
    Object.assign(this, init)
  }
}

/**
 * Battery abstraction
 */
export class Battery {
  cells: number[] // List of cell voltage in volts
  voltage: number // In volts

  /**
   * Create object
   *
   * @param {Partial<Attitude>} init
   */
  public constructor(init?: Partial<Battery>) {
    Object.assign(this, init)
  }

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
