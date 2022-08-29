import { createPinia } from 'pinia'
import { createApp } from 'vue'

import type { Message } from '@/libs/connection/messages/mavlink2rest'
import { MAVLinkType } from '@/libs/connection/messages/mavlink2rest-enum'

import App from './App.vue'
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import router from './router'

loadFonts()

createApp(App).use(router).use(vuetify).use(createPinia()).mount('#app')

import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import * as Vehicle from '@/libs/vehicle/vehicle'
import { VehicleFactory } from '@/libs/vehicle/vehicle-factory'

ConnectionManager.addConnection(
  new Connection.URI('ws://blueos.local:6040/ws/mavlink'),
  Protocol.Type.MAVLink
)

import type { Attitude, Coordinates } from '@/libs/vehicle/types'

VehicleFactory.onVehicles.once((vehicles: WeakRef<Vehicle.Abstract>[]) => {
  vehicles
    .last()
    .deref()
    .onAttitude.add((attitude: Attitude) => console.log(attitude))
  vehicles
    .last()
    .deref()
    .onPosition.add((coordinates: Coordinates) => console.log(coordinates))
  vehicles
    .last()
    .deref()
    .onMAVLinkMessage.add(MAVLinkType.RAW_IMU, (message: Message) =>
      console.log(message)
    )
})
