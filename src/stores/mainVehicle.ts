import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { mavlink2restServerUrl } from '@/assets/defaults'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Package } from '@/libs/connection/messages/mavlink2rest'
import {
  MavAutopilot,
  MAVLinkType,
  MavType,
} from '@/libs/connection/messages/mavlink2rest-enum'
import type { Message } from '@/libs/connection/messages/mavlink2rest-message'
import type { ArduPilot } from '@/libs/vehicle/ardupilot/ardupilot'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import type { Attitude, Coordinates } from '@/libs/vehicle/types'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { VehicleFactory } from '@/libs/vehicle/vehicle-factory'

export const useMainVehicleStore = defineStore('main-vehicle', () => {
  const lastHeartbeat = ref<Date>()
  const firmwareType = ref<MavAutopilot>()
  const vehicleType = ref<MavType>()
  const attitude: Attitude = reactive({} as Attitude)
  const coordinates: Coordinates = reactive({} as Coordinates)

  /**
   * Check if vehicle is online (no more than 5 seconds passed since last heartbeat)
   *
   * @returns { boolean } True if vehicle is online
   */
  function isVehicleOnline(): boolean {
    return (
      lastHeartbeat.value !== undefined &&
      new Date().getTime() - lastHeartbeat.value.getTime() < 5000
    )
  }

  ConnectionManager.addConnection(
    new Connection.URI(mavlink2restServerUrl),
    Protocol.Type.MAVLink
  )

  const getAutoPilot = (vehicles: WeakRef<Vehicle.Abstract>[]): ArduPilot => {
    const vehicle = vehicles?.last()?.deref()
    return (vehicle as ArduPilot) || undefined
  }

  VehicleFactory.onVehicles.once((vehicles: WeakRef<Vehicle.Abstract>[]) => {
    getAutoPilot(vehicles).onAttitude.add((newAttitude: Attitude) => {
      Object.assign(attitude, newAttitude)
    })
    getAutoPilot(vehicles).onPosition.add((newCoordinates: Coordinates) => {
      Object.assign(coordinates, newCoordinates)
    })
    getAutoPilot(vehicles).onMAVLinkMessage.add(
      MAVLinkType.HEARTBEAT,
      (pack: Package) => {
        if (pack.header.system_id != 1 || pack.header.component_id != 1) {
          return
        }

        const heartbeat = pack.message as Message.Heartbeat
        firmwareType.value = heartbeat.autopilot.type
        vehicleType.value = heartbeat.mavtype.type
        lastHeartbeat.value = new Date()
      }
    )
  })

  return {
    lastHeartbeat,
    firmwareType,
    vehicleType,
    attitude,
    coordinates,
    isVehicleOnline,
  }
})
