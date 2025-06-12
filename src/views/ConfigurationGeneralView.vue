<template>
  <BaseConfigurationView>
    <template #title>General configuration</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[650px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>User settings</template>
          <template #info>
            <p class="w-full">
              User related configuration. Here you can set the user that is currently set for this device as well as
              create a new user account.
              <br />
              <br />
              <span class="font-semibold">Pirate mode</span> allows Cockpit to expose advanced features, like setting
              the frequency of MAVLink messages. Take care when enabling this mode.
            </p>
          </template>
          <template #content>
            <div class="flex flex-col w-full items-start">
              <div class="flex align-center w-full justify-between pr-2 mt-1 mb-3">
                <div>
                  <span class="mr-2">Current user:</span>
                  <span class="font-semibold text-2xl cursor-pointer" @click="missionStore.changeUsername">{{
                    missionStore.username
                  }}</span>
                </div>
                <div class="flex justify-end">
                  <v-btn
                    id="select-profile"
                    size="small"
                    append-icon="mdi-account"
                    class="bg-[#FFFFFF22] shadow-2 -mr-2"
                    variant="flat"
                    @click="missionStore.changeUsername"
                    >Manage users</v-btn
                  >
                </div>
              </div>
              <v-divider class="w-full opacity-[0.08]" />
              <div class="flex flex-row w-full items-center justify-between py-5 gap-x-2">
                <v-btn size="x-small" class="bg-[#FFFFFF22] shadow-1" variant="flat" @click="openTutorial">
                  Show tutorial
                </v-btn>
                <v-btn
                  v-if="isElectron()"
                  size="x-small"
                  class="bg-[#FFFFFF22] shadow-1"
                  variant="flat"
                  @click="openCockpitFolder"
                >
                  Open Cockpit folder
                </v-btn>
                <v-btn
                  size="x-small"
                  class="bg-[#FFFFFF22] shadow-1"
                  variant="flat"
                  @click="showCockpitSettingsDialog = true"
                >
                  Manage Cockpit settings
                </v-btn>
                <v-btn
                  size="x-small"
                  class="bg-[#FFFFFF22] shadow-1"
                  variant="flat"
                  @click="interfaceStore.pirateMode = !interfaceStore.pirateMode"
                >
                  {{ interfaceStore.pirateMode ? 'Disable pirate mode' : 'Enable pirate mode' }}
                </v-btn>
              </div>
            </div>
          </template>
        </ExpansiblePanel>

        <ExpansiblePanel :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Vehicle network connection (global address)</template>
          <template #subtitle>Current address: {{ mainVehicleStore.globalAddress }}</template>
          <template #info>Sets the network address for device communication. E.g: blueos.local</template>
          <template #content>
            <v-btn
              v-if="isElectron()"
              size="x-small"
              class="bg-[#FFFFFF22] mt-3 mb-2 shadow-2"
              variant="flat"
              @click="showDiscoveryDialog = true"
            >
              Search for vehicles
            </v-btn>
            <v-form
              ref="globalAddressForm"
              v-model="globalAddressFormValid"
              class="flex w-full mt-2 mb-2"
              @submit.prevent="setGlobalAddress"
            >
              <div
                class="flex justify-start items-center w-[86%] mb-4"
                :class="interfaceStore.isOnSmallScreen ? 'scale-80' : 'scale-100'"
                :style="
                  interfaceStore.highlightedComponent === 'vehicle-address' && {
                    animation: 'highlightBackground 0.5s alternate 20',
                    borderRadius: '10px',
                  }
                "
              >
                <v-text-field
                  v-model="newGlobalAddress"
                  variant="filled"
                  type="input"
                  density="compact"
                  hint="Address of the Vehicle. E.g: blueos.local"
                  hide-details
                  class="w-[80%]"
                  :rules="[isValidHostAddress, isValidConnectionURI]"
                  @click:append-inner="resetGlobalAddress"
                >
                  <template #append-inner>
                    <v-icon v-tooltip.bottom="'Reset global address'" color="white" @click="resetGlobalAddress">
                      mdi-refresh
                    </v-icon>
                  </template>
                </v-text-field>
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  class="bg-transparent"
                  :class="interfaceStore.isOnSmallScreen ? 'ml-1' : 'ml-5'"
                  variant="text"
                  type="submit"
                >
                  Apply
                </v-btn>
              </div>
            </v-form>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-top-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>MAVLink2REST URI</template>
          <template #subtitle>
            Current address: {{ ConnectionManager.mainConnection()?.uri().toString() ?? 'none' }}<br />
            Status:
            {{
              vehicleConnected ? 'connected' : vehicleConnected === undefined ? 'connecting...' : 'failed to connect'
            }}
          </template>
          <template #content>
            <v-progress-circular v-if="vehicleConnected === undefined" indeterminate size="24" class="mr-3" />
            <v-form
              ref="mainConnectionForm"
              v-model="mainConnectionFormValid"
              class="flex w-full mt-2"
              @submit.prevent="setMainVehicleConnectionURI"
            >
              <div class="flex flex-row w-full justify-start gap-x-8 align-center">
                <div
                  class="flex justify-start items-center"
                  :class="interfaceStore.isOnSmallScreen ? 'scale-80 w-[80%]' : 'scale-100 w-[76%]'"
                >
                  <v-text-field
                    v-model="mavlink2RestWebsocketURI"
                    :disabled="!mainVehicleStore.customMAVLink2RestWebsocketURI.enabled"
                    variant="filled"
                    type="input"
                    density="compact"
                    hint="URI of a Mavlink2Rest"
                    :rules="[isValidSocketConnectionURI]"
                  >
                    <template #append-inner>
                      <v-icon
                        v-tooltip.bottom="'Reset to default'"
                        color="white"
                        :disabled="!mainVehicleStore.customMAVLink2RestWebsocketURI.enabled"
                        @click="resetMainVehicleConnectionURI"
                      >
                        mdi-refresh
                      </v-icon>
                    </template>
                  </v-text-field>
                </div>
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  class="bg-transparent -mt-5 -ml-6"
                  :disabled="!mainVehicleStore.customMAVLink2RestWebsocketURI.enabled"
                  variant="text"
                  type="submit"
                >
                  Apply
                </v-btn>
              </div>
              <div class="flex justify-end mt-6">
                <div
                  class="flex flex-col align-end text-[10px]"
                  :class="interfaceStore.isOnSmallScreen ? '-mt-3' : '-mt-5'"
                >
                  <v-switch
                    v-model="mainVehicleStore.customMAVLink2RestWebsocketURI.enabled"
                    v-tooltip.bottom="'Enable custom'"
                    class="-mt-5 bg-transparent mr-1 mb-[7px]"
                    density="compact"
                    hide-details
                  />
                  <div class="-mt-[4px]">
                    {{ mainVehicleStore.customMAVLink2RestWebsocketURI.enabled ? 'Enabled' : 'Disabled' }}
                  </div>
                </div>
              </div>
            </v-form>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Video connection (WebRTC)</template>
          <template #subtitle>Current address: {{ mainVehicleStore.webRTCSignallingURI.toString() }}</template>
          <template #content>
            <v-form
              ref="webRTCSignallingForm"
              v-model="webRTCSignallingFormValid"
              class="justify-center d-flex align-center mt-2"
              @submit.prevent="setWebRTCSignallingURI"
            >
              <div class="flex flex-row w-full justify-start gap-x-8 align-center">
                <div
                  class="flex justify-start items-center"
                  :class="interfaceStore.isOnSmallScreen ? 'scale-80 w-[80%]' : 'scale-100 w-[76%]'"
                >
                  <v-text-field
                    v-model="webRTCSignallingURI"
                    :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled"
                    variant="filled"
                    type="input"
                    density="compact"
                    hint="URI of a WebRTC Signalling Server URI"
                    :rules="[isValidSocketConnectionURI]"
                  >
                    <template #append-inner>
                      <v-icon
                        v-tooltip.bottom="'Reset to default'"
                        color="white"
                        :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled"
                        @click="resetWebRTCSignallingURI"
                      >
                        mdi-refresh
                      </v-icon>
                    </template>
                  </v-text-field>
                </div>
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  :disabled="!mainVehicleStore.customWebRTCSignallingURI.enabled"
                  class="bg-transparent -mt-5 -ml-6"
                  variant="text"
                  type="submit"
                >
                  Apply
                </v-btn>
              </div>
              <div>
                <div
                  class="flex flex-col align-end text-[10px]"
                  :class="interfaceStore.isOnSmallScreen ? '-mt-3' : '-mt-5'"
                >
                  <v-switch
                    v-model="mainVehicleStore.customWebRTCSignallingURI.enabled"
                    v-tooltip.bottom="'Enable custom'"
                    class="-mt-5 bg-transparent mr-1 mb-[7px]"
                    density="compact"
                    hide-details
                  />
                  <div class="-mt-[4px]">
                    {{ mainVehicleStore.customWebRTCSignallingURI.enabled ? 'Enabled' : 'Disabled' }}
                  </div>
                </div>
              </div>
            </v-form>
          </template>
        </ExpansiblePanel>
        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Custom WebRTC configuration</template>
          <template #content>
            <div class="flex justify-between mt-2 w-full">
              <v-textarea
                id="rtcConfigTextInput"
                v-model="customRtcConfiguration"
                :disabled="!mainVehicleStore.customWebRTCConfiguration.enabled"
                variant="outlined"
                label="Custom WebRTC Configuration"
                :rows="6"
                hint="e.g.: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }"
                class="w-full"
              />
              <div class="flex flex-col justify-around align-center w-[100px] -mr-6">
                <v-btn
                  :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
                  :disabled="!mainVehicleStore.customWebRTCConfiguration.enabled"
                  class="bg-transparent -mb-5"
                  variant="text"
                  type="submit"
                  @click="handleCustomRtcConfiguration"
                >
                  Apply
                </v-btn>

                <div class="flex flex-col align-end text-[10px] -mt-8">
                  <v-switch
                    v-model="mainVehicleStore.customWebRTCConfiguration.enabled"
                    v-tooltip.bottom="'Enable custom'"
                    class="-mt-5 bg-transparent"
                    rounded="lg"
                    hide-details
                  />
                  <div class="-mt-[4px]">
                    {{ mainVehicleStore.customWebRTCConfiguration.enabled ? 'Enabled' : 'Disabled' }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>
    </template>
  </BaseConfigurationView>
  <VehicleDiscoveryDialog v-model="showDiscoveryDialog" />
  <ManageCockpitSettings v-model:openConfigDialog="showCockpitSettingsDialog" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { defaultGlobalAddress } from '@/assets/defaults'
import ManageCockpitSettings from '@/components/configuration/CockpitSettingsManager.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import VehicleDiscoveryDialog from '@/components/VehicleDiscoveryDialog.vue'
import { useSnackbar } from '@/composables/snackbar'
import * as Connection from '@/libs/connection/connection'
import { ConnectionManager } from '@/libs/connection/connection-manager'
import { isValidNetworkAddress, reloadCockpit } from '@/libs/utils'
import { isElectron } from '@/libs/utils'
import * as Protocol from '@/libs/vehicle/protocol/protocol'
import { useAppInterfaceStore } from '@/stores/appInterface'
import { useMainVehicleStore } from '@/stores/mainVehicle'
import { useMissionStore } from '@/stores/mission'

import BaseConfigurationView from './BaseConfigurationView.vue'

const mainVehicleStore = useMainVehicleStore()
const interfaceStore = useAppInterfaceStore()
const missionStore = useMissionStore()
const { openSnackbar } = useSnackbar()

const globalAddressForm = ref()
const globalAddressFormValid = ref(false)
const newGlobalAddress = ref(mainVehicleStore.globalAddress)
const showCockpitSettingsDialog = ref(false)

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
  reloadCockpit(3000)
}

const resetGlobalAddress = async (): Promise<void> => {
  newGlobalAddress.value = defaultGlobalAddress

  await setGlobalAddress()
}

const handleCustomRtcConfiguration = (): void => {
  if (mainVehicleStore.customWebRTCConfiguration.enabled) {
    updateWebRtcConfiguration()
  }
}

/** Main vehicle connection */

const vehicleConnected = ref<boolean | undefined>(mainVehicleStore.isVehicleOnline)
watch(
  () => mainVehicleStore.isVehicleOnline,
  () => (vehicleConnected.value = mainVehicleStore.isVehicleOnline)
)

const mainConnectionForm = ref()
const mainConnectionFormValid = ref(false)
const mavlink2RestWebsocketURI = ref(mainVehicleStore.MAVLink2RestWebsocketURI)

const addNewVehicleConnection = async (conn: Connection.URI): Promise<void> => {
  mavlink2RestWebsocketURI.value = conn
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
  () => mainVehicleStore.MAVLink2RestWebsocketURI,
  (val: Connection.URI) => {
    if (val.toString() === mavlink2RestWebsocketURI.value.toString()) {
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

  mainVehicleStore.customMAVLink2RestWebsocketURI = {
    data: mavlink2RestWebsocketURI.value.toString(),
    enabled: true,
  }

  addNewVehicleConnection(mavlink2RestWebsocketURI.value)
}

const resetMainVehicleConnectionURI = async (): Promise<void> => {
  mainVehicleStore.customMAVLink2RestWebsocketURI = {
    enabled: false,
    data: mainVehicleStore.defaultMAVLink2RestWebsocketURI.toString(),
  }
}

const webRTCSignallingForm = ref()
const webRTCSignallingFormValid = ref(false)
const webRTCSignallingURI = ref(mainVehicleStore.webRTCSignallingURI)

const addWebRTCConnection = async (conn: Connection.URI): Promise<void> => {
  webRTCSignallingURI.value = conn

  // This works as a reset for the custom URI, and its not needed in MAVLink2RestWebsocketURI since on Add from
  // ConnectionManager it will be set.
  if (!mainVehicleStore.customWebRTCSignallingURI.enabled) {
    mainVehicleStore.customWebRTCSignallingURI.data = conn.toString()
  }

  // Temporary solution to actually set WebRTC URI, since right now we cannot just make reactive because streams will
  // be kept open.
  // TODO: handle video stream re connection
  reloadCockpit(3000)
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
    if (conn.type() !== Connection.Type.WebSocket && conn.type() !== Connection.Type.Serial) {
      throw new Error('URI should be of type WebSocket or Serial')
    }
  } catch (error) {
    return `Invalid connection URI. ${error}.`
  }
  return true
}

const customRtcConfiguration = ref<string>(JSON.stringify(mainVehicleStore.customWebRTCConfiguration.data, null, 4))
const updateWebRtcConfiguration = (): void => {
  try {
    const newConfig = JSON.parse(customRtcConfiguration.value)
    mainVehicleStore.customWebRTCConfiguration.data = newConfig
    reloadCockpit(3000)
  } catch (error) {
    alert(`Could not update WebRTC configuration. ${error}.`)
  }
}

const tryToPrettifyRtcConfig = (): void => {
  try {
    const ugly = customRtcConfiguration.value
    const obj = JSON.parse(ugly)
    const pretty = JSON.stringify(obj, null, 4)
    if (ugly !== pretty) {
      customRtcConfiguration.value = pretty
    }
  } catch (error) {
    // Do nothing if the JSON is invalid
  }
}

const openTutorial = (): void => {
  interfaceStore.isMainMenuVisible = false
  interfaceStore.isTutorialVisible = true
}

watch(customRtcConfiguration, () => tryToPrettifyRtcConfig())

onMounted(() => {
  tryToPrettifyRtcConfig()
})

const showDiscoveryDialog = ref(false)

const openCockpitFolder = (): void => {
  if (isElectron() && window.electronAPI) {
    window.electronAPI?.openCockpitFolder()
  } else {
    openSnackbar({
      message: 'This feature is only available in the desktop version of Cockpit.',
      duration: 3000,
      variant: 'error',
      closeButton: true,
    })
  }
}
</script>
<style scoped>
.uri-input {
  width: 100% !important;
}
</style>
