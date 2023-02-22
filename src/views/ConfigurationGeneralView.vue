<template>
  <BaseConfigurationView>
    <template #title>General configuration</template>
    <template #content>
      <v-card class="pa-5 pb-2 ma-4" max-width="600px">
        <v-icon :icon="'mdi-earth'" class="mr-3" />
        <span class="text-h6">Global vehicle address</span>
        <v-form
          ref="globalAddressForm"
          v-model="globalAddressFormValid"
          class="d-flex justify-center align-center"
          @submit.prevent="setGlobalAddress"
        >
          <v-text-field
            v-model="newGlobalAddress"
            variant="underlined"
            type="input"
            hint="Address of the Vehicle. E.g: blueos.local"
            class="uri-input"
            :rules="[isValidHostAddress]"
          />

          <v-btn v-tooltip.bottom="'Set'" icon="mdi-check" class="pa-0 mx-1 mb-5" rounded="lg" flat type="submit" />
          <v-template>
            <v-btn
              v-tooltip.bottom="'Reset to default'"
              :disabled="newGlobalAddress === defaultGlobalAddress"
              icon="mdi-refresh"
              class="pa-0 mx-1 mb-5"
              rounded="lg"
              flat
              @click="resetGlobalAddress"
            />
          </v-template>
        </v-form>
        <span>Current address: {{ mainVehicleStore.globalAddress }} </span><br />
      </v-card>
      <v-card class="pa-5 pb-2 ma-4" max-width="600px">
        <v-progress-circular v-if="vehicleConnected === undefined" indeterminate size="24" class="mr-3" />
        <v-icon v-else :icon="vehicleConnected ? 'mdi-lan-connect' : 'mdi-lan-disconnect'" class="mr-3" />
        <span class="text-h6">Mavlink2Rest connection</span>
        <v-form
          ref="connectionForm"
          v-model="connectionFormValid"
          class="d-flex justify-center align-center"
          @submit.prevent="addNewVehicleConnection"
        >
          <v-checkbox
            v-model="connectionURI.isCustom"
            v-tooltip.bottom="'Enable custom'"
            class="pa-0 mx-1 mb-5"
            rounded="lg"
            hide-details
          />

          <v-text-field
            v-model="connectionURI.val"
            :disabled="!connectionURI.isCustom"
            label="Mavlink2Rest URI"
            variant="underlined"
            type="input"
            hint="URI of a Mavlink2Rest web-socket"
            class="uri-input"
            :rules="[isValidSocketConnectionURI]"
          />

          <v-btn v-tooltip.bottom="'Set'" icon="mdi-check" class="pa-0 mx-1 mb-5" rounded="lg" flat type="submit" />
          <v-template>
            <v-btn
              v-tooltip.bottom="'Reset to default'"
              :disabled="connectionURI.toString() === connectionURI.defaultValue.toString()"
              icon="mdi-refresh"
              class="pa-0 mx-1 mb-5"
              rounded="lg"
              flat
              @click="resetVehicleConnection"
            />
          </v-template>
        </v-form>
        <span>Current address: {{ ConnectionManager.mainConnection()?.uri().toString() ?? 'none' }} </span><br />
        <span
          >Status:
          {{
            vehicleConnected ? 'connected' : vehicleConnected === undefined ? 'connecting...' : 'failed to connect'
          }}</span
        >
      </v-card>
      <v-card class="pa-5 pb-2 ma-4" max-width="600px">
        <v-icon :icon="'mdi-lan-pending'" class="mr-3" />
        <span class="text-h6">WebRTC connection</span>
        <v-form
          ref="webRTCSignallingForm"
          v-model="webRTCSignallingFormValid"
          class="d-flex justify-center align-center"
          @submit.prevent="setWebRTCSignallingURI"
        >
          <v-checkbox
            v-model="webRTCSignallingURI.isCustom"
            v-tooltip.bottom="'Enable custom'"
            class="pa-0 mx-1 mb-5"
            rounded="lg"
            hide-details
          />

          <v-text-field
            v-model="webRTCSignallingURI.val"
            :disabled="!webRTCSignallingURI.isCustom"
            label="WebRTC Signalling Server URI"
            variant="underlined"
            type="input"
            hint="URI of a WebRTC Signalling Server URI"
            class="uri-input"
            :rules="[isValidSocketConnectionURI]"
          />

          <v-btn v-tooltip.bottom="'Set'" icon="mdi-check" class="pa-0 mx-1 mb-5" rounded="lg" flat type="submit" />
          <v-template>
            <v-btn
              v-tooltip.bottom="'Reset to default'"
              :disabled="webRTCSignallingURI.val.toString() === webRTCSignallingURI.defaultValue.toString()"
              icon="mdi-refresh"
              class="pa-0 mx-1 mb-5"
              rounded="lg"
              flat
              @click="resetWebRTCSignallingURI"
            />
          </v-template>
        </v-form>
        <span>Current address: {{ mainVehicleStore.webRTCSignallingURI.val.toString() }} </span><br />
      </v-card>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { defaultGlobalAddress } from '@/assets/defaults'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import BaseConfigurationView from './BaseConfigurationView.vue'

const mainVehicleStore = useMainVehicleStore()

const globalAddressForm = ref()
const globalAddressFormValid = ref(false)
const newGlobalAddress = ref(mainVehicleStore.globalAddress)

const webRTCSignallingForm = ref()
const webRTCSignallingFormValid = ref(false)
const webRTCSignallingURI = ref(mainVehicleStore.webRTCSignallingURI)
// TODO: Make a local buffer to keep changes until the user hit the "SET" button, then propagate the change into the Store
const webRTCSignallingURILocal = ref<string>('')
webRTCSignallingURILocal.value = mainVehicleStore.webRTCSignallingURI.val

const connectionForm = ref()
const connectionFormValid = ref(false)
const connectionURI = ref(mainVehicleStore.mainConnectionURI)

const vehicleConnected = ref<boolean | undefined>(mainVehicleStore.isVehicleOnline)
watch(
  () => mainVehicleStore.isVehicleOnline,
  () => (vehicleConnected.value = mainVehicleStore.isVehicleOnline)
)

const isValidHostAddress = (value: string): boolean | string => {
  if (value.length >= 255) {
    return 'Address is too long'
  }

  // Regexes from https://stackoverflow.com/a/106223/3850957
  const ipRegex = new RegExp(
    '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$'
  )
  const hostnameRegex = new RegExp(
    '^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\\-]*[A-Za-z0-9])$'
  )

  if (ipRegex.test(value) || hostnameRegex.test(value)) {
    return true
  }

  return 'Invalid host address. Should be an IP address or a hostname'
}

const isValidSocketConnectionURI = (value: string): boolean | string => {
  try {
    const conn = new Connection.URI(value)
    if (conn.type() !== Connection.Type.WebSocket) {
      throw new Error('URI should be of type WebSocket')
    }
  } catch (error) {
    return `Invalid connection URI. ${error}.`
  }
  return true
}

const resetGlobalAddress = (): void => {
  newGlobalAddress.value = defaultGlobalAddress

  setGlobalAddress()
}

const resetVehicleConnection = async (): Promise<void> => {
  connectionURI.value.reset()

  await addNewVehicleConnection()
}

const resetWebRTCSignallingURI = (): void => {
  webRTCSignallingURI.value.reset()
}

// Adds a new connection, which right now is the same as changing the main one
const addNewVehicleConnection = async (): Promise<void> => {
  await connectionForm.value.validate()
  vehicleConnected.value = undefined
  setTimeout(() => (vehicleConnected.value ??= false), 5000)
  try {
    ConnectionManager.addConnection(new Connection.URI(connectionURI.value.val), Protocol.Type.MAVLink)
  } catch (error) {
    console.error(error)
    alert(`Could not update main connection. ${error}.`)
    return
  }
  console.debug(`New connection successfully configured to ${connectionURI.value.val}.`)
}

const setGlobalAddress = async (): Promise<void> => {
  await globalAddressForm.value.validate()
  mainVehicleStore.globalAddress = newGlobalAddress.value
}

const setWebRTCSignallingURI = async (): Promise<void> => {
  await webRTCSignallingForm.value.validate()
  mainVehicleStore.webRTCSignallingURI.val = webRTCSignallingURI.value.val
}
</script>

<style scoped>
.uri-input {
  min-width: 350px;
}
</style>
