import * as FunnyName from 'lib/funny-name/funny-name'
import { Attitude, Battery, Coordinates } from 'types/vehicle'

/**
 * Define possible firmwares used by the vehicle
 */
export enum Firmware {
  ArduPilot = 'ardupilot',
  PX4 = 'px4',
  None = 'none',
}

/**
 * Define vehicle type
 */
export enum Type {
  Antenna = 'antenna',
  Blimp = 'blimp',
  Copter = 'copter',
  Plane = 'plane',
  Rover = 'rover',
  Sub = 'sub',
}

/**
 * Create funny name based on the vehicle type
 *
 * @param {Type} type
 * @returns {FunnyName.Type}
 */
function toFunnyNameType(type: Type): FunnyName.Type {
  switch (type) {
    case Type.Sub:
      return FunnyName.Type.Water
    default:
      return FunnyName.Type.None
  }
}

/**
 *
 */
export abstract class Abstract {
  // Information used to identify vehicle on frontend and specialized functionalities
  _firmware: Firmware
  _type: Type

  // Unique identification number and name to check between vehicles
  _cockpitRegistrationNumber: number
  _funnyName: string

  /**
   * Constructor for the abstract vehicle type
   *
   * @param {Firmware} firmware
   * @param {Type} type
   */
  constructor(firmware: Firmware, type: Type) {
    this._firmware = firmware
    this._type = type

    unimplemented('We need to have a better way to generate a unique id')
    this._cockpitRegistrationNumber = Math.random() * Number.MAX_SAFE_INTEGER
    this._funnyName = toFunnyNameType(type)
  }

  /**
   * Return the firmware type of the vehicle
   *
   * @returns {Type}
   */
  firmware(): Type {
    return this._type
  }

  /**
   * Return the vehicle type
   *
   * @returns {Type}
   */
  type(): Type {
    return this._type
  }

  abstract arm(): boolean
  abstract attitude(): Attitude
  abstract batteries(): Battery[]
  abstract disarm(): boolean
  abstract isArmed(): boolean
  abstract position(): Coordinates
}
