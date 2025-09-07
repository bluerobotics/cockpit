import * as Vehicle from '../vehicle'

/**
 * Generic MAVLink vehicle
 */
export abstract class MAVLinkVehicle<Modes> extends Vehicle.AbstractVehicle<Modes> {}
