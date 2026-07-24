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
                      Reading external serial GNSS receivers is only available in Cockpit Standalone. Browsers cannot
                      access serial devices outside of a secure context, so this feature is disabled here.
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="gnss.devices.value.length === 0" class="text-sm opacity-60 py-4 text-center">
                {{ $t('No GNSS devices configured.') }}
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
                    :title="$t('Configure')"
                    @click="openDialog(device.id)"
                  />
                </div>
              </div>

              <div class="flex justify-center mt-3">
                <v-btn variant="outlined" class="rounded-lg" :disabled="!gnss.isSupported" @click="onAddDevice">
                  <v-icon start>mdi-plus</v-icon>
                  {{ $t('Add USB/serial GNSS source') }}
                </v-btn>
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
import { ref } from 'vue'

import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
import GnssDeviceDialog from '@/components/sources/GnssDeviceDialog.vue'
import { useGnss } from '@/composables/useGnss'
import { gnssStatusColor, gnssStatusIcon } from '@/libs/sensors/gnss'
import { useAppInterfaceStore } from '@/stores/appInterface'

import BaseConfigurationView from './BaseConfigurationView.vue'

const interfaceStore = useAppInterfaceStore()
const gnss = useGnss()

const dialogDeviceId = ref<string | null>(null)
const creatingDevice = ref(false)

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
</script>
