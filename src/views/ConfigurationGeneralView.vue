<template>
  <BaseConfigurationView>
    <template #title>General configuration</template>
    <template #content>
      <v-card class="pb-2 pa-5 ma-4" max-width="600px">
        <v-icon :icon="'mdi-earth'" class="mr-3" />
        <span class="text-h6">Global vehicle address</span>
        <v-form
          ref="globalAddressForm"
          v-model="globalAddressFormValid"
          class="justify-center d-flex align-center"
          @submit.prevent="setGlobalAddress"
        >
          <v-text-field
            v-model="newGlobalAddress"
            variant="underlined"
            type="input"
            hint="Address of the Vehicle. E.g: blueos.local"
            class="uri-input"
            :rules="[isValidHostAddress, isValidConnectionURI]"
          />

          <v-btn v-tooltip.bottom="'Set'" icon="mdi-check" class="mx-1 mb-5 pa-0" rounded="lg" flat type="submit" />
          <v-btn
            v-tooltip.bottom="'Reset to default'"
            :disabled="newGlobalAddress === defaultGlobalAddress"
            icon="mdi-refresh"
            class="mx-1 mb-5 pa-0"
            rounded="lg"
            flat
            @click="resetGlobalAddress"
          />
        </v-form>
        <span>Current address: {{ mainVehicleStore.globalAddress }} </span><br />
      </v-card>
      <v-card class="pb-2 pa-5 ma-4" max-width="600px">
        <v-progress-circular v-if="vehicleConnected === undefined" indeterminate size="24" class="mr-3" />
        <v-icon v-else :icon="vehicleConnected ? 'mdi-lan-connect' : 'mdi-lan-disconnect'" class="mr-3" />
        <span class="text-h6">Mavlink2Rest connection</span>
        <v-form
          ref="mainConnectionForm"
          v-model="mainConnectionFormValid"
          class="justify-center d-flex align-center"
          @submit.prevent="setMainVehicleConnectionURI"
        >
          <v-checkbox
            v-model="mainVehicleStore.customMainConnectionURI.enabled"
            v-tooltip.bottom="'Enable custom'"
            class="mx-1 mb-5 pa-0"
            rounded="lg"
            hide-details
          />

          <v-text-field
            v-model="mainConnectionURI"
            :disabled="!mainVehicleStore.customMainConnectionURI.enabled"
            label="Mavlink2Rest URI"
            variant="underlined"
            type="input"
            hint="URI of a Mavlink2Rest web-socket"
            class="uri-input"
            :rules="[isValidSocketConnectionURI]"
          />

          <v-btn
            v-tooltip.bottom="'Set'"
            :disabled="!mainVehicleStore.customMainConnectionURI.enabled"
            icon="mdi-check"
            class="mx-1 mb-5 pa-0"
            rounded="lg"
            flat
            type="submit"
          />
          <v-btn
            v-tooltip.bottom="'Reset to default'"
            :disabled="!mainVehicleStore.customMainConnectionURI.enabled"
            icon="mdi-refresh"
            class="mx-1 mb-5 pa-0"
            rounded="lg"
            flat
            @click="resetMainVehicleConnectionURI"
          />
        </v-form>
        <span>Current address: {{ ConnectionManager.mainConnection()?.uri().toString() ?? 'none' }} </span><br />
        <span
          >Status:
          {{
            vehicleConnected ? 'connected' : vehicleConnected === undefined ? 'connecting...' : 'failed to connect'
          }}</span
        >
      </v-card>
      <v-card class="pb-2 pa-5 ma-4" max-width="600px">
        <v-icon :icon="'mdi-lan-pending'" class="mr-3" />
        <span class="text-h6">WebRTC connection</span>
        <v-form
          ref="webRTCSignallingForm"
          v-model="webRTCSignallingFormValid"
          class="justify-center d-flex align-center"
          @submit.prevent="setWebRTCSignallingURI"
        >
          <v-checkbox
            v-model="mainVehicleStore.customWebRTCSignallingURI.enabled"
            v-tooltip.bottom="'Enable custom'"
            class="mx-1 mb-5 pa-0"
            rounded="lg"
            hide-details
          />

          <v-text-field
            v-model="webRTCSignallingURI"
            :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled"
            label="WebRTC Signalling Server URI"
            variant="underlined"
            type="input"
            hint="URI of a WebRTC Signalling Server URI"
            class="uri-input"
            :rules="[isValidSocketConnectionURI]"
          />

          <v-btn
            v-tooltip.bottom="'Set'"
            :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled"
            icon="mdi-check"
            class="mx-1 mb-5 pa-0"
            rounded="lg"
            flat
            type="submit"
          />
          <v-btn
            v-tooltip.bottom="'Reset to default'"
            :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled"
            icon="mdi-refresh"
            class="mx-1 mb-5 pa-0"
            rounded="lg"
            flat
            @click="resetWebRTCSignallingURI"
          />
        </v-form>
        <span>Current address: {{ mainVehicleStore.webRTCSignallingURI.toString() }} </span><br />
      </v-card>
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { defaultGlobalAddress } from '@/assets/defaults'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import { isValidNetworkAddress } from '@/libs/utils'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import { useMainVehicleStore } from '@/stores/mainVehicle'

import BaseConfigurationView from './BaseConfigurationView.vue'

const mainVehicleStore = useMainVehicleStore()

const globalAddressForm = ref()
const globalAddressFormValid = ref(false)
const newGlobalAddress = ref(mainVehicleStore.globalAddress)

const setGlobalAddress = async (): Promise<void> => {
  await globalAddressForm.value.validate()

  const validation = isValidConnectionURI(newGlobalAddress.value)
  if (validation !== true) {
    alert(validation)
    return
  }

  mainVehicleStore.globalAddress = newGlobalAddress.value

  // Temporary solution to actually set the address and connect the vehicle, since this is non-reactive today.
  // TODO: Modify the store variables to be reactive.
  location.reload()
}

const resetGlobalAddress = async (): Promise<void> => {
  newGlobalAddress.value = defaultGlobalAddress

  await setGlobalAddress()
}

/** Main vehicle connection */

const vehicleConnected = ref<boolean | undefined>(mainVehicleStore.isVehicleOnline)
watch(
  () => mainVehicleStore.isVehicleOnline,
  () => (vehicleConnected.value = mainVehicleStore.isVehicleOnline)
)

const mainConnectionForm = ref()
const mainConnectionFormValid = ref(false)
const mainConnectionURI = ref(mainVehicleStore.mainConnectionURI)

const addNewVehicleConnection = async (conn: Connection.URI): Promise<void> => {
  mainConnectionURI.value = conn
  vehicleConnected.value = undefined
  setTimeout(() => (vehicleConnected.value ??= false), 5000)
  try {
    ConnectionManager.addConnection(new Connection.URI(conn), Protocol.Type.MAVLink)
  } catch (error) {
    console.error(error)
    alert(`Could not update main connection. ${error}.`)
    return
  }
  console.debug(`New connection successfully configured to ${conn.toString()}.`)
}

watch(
  () => mainVehicleStore.mainConnectionURI,
  (val: Connection.URI) => {
    if (val.toString() === mainConnectionURI.value.toString()) {
      return
    }

    addNewVehicleConnection(val)
  }
)

const setMainVehicleConnectionURI = async (): Promise<void> => {
  const res = await mainConnectionForm.value.validate()

  if (!res.valid) {
    return
  }

  mainVehicleStore.customMainConnectionURI = {
    data: mainConnectionURI.value.toString(),
    enabled: true,
  }

  addNewVehicleConnection(mainConnectionURI.value)
}

const resetMainVehicleConnectionURI = async (): Promise<void> => {
  mainVehicleStore.customMainConnectionURI = {
    enabled: false,
    data: mainVehicleStore.defaultMainConnectionURI.toString(),
  }
}

const webRTCSignallingForm = ref()
const webRTCSignallingFormValid = ref(false)
const webRTCSignallingURI = ref(mainVehicleStore.webRTCSignallingURI)

const addWebRTCConnection = async (conn: Connection.URI): Promise<void> => {
  webRTCSignallingURI.value = conn

  // This works as a reset for the custom URI, and its not needed in mainConnectionURI since on Add from
  // ConnectionManager it will be set.
  if (!mainVehicleStore.customWebRTCSignallingURI.enabled) {
    mainVehicleStore.customWebRTCSignallingURI.data = conn.toString()
  }

  // Temporary solution to actually set WebRTC URI, since right now we cannot just make reactive because streams will
  // be kept open.
  // TODO: handle video stream re connection
  location.reload()
}

watch(
  () => mainVehicleStore.webRTCSignallingURI,
  (val: Connection.URI) => {
    if (val.toString() === webRTCSignallingURI.value.toString()) {
      return
    }

    addWebRTCConnection(val)
  }
)

const setWebRTCSignallingURI = async (): Promise<void> => {
  const res = await webRTCSignallingForm.value.validate()

  if (!res.valid) {
    return
  }

  mainVehicleStore.customWebRTCSignallingURI = {
    data: webRTCSignallingURI.value.toString(),
    enabled: true,
  }

  addWebRTCConnection(webRTCSignallingURI.value)
}

const resetWebRTCSignallingURI = (): void => {
  mainVehicleStore.customWebRTCSignallingURI = {
    enabled: false,
    data: mainVehicleStore.defaultWebRTCSignallingURI.toString(),
  }
}

const isValidHostAddress = (value: string): boolean | string => {
  return isValidNetworkAddress(value) ?? 'Invalid host address. Should be an IP address or a hostname'
}

const isValidConnectionURI = (value: string): boolean | string => {
  const forbiddenStartStrings = ['http://', 'https://', 'ws://', 'wss://']
  if (forbiddenStartStrings.some((protocol) => value.startsWith(protocol))) {
    return 'Address should not include protocol (e.g.: "http://", "wss://").'
  }

  try {
    new Connection.URI(`ws://${value}:6040/`)
  } catch (error) {
    return `Invalid connection URI. ${error}.`
  }
  return true
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
</script>

<style scoped>
.uri-input {
  min-width: 350px;
}
</style>
