/**
 * Dilution of precision
 */
export interface DOP {
  /**
   * Horizontal dilution of precision
   */
  HDOP?: number
  /**
   * Vertical dilution of precision
   */
  VDOP?: number
  /**
   * Position (3D) dilution of precision
   */
  PDOP?: number
  /**
   * Time dilution of precision
   */
  TDOP?: number
  /**
   * Geometric dilution of precision
   */
  GDOP?: number
}

/**
 * 3D precision percentage for each axis
 */
export interface V3Precision {
  /**
   * X precision between 0-1
   */
  x: number
  /**
   * Y precision between 0-1
   */
  y: number
  /**
   * Z precision between 0-1
   */
  z: number
}

type Precision = number | DOP | V3Precision

/**
 * Provide coordinates related information
 */
export class Coordinates {
  precision: Precision // Percentage between 0 and 1, DOP or 3 axis precision
  dop?: DOP // Dilution of precision
  altitude: number // Should be in meters
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
   * Set position
   *
   * @param {number} latitude
   * @param {number} longitude
   * @param {Precision} precision
   * @returns {Coordinates}
   */
  setPosition(
    latitude: number,
    longitude: number,
    precision?: Precision
  ): Coordinates {
    this.latitude = latitude
    this.longitude = longitude

    if (precision !== undefined) {
      if (typeof precision === 'number' && (precision < 0 || precision > 1)) {
        console.error(`Can't deal with this type of precision: ${precision}`)
        return this
      }
      this.precision = precision
    }

    return this
  }

  /**
   * Set altitude information
   *
   * @param  {number?} altitude
   * @returns {Coordinates}
   */
  setAltitude(altitude?: number): Coordinates {
    if (altitude !== undefined) {
      this.altitude = altitude
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
 * PowerSupply
 */
export class PowerSupply {
  voltage: number | undefined // in Volts
  current: number | undefined // in Amps
  remaining: number | undefined // Percentage available
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

/**
 * Description for vehicle configuration page
 */
export interface PageDescription {
  /**
   * Page title
   */
  title: string

  /**
   * Icon
   */
  icon: string

  /**
   * Component
   */
  component: any // eslint-disable-line @typescript-eslint/no-explicit-any
}
