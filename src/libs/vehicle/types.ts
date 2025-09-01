import { Unit } from 'mathjs'

import type { Type } from '@/libs/connection/m2r/messages/mavlink2rest'
import { MavCmd, MavResult } from '@/libs/connection/m2r/messages/mavlink2rest-enum'
import { AlertLevel } from '@/types/alert'

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
   * @param {Partial<Coordinates>} init
   */
  public constructor(init?: Partial<Coordinates>) {
    Object.assign(this, init)
  }

  /**
   * Set position
   * @param {number} latitude
   * @param {number} longitude
   * @param {Precision} precision
   * @returns {Coordinates}
   */
  setPosition(latitude: number, longitude: number, precision?: Precision): Coordinates {
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
 * Command Acknowledgment
 */
export class CommandAck {
  command: Type<MavCmd>
  result: Type<MavResult>
  progress: number | undefined
  targetSystem: number
  targetComponent: number

  /**
   * Creates an instance of CommandAck.
   * @param {Partial<CommandAck>} [init]
   */
  constructor(init?: Partial<CommandAck>) {
    Object.assign(this, init)
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
   * @param {Partial<Attitude>} init
   */
  public constructor(init?: Partial<Attitude>) {
    Object.assign(this, init)
  }
}

/**
 * Altitude related data
 */
export class Altitude {
  msl: Unit // Mean Sea Level altitude
  rel: number // Relative altitude, in meters
  /**
   * Create object
   * @param {Partial<Altitude>} init
   */
  public constructor(init?: Partial<Altitude>) {
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
 * Parameter
 */
export class Parameter {
  value: number
  name: string
}

/**
 * Velocity related data
 */
export class Velocity {
  x: number // Ground X Speed in m/s	 (Latitude, positive north)
  y: number // Ground Y Speed in m/s	 (Longitude, positive east)
  z: number // Ground Z Speed in m/s	 (Altitude, positive down)
  ground: number // Combined X-Y Speed in m/s	 (positive north-east)
  overall: number // Combined X-Y-Z Speed in m/s	 (positive north-east-down)

  /**
   * Create object
   * @param {Partial<Velocity>} init
   */
  public constructor(init?: Partial<Velocity>) {
    Object.assign(this, init)
  }
}

/**
 * Status message
 */
export class StatusText {
  severity: AlertLevel
  text: string | undefined
}

/**
 * Possible fix types for GPS
 */
export enum FixTypeGPS {
  NO_GPS = 'No GPS',
  NO_FIX = 'No fix',
  FIX_2D = '2D fix',
  FIX_3D = '3D fix',
  DGPS = 'DGPS fix',
  RTK_FLOAT = 'RTK float',
  RTK_FIXED = 'RTK fix',
  STATIC = 'Static',
  PPP = 'PPP fix',
}

/**
 * GPS status
 */
export class StatusGPS {
  visibleSatellites = 0
  fixType = FixTypeGPS.NO_GPS
  HDOP: number
  VDOP: number
}

/**
 * Battery abstraction
 */
export class Battery {
  cells: number[] // List of cell voltage in volts
  voltage: number // In volts

  /**
   * Create object
   * @param {Partial<Battery>} init
   */
  public constructor(init?: Partial<Battery>) {
    Object.assign(this, init)
  }

  /**
   * Number of cells in the battery
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

/**
 * Base interface for settings package used to configure a vehicle
 */
export interface VehicleConfigurationSettings {}

/**
 * Battery chemistry types
 */
export type BatteryChemistry = 'li-ion' | 'li-po' | 'lifepo4'
