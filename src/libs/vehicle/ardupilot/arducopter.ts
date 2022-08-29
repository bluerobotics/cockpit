import * as Vehicle from '../vehicle'
import { ArduPilot } from './ardupilot'

/**
 * ArduCopter vehicle
 */
export class ArduCopter extends ArduPilot {
  /**
   * Create ArduCopter vehicle
   */
  constructor() {
    super(Vehicle.Type.Copter)
  }
}
