import * as Vehicle from '../vehicle'
import { ArduPilot } from './ardupilot'

/**
 * ArduSub vehicle
 */
export class ArduSub extends ArduPilot {
  /**
   * Create ArduSub vehicle
   */
  constructor() {
    super(Vehicle.Type.Sub)
  }
}
