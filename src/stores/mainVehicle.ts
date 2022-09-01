import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import type { Message } from '@/libs/connection/messages/mavlink2rest'
import {
  MavAutopilot,
  MAVLinkType,
  MavType,
} from '@/libs/connection/messages/mavlink2rest-enum'
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
    new Connection.URI('ws://blueos.local:6040/ws/mavlink'),
    Protocol.Type.MAVLink
  )

  VehicleFactory.onVehicles.once((vehicles: WeakRef<Vehicle.Abstract>[]) => {
    vehicles
      .last()
      .deref()
      .onAttitude.add((newAttitude: Attitude) => {
        Object.assign(attitude, newAttitude)
      })
    vehicles
      .last()
      .deref()
      .onPosition.add((newCoordinates: Coordinates) => {
        Object.assign(coordinates, newCoordinates)
      })
    vehicles
      .last()
      .deref()
      .onMAVLinkMessage.add(MAVLinkType.HEARTBEAT, (message: Message) => {
        firmwareType.value = message['autopilot']['type']
        vehicleType.value = message['mavtype']['type']
        lastHeartbeat.value = new Date()
      })
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
