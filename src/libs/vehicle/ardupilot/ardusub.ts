import { Attitude, Battery, Coordinates } from '@/libs/vehicle/types'

import * as Vehicle from '../vehicle'

/**
 *
 */
export class ArduPilotSub extends Vehicle.Abstract {
  /**
   *
   */
  constructor() {
    super(Vehicle.Firmware.ArduPilot, Vehicle.Type.Sub)
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
    return new Attitude({ roll: 0, pitch: 0, yaw: 0 })
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
    return new Coordinates({
      accuracy: 1,
      altitude: 4.2,
      altitudeAccuracy: 1,
      latitude: -27,
      longitude: -48,
    })
  }
}
