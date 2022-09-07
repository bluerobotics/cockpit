import type {
  MAVLinkMessageDictionary,
  Package,
} from '@/libs/connection/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/messages/mavlink2rest-message'
import { SignalTyped } from '@/libs/signal'
import { Attitude, Battery, Coordinates } from '@/libs/vehicle/types'

import * as Vehicle from '../vehicle'

/**
 * Generic ArduPilot vehicle
 */
export class ArduPilot extends Vehicle.Abstract {
  _attitude = new Attitude({ roll: 0, pitch: 0, yaw: 0 })
  _coordinates = new Coordinates({
    accuracy: 0,
    altitude: 0,
    altitudeAccuracy: 0,
    latitude: 0,
    longitude: 0,
  })

  _messages: MAVLinkMessageDictionary = new Map()

  onMAVLinkMessage = new SignalTyped()

  /**
   * Construct a new generic ArduPilot type
   *
   * @param {Vehicle.Type} type
   */
  constructor(type: Vehicle.Type) {
    super(Vehicle.Firmware.ArduPilot, type)
  }

  /**
   *  Decode incoming message
   *
   * @param {Uint8Array} message
   */
  onMessage(message: Uint8Array): void {
    const textDecoder = new TextDecoder()
    const mavlink_message = JSON.parse(textDecoder.decode(message)) as Package
    const { system_id } = mavlink_message.header

    if (system_id != 1) {
      return
    }

    // Update our internal messages
    this._messages.set(mavlink_message.message.type, mavlink_message.message)

    // TODO: Maybe create a signal class to deal with MAVLink only
    // Where add will use the template argument type to define the lambda argument type
    this.onMAVLinkMessage.emit_value(
      mavlink_message.message.type,
      mavlink_message
    )

    switch (mavlink_message.message.type) {
      case MAVLinkType.ATTITUDE: {
        const attitude = mavlink_message.message as Message.Attitude
        this._attitude.roll = attitude.roll
        this._attitude.pitch = attitude.pitch
        this._attitude.yaw = attitude.yaw
        this.onAttitude.emit()
        break
      }
      case MAVLinkType.GLOBAL_POSITION_INT: {
        const position = mavlink_message.message as Message.GlobalPositionInt
        this._coordinates.accuracy = 1
        this._coordinates.altitude = position.alt / 1000 // (mm to meters)
        this._coordinates.altitudeAccuracy = 1
        this._coordinates.latitude = position.lat / 1e7 // DegE7 to Deg
        this._coordinates.longitude = position.lon / 1e7 // DegE7 to Deg
        this.onPosition.emit()
        break
      }
      default:
        break
    }
  }

  /**
   * Arm vehicle
   *
   * @returns {boolean}
   */
  arm(): boolean {
    unimplemented()
    return true
  }

  /**
   * Return vehicle attitude
   *
   * @returns {Attitude}
   */
  attitude(): Attitude {
    return this._attitude
  }

  /**
   * Get batteries status
   *
   * @returns {Battery[]}
   */
  batteries(): Battery[] {
    return [new Battery({ cells: [0, 0, 0, 0, 0, 0], voltage: 0 })]
  }

  /**
   * Disarm vehicle
   *
   * @returns {boolean}
   */
  disarm(): boolean {
    unimplemented()
    return true
  }

  /**
   * Check if vehicle is armed
   *
   * @returns {boolean}
   */
  isArmed(): boolean {
    unimplemented()
    return true
  }

  /**
   * Return vehicle position information
   *
   * @returns {Coordinates}
   */
  position(): Coordinates {
    return this._coordinates
  }
}
