import { v4 as uuid4 } from 'uuid'

import * as FunnyName from '@/libs/funny-name/funny-name'
import { Signal } from '@/libs/signal'
import type {
  Altitude,
  Attitude,
  Battery,
  CommandAck,
  Coordinates,
  PageDescription,
  Parameter,
  PowerSupply,
  StatusGPS,
  StatusText,
  Velocity,
} from '@/libs/vehicle/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Abstract = AbstractVehicle<any>

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
 * Vehicle abstraction
 */
export abstract class AbstractVehicle<Modes> {
  // Information used to identify vehicle on frontend and specialized functionalities
  _firmware: Firmware
  _type: Type

  // Unique identification number and name to check between vehicles
  _cockpitRegistrationUUID: string
  _funnyName: string

  // Signals
  onArm = new Signal<boolean>()
  onAttitude = new Signal<Attitude>()
  onAltitude = new Signal<Altitude>()
  onBatteries = new Signal<Battery[]>()
  onCpuLoad = new Signal<number>()
  onCommandAck = new Signal<CommandAck>()
  onMode = new Signal<Modes>()
  onPosition = new Signal<Coordinates>()
  onPowerSupply = new Signal<PowerSupply>()
  onParameter = new Signal<[Parameter, number | undefined]>()
  onStatusGPS = new Signal<StatusGPS>()
  onStatusText = new Signal<StatusText>()
  onTakeoff = new Signal<boolean>()
  onVelocity = new Signal<Velocity>()

  /**
   * Constructor for the abstract vehicle type
   * @param {Firmware} firmware
   * @param {Type} type
   */
  constructor(firmware: Firmware, type: Type) {
    this._firmware = firmware
    this._type = type

    unimplemented('We need to have a better way to generate a unique id based on the vehicle hardware')
    this._cockpitRegistrationUUID = uuid4()
    this._funnyName = FunnyName.generate(toFunnyNameType(type))

    console.info(
      `Creating a new Vehicle:\n`,
      `\tname: ${this._funnyName}\n`,
      `\tidentification: ${this._cockpitRegistrationUUID}\n`,
      `\ttype: ${this._type}\n`,
      `\tfirmware: ${this._firmware}\n`
    )

    this.onArm.register_caller(() => this.isArmed())
    this.onAltitude.register_caller(() => this.altitude())
    this.onAttitude.register_caller(() => this.attitude())
    this.onBatteries.register_caller(() => this.batteries())
    this.onCpuLoad.register_caller(() => this.cpuLoad())
    this.onMode.register_caller(() => this.mode())
    this.onPosition.register_caller(() => this.position())
    this.onPowerSupply.register_caller(() => this.powerSupply())
    this.onParameter.register_caller(() => [this.lastParameter(), this.totalParametersCount()])
    this.onStatusText.register_caller(() => this.statusText())
    this.onStatusGPS.register_caller(() => this.statusGPS())
    this.onTakeoff.register_caller(() => this.flying())
    this.onVelocity.register_caller(() => this.velocity())
  }

  /**
   * Return the firmware type of the vehicle
   * @returns {Firmware}
   */
  firmware(): Firmware {
    return this._firmware
  }

  /**
   * Return the vehicle type
   * @returns {Type}
   */
  type(): Type {
    return this._type
  }

  /**
   * Return the icon based on the vehicle type
   * @returns {string}
   */
  icon(): string {
    switch (this.type()) {
      case Type.Antenna:
        return 'mdi-satellite-uplink'
      case Type.Blimp:
        return 'mdi-airballoon'
      case Type.Copter:
        return 'mdi-quadcopter'
      case Type.Plane:
        return 'mdi-airplane'
      case Type.Rover:
        return 'mdi-car-wireless'
      case Type.Sub:
        return 'mdi-submarine'
    }
  }

  abstract onIncomingMessage(message: Uint8Array): void
  abstract onOutgoingMessage(message: Uint8Array): void

  abstract arm(): Promise<void>
  abstract dateLastHeartbeat(): Date | undefined
  abstract altitude(): Altitude
  abstract attitude(): Attitude
  abstract batteries(): Battery[]
  abstract configurationPages(): PageDescription[]
  abstract cpuLoad(): number // Percentage
  abstract disarm(): Promise<void>
  abstract isArmed(): boolean
  abstract mode(): Modes
  abstract modesAvailable(): Map<string, Modes>
  abstract position(): Coordinates
  abstract velocity(): Velocity
  abstract powerSupply(): PowerSupply
  abstract totalParametersCount(): number | undefined
  abstract lastParameter(): Parameter
  abstract statusText(): StatusText
  abstract statusGPS(): StatusGPS
  abstract setMode(mode: Modes): Promise<void>
  abstract flying(): boolean
}
