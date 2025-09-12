import type { MetadataFile } from '@/types/ardupilot-metadata'

import * as MAVLinkVehicle from '../mavlink/vehicle'
import * as Vehicle from '../vehicle'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArduPilot = ArduPilotVehicle<any>

/**
 * Generic ArduPilot vehicle
 */
export abstract class ArduPilotVehicle<Modes> extends MAVLinkVehicle.MAVLinkVehicle<Modes> {
  _metadata: MetadataFile

  /**
   * Construct a new generic ArduPilot type
   * @param {Vehicle.Type} type
   * @param {number} systemId
   */
  constructor(type: Vehicle.Type, systemId: number) {
    super(Vehicle.Firmware.ArduPilot, type, systemId)
  }

  /**
   * Return metadata from the vehicle
   * @returns {MetadataFile}
   */
  metadata(): MetadataFile {
    return this._metadata
  }
}
