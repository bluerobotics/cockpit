<template>
  <InteractionDialog
    :show-dialog="modelValue"
    :title="device ? `Configure ${device.name}` : 'Configure device'"
    variant="text-only"
    max-width="640"
    @update:show-dialog="emit('update:modelValue', $event)"
  >
    <template #content>
      <div v-if="device" class="flex flex-col gap-y-4 px-1 text-white">
        <v-text-field
          v-model="device.name"
          label="Name"
          variant="outlined"
          density="compact"
          hide-details
          :disabled="!gnss.isSupported"
        />

        <div class="flex items-center gap-x-2">
          <v-select
            v-model="device.port"
            :items="gnss.availablePorts.value"
            label="Serial port"
            variant="outlined"
            density="compact"
            hide-details
            :disabled="!gnss.isSupported"
            no-data-text="No serial ports found"
            class="flex-1"
          />
          <v-btn
            icon="mdi-refresh"
            variant="text"
            size="small"
            :disabled="!gnss.isSupported"
            @click="gnss.refreshPorts()"
          />
        </div>

        <div class="flex items-center gap-x-2">
          <v-select
            v-model="device.baud"
            :items="commonBaudRates"
            label="Baud rate"
            variant="outlined"
            density="compact"
            hide-details
            :disabled="!gnss.isSupported"
            class="flex-1"
          />
          <v-btn
            variant="text"
            size="small"
            :loading="gnss.detecting[device.id]"
            :disabled="!gnss.isSupported || !device.port"
            @click="onAutodetect"
          >
            Auto-detect
          </v-btn>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-x-2">
            <v-icon :color="statusColor" size="small">{{ statusIcon }}</v-icon>
            <span class="text-sm capitalize">{{ statusLabel }}</span>
          </div>
          <v-btn
            v-if="isActive"
            variant="flat"
            size="small"
            class="bg-[#FFFFFF22]"
            @click="gnss.disconnectDevice(device.id)"
          >
            Disconnect
          </v-btn>
          <v-btn
            v-else
            variant="flat"
            size="small"
            class="bg-[#FFFFFF22]"
            :disabled="!gnss.isSupported || !device.port"
            @click="gnss.connectDevice(device.id)"
          >
            Connect
          </v-btn>
        </div>

        <div v-if="fix" class="grid grid-cols-2 gap-2 w-full text-sm">
          <div
            v-for="item in statusItems"
            :key="item.label"
            class="flex justify-between px-3 py-1 rounded bg-[#FFFFFF11]"
          >
            <span class="opacity-70">{{ item.label }}</span>
            <span class="font-mono">{{ item.value }}</span>
          </div>
        </div>
        <div v-else class="text-sm opacity-60">No data received yet.</div>

        <div class="flex items-center justify-between">
          <span class="text-xs opacity-60 font-mono">Variables: external/positioning/gnss/{{ device.id }}/*</span>
          <v-btn
            variant="text"
            size="small"
            :prepend-icon="consoleOpen ? 'mdi-chevron-up' : 'mdi-console-line'"
            @click="toggleConsole"
          >
            {{ consoleOpen ? 'Hide console' : 'Serial console' }}
          </v-btn>
        </div>

        <div v-if="consoleOpen" class="h-[280px]">
          <ConsoleViewer
            :get-recent-events="() => getRecentSerialLines(deviceId)"
            :subscribe="(listener) => subscribeToSerialLines(deviceId, listener)"
            :levels="[]"
            empty-message="No serial data received yet. Connect the device to see incoming data."
          />
        </div>
      </div>
    </template>
    <template #actions>
      <v-btn text @click="onDelete">Delete device</v-btn>
      <v-spacer></v-spacer>
      <v-btn text @click="close">Close</v-btn>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import ConsoleViewer from '@/components/ConsoleViewer.vue'
import InteractionDialog from '@/components/InteractionDialog.vue'
import { useInteractionDialog } from '@/composables/interactionDialog'
import { openSnackbar } from '@/composables/snackbar'
import { useGnss } from '@/composables/useGnss'
import {
  commonBaudRates,
  getRecentSerialLines,
  gnssStatusColor,
  gnssStatusIcon,
  gnssStatusLabel,
  subscribeToSerialLines,
} from '@/libs/sensors/gnss'
import { fixQualityLabel } from '@/libs/sensors/nmea'

const props = defineProps<{
  /** Whether the dialog is open. */
  modelValue: boolean
  /** The id of the device to configure. */
  deviceId: string
}>()

const emit = defineEmits<{
  /** Emitted when the open state changes. */
  (event: 'update:modelValue', value: boolean): void
}>()

const gnss = useGnss()
const { showDialog, closeDialog } = useInteractionDialog()

const device = computed(() => gnss.devices.value.find((entry) => entry.id === props.deviceId))
const status = computed(() => gnss.statuses[props.deviceId] ?? 'disconnected')
const fix = computed(() => gnss.latestFixes[props.deviceId])
const isActive = computed(() => status.value !== 'disconnected')

const consoleOpen = ref(false)

const close = (): void => emit('update:modelValue', false)

const statusLabel = computed(() => gnssStatusLabel(status.value))
const statusColor = computed(() => gnssStatusColor(status.value))
const statusIcon = computed(() => gnssStatusIcon(status.value))

const formatNumber = (value: number | undefined, digits: number): string =>
  value === undefined ? '-' : value.toFixed(digits)

const statusItems = computed(() => {
  const current = fix.value
  if (!current) return []
  return [
    { label: 'Fix', value: current.fixQualityLabel ?? fixQualityLabel(current.fixQuality ?? 0) },
    { label: 'Fix mode', value: current.fixMode === undefined ? '-' : `${current.fixMode}D`.replace('1D', 'No fix') },
    { label: 'Latitude', value: formatNumber(current.latitude, 7) },
    { label: 'Longitude', value: formatNumber(current.longitude, 7) },
    {
      label: 'Altitude (MSL)',
      value: current.altitudeMslM === undefined ? '-' : `${formatNumber(current.altitudeMslM, 1)} m`,
    },
    { label: 'Satellites used', value: current.satellitesUsed?.toString() ?? '-' },
    { label: 'Satellites in view', value: current.satellitesInView?.toString() ?? '-' },
    { label: 'HDOP', value: formatNumber(current.hdop, 2) },
    {
      label: 'Speed',
      value: current.speedOverGroundMps === undefined ? '-' : `${formatNumber(current.speedOverGroundMps, 2)} m/s`,
    },
    { label: 'UTC time', value: current.utcTime ?? '-' },
  ]
})

const toggleConsole = (): void => {
  consoleOpen.value = !consoleOpen.value
  logUserAction(`${consoleOpen.value ? 'Opened' : 'Closed'} serial console for GNSS device "${props.deviceId}"`)
}

const onAutodetect = async (): Promise<void> => {
  const detected = await gnss.autodetect(props.deviceId)
  openSnackbar({
    message:
      detected !== null ? `Detected baud rate: ${detected}` : 'Could not detect a baud rate with valid GNSS data.',
    variant: detected !== null ? 'success' : 'error',
    duration: 4000,
  })
}

const onDelete = (): void => {
  const name = device.value?.name ?? props.deviceId
  showDialog({
    variant: 'warning',
    title: 'Delete GNSS device?',
    message: `Delete "${name}"? This disconnects it and removes its data-lake variables.`,
    actions: [
      { text: 'Cancel', size: 'small', action: closeDialog },
      {
        text: 'Delete',
        size: 'small',
        action: async () => {
          closeDialog()
          await gnss.removeDevice(props.deviceId)
          close()
        },
      },
    ],
  })
}
</script>
