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
}
