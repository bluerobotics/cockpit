import { createPinia } from 'pinia'
import { createApp } from 'vue'

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
  new Connection.Scheme('ws://0.0.0.0:8088/ws/mavlink'),
  Protocol.ProtocolType.MAVLink
)

ConnectionManager.mainConnection()?.onRead((message) => console.log(message))

const vehicle = VehicleFactory.createVehicle(
  Vehicle.Firmware.ArduPilot,
  Vehicle.Type.Sub
)

console.log(vehicle)
