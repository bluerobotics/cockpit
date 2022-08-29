import * as Vehicle from '../vehicle'
import { ArduPilot } from './ardupilot'

/**
 * ArduRover vehicle
 */
export class ArduRover extends ArduPilot {
  /**
   * Create ArduRover vehicle
   */
  constructor() {
    super(Vehicle.Type.Rover)
  }
}
