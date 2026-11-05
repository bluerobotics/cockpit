<template>
  <BaseConfigurationView>
    <template #title>Sources</template>
    <template #content>
      <div
        class="flex-col h-full overflow-y-auto ml-[10px] pr-3 -mr-[10px]"
        :class="interfaceStore.isOnSmallScreen ? 'max-w-[80vw] max-h-[90vh]' : 'max-w-[650px] max-h-[85vh]'"
      >
        <ExpansiblePanel no-top-divider no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Positioning</template>
          <template #info>
            <div class="w-full">
              <p>
                Read one or more external USB/serial GNSS receivers and inject their position and fix data into the
                data-lake, where it can drive live points of interest and widgets.
              </p>
              <p class="mt-2">
                Message formats are detected automatically (standard NMEA 0183). Each device publishes variables under
                <span class="font-mono">external/positioning/gnss/&lt;id&gt;/*</span>.
              </p>
            </div>
          </template>
          <template #content>
            <div class="flex flex-col w-full mt-2 pb-4">
              <div v-if="!gnss.isSupported" class="bg-amber-900/30 border border-amber-500/30 rounded-lg p-4 mb-4">
                <div class="flex items-start gap-3">
                  <v-icon color="amber" class="mt-1">mdi-information</v-icon>
                  <div>
                    <h4 class="text-amber-200 font-medium mb-2">Cockpit Lite</h4>
                    <p class="text-amber-100 text-sm">
                      Reading external serial GNSS receivers is only available in Cockpit standalone. Browsers cannot
                      access serial devices outside of a secure context, so this feature is disabled here.
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="gnss.devices.value.length === 0" class="text-sm opacity-60 py-4 text-center">
                No GNSS devices configured.
              </div>

              <div v-else class="flex flex-col">
                <div class="flex items-center gap-2 px-3 py-1 text-xs uppercase opacity-60">
                  <span class="flex-1">Name</span>
                  <span class="w-[30%] text-center">Port</span>
                  <span class="w-[24%] text-center">Status</span>
                  <span class="w-[24px]" />
                </div>
                <div
                  v-for="device in gnss.devices.value"
                  :key="device.id"
                  class="flex items-center gap-2 px-3 py-2 mb-1 rounded bg-[#FFFFFF11]"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <v-icon :color="statusColor(device.id)" size="small">{{ statusIcon(device.id) }}</v-icon>
                    <span class="truncate">{{ device.name }}</span>
                  </div>
                  <span class="w-[30%] truncate font-mono text-xs opacity-80 text-center">{{
                    device.port || '—'
                  }}</span>
                  <span class="w-[24%] truncate text-xs opacity-80 text-center">{{ fixLabel(device.id) }}</span>
                  <v-btn
                    icon="mdi-cog"
                    variant="text"
                    size="x-small"
                    title="Configure"
                    @click="openDialog(device.id)"
                  />
                </div>
              </div>

              <div class="flex justify-center mt-3">
                <v-btn variant="outlined" class="rounded-lg" :disabled="!gnss.isSupported" @click="onAddDevice">
                  <v-icon start>mdi-plus</v-icon>
                  Add USB/serial GNSS source
                </v-btn>
              </div>
            </div>
          </template>
        </ExpansiblePanel>

        <ExpansiblePanel no-bottom-divider :is-expanded="!interfaceStore.isOnPhoneScreen">
          <template #title>Traffic</template>
          <template #info>
            <div class="w-full">
              <p>
                Show the aircraft and vessels around the vehicle on the map, and publish up to 100 of them to the
                data-lake under
                <span class="font-mono">/traffic/aircraft/&lt;icao&gt;/*</span> and
                <span class="font-mono">/traffic/vessels/&lt;mmsi&gt;/*</span>.
              </p>
              <p class="mt-2">
                Traffic the vehicle's own ADS-B and AIS receivers report is always shown. The public feeds below cover
                the area around the vehicle when it carries no receiver of its own.
              </p>
            </div>
          </template>
          <template #content>
            <div class="flex flex-col w-full mt-2 pb-4">
              <div v-if="!isInternetTrafficSupported" class="bg-amber-900/30 border border-amber-500/30 rounded-lg p-4">
                <div class="flex items-start gap-3">
                  <v-icon color="amber" class="mt-1">mdi-information</v-icon>
                  <div>
                    <h4 class="text-amber-200 font-medium mb-2">Cockpit Lite</h4>
                    <p class="text-amber-100 text-sm">
                      The public traffic feeds do not allow a browser to read them, so they are only available in
                      Cockpit Standalone. Traffic reported by the vehicle's own receivers is still shown here.
                    </p>
                  </div>
                </div>
              </div>

              <div v-else class="flex flex-col gap-4">
                <div
                  class="grid gap-x-4 [&_.v-label]:ml-1"
                  :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'"
                >
                  <v-switch
                    :model-value="internetAirTrafficEnabled"
                    label="Air traffic from the internet"
                    color="white"
                    density="compact"
                    hide-details
                    base-color="#FFFFFF33"
                    @update:model-value="setInternetAirTraffic"
                  />
                  <v-switch
                    :model-value="internetVesselTrafficEnabled"
                    label="Vessel traffic from the internet"
                    color="white"
                    density="compact"
                    hide-details
                    base-color="#FFFFFF33"
                    @update:model-value="setInternetVesselTraffic"
                  />
                </div>

                <div v-if="internetVesselTrafficEnabled" class="flex items-center gap-3">
                  <p class="text-sm text-slate-200 whitespace-nowrap">aisstream.io API key</p>
                  <input
                    v-model.trim="apiKeyDraft"
                    type="text"
                    aria-label="aisstream.io API key"
                    class="px-2 py-1 flex-1 max-w-[22rem] rounded-sm bg-[#FFFFFF22]"
                  />
                  <v-btn
                    :icon="isApiKeySaved ? 'mdi-reload' : 'mdi-check'"
                    :title="isApiKeySaved ? 'Reconnect with this key' : 'Save this key'"
                    variant="text"
                    size="x-small"
                    color="white"
                    @click="onApiKeyAction"
                  />
                  <a
                    href="https://aisstream.io"
                    target="_blank"
                    rel="noopener"
                    class="text-sm text-slate-300 underline whitespace-nowrap"
                    @click="onApiKeySiteOpen"
                  >
                    Get a key
                  </a>
                </div>

                <div v-if="internetAirTrafficEnabled || internetVesselTrafficEnabled" class="flex items-center gap-3">
                  <p class="text-sm text-slate-200 whitespace-nowrap">Search radius</p>
                  <input
                    v-model.number="trafficSearchRadiusKm"
                    type="number"
                    aria-label="Traffic search radius in kilometers"
                    :min="MIN_SEARCH_RADIUS_KM"
                    :max="MAX_SEARCH_RADIUS_KM"
                    class="px-2 py-1 w-[90px] rounded-sm bg-[#FFFFFF22]"
                    @focus="onSearchRadiusFocus"
                    @blur="onSearchRadiusBlur"
                  />
                  <p class="text-sm text-slate-200">km around the vehicle</p>
                </div>

                <p v-if="internetAirTrafficEnabled" class="text-xs opacity-60">
                  Air traffic data from adsb.lol, shared under the Open Database License.
                </p>
              </div>
            </div>
          </template>
        </ExpansiblePanel>
      </div>

      <GnssDeviceDialog v-if="creatingDevice" model-value create @update:model-value="creatingDevice = false" />
      <GnssDeviceDialog
        v-else-if="dialogDeviceId"
        model-value
        :device-id="dialogDeviceId"
        @update:model-value="dialogDeviceId = null"
      />
    </template>
  </BaseConfigurationView>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import GnssDeviceDialog from '@/components/sources/GnssDeviceDialog.vue'
import { openSnackbar } from '@/composables/snackbar'
import {
  aisStreamApiKey,
  clampSearchRadiusKm,
  internetAirTrafficEnabled,
  internetVesselTrafficEnabled,
  isInternetTrafficSupported,
  MAX_SEARCH_RADIUS_KM,
  MIN_SEARCH_RADIUS_KM,
  reloadVesselTraffic,
  trafficSearchRadiusKm,
} from '@/composables/traffic'
import { useGnss } from '@/composables/useGnss'
import { gnssStatusColor, gnssStatusIcon } from '@/libs/sensors/gnss'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const gnss = useGnss()

const dialogDeviceId = ref<string | null>(null)
const creatingDevice = ref(false)

const apiKeyDraft = ref(aisStreamApiKey.value)
const isApiKeySaved = computed(() => apiKeyDraft.value === aisStreamApiKey.value)

const openDialog = (id: string): void => {
  dialogDeviceId.value = id
  logUserAction(`Opened configuration for GNSS device "${id}"`)
}

const onAddDevice = (): void => {
  gnss.beginCreate()
  creatingDevice.value = true
}

const fixLabel = (id: string): string => {
  if ((gnss.statuses[id] ?? 'disconnected') === 'disconnected') return '—'
  const fix = gnss.latestFixes[id]
  if (!fix) return 'No data'
  return fix.fixQualityLabel ?? (fix.hasValidFix ? 'Fix' : 'No fix')
}

const statusColor = (id: string): string => gnssStatusColor(gnss.statuses[id] ?? 'disconnected')

const statusIcon = (id: string): string => gnssStatusIcon(gnss.statuses[id] ?? 'disconnected')

const setInternetAirTraffic = (enabled: boolean | null): void => {
  internetAirTrafficEnabled.value = enabled === true
  logUserAction(`Turned ${enabled === true ? 'on' : 'off'} air traffic from the internet`)
}

const setInternetVesselTraffic = (enabled: boolean | null): void => {
  internetVesselTrafficEnabled.value = enabled === true
  logUserAction(`Turned ${enabled === true ? 'on' : 'off'} vessel traffic from the internet`)
}

const onApiKeySiteOpen = (): void => {
  logUserAction('Opened the aisstream.io site from the traffic settings')
}

const onApiKeyAction = (): void => {
  if (isApiKeySaved.value) {
    reloadVesselTraffic()
    logUserAction('Reconnected the vessel traffic feed')
    openSnackbar({ message: 'Reconnecting to the vessel traffic feed', variant: 'info', duration: 3000 })
    return
  }
  const cleared = apiKeyDraft.value === ''
  aisStreamApiKey.value = apiKeyDraft.value
  logUserAction(`${cleared ? 'Cleared' : 'Set'} the aisstream.io API key`)
  const message = cleared ? 'Cleared the aisstream.io API key' : 'Saved the aisstream.io API key'
  openSnackbar({ message, variant: 'success', duration: 3000 })
}

// The field writes every keystroke straight to the setting, so what the radius was before the edit is only knowable
// from when it was focused.
let radiusBeforeEdit: number | undefined

const onSearchRadiusFocus = (): void => {
  radiusBeforeEdit = clampSearchRadiusKm(trafficSearchRadiusKm.value)
}

const onSearchRadiusBlur = (): void => {
  const radius = clampSearchRadiusKm(trafficSearchRadiusKm.value)
  trafficSearchRadiusKm.value = radius
  if (radius === radiusBeforeEdit) return
  logUserAction(`Set the traffic search radius to ${radius} km`)
}
</script>
