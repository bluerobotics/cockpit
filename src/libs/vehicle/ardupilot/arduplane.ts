import * as Vehicle from '../vehicle'
import { ArduPilot } from './ardupilot'

/**
 * ArduPlane vehicle
 */
export class ArduPlane extends ArduPilot {
  /**
   * Create ArduPlane vehicle
   */
  constructor() {
    super(Vehicle.Type.Plane)
  }
}
