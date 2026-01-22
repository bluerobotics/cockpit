import type { MetadataFile } from '@/types/ardupilot-metadata'

import * as MAVLinkVehicle from '../mavlink/vehicle'
import * as Vehicle from '../vehicle'
import { registerModeActions } from './common'

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
   * @param {object} modeEnum - The CustomMode enum for this vehicle type
   */
  constructor(type: Vehicle.Type, systemId: number, modeEnum: Record<string, string | number>) {
    super(Vehicle.Firmware.ArduPilot, type, systemId)
    registerModeActions(type, modeEnum, this)
  }

  /**
   * Return metadata from the vehicle
   * @returns {MetadataFile}
   */
  metadata(): MetadataFile {
    return this._metadata
  }
}
