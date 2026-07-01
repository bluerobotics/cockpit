<template>
  <InteractionDialog
    :show-dialog="modelValue"
    :title="dialogTitle"
    variant="text-only"
    max-width="640"
    @update:show-dialog="onDialogUpdate"
  >
    <template #content>
      <div class="flex gap-x-2 absolute top-0 right-0 py-2 pr-3">
        <v-btn icon :width="34" :height="34" variant="text" class="bg-transparent top-2 right-2" @click="close">
          <v-icon :size="22">mdi-close</v-icon>
        </v-btn>
      </div>
      <div v-if="device" class="flex flex-col gap-y-4 px-1 -mt-7 text-white">
        <v-text-field
          v-model="device.name"
          label="Name"
          variant="outlined"
          density="compact"
          hide-details
          :disabled="!gnss.isSupported"
        />
        <div v-if="create" class="-mt-2 text-xs opacity-60">
          Planned ID: <span class="font-mono">{{ plannedId }}</span>
        </div>

        <div class="flex items-center gap-x-2">
          <v-select
            v-model="device.port"
            :items="gnss.availablePorts.value"
            item-title="path"
            item-value="path"
            label="Serial port"
            theme="dark"
            variant="outlined"
            density="compact"
            hide-details
            :disabled="!gnss.isSupported"
            no-data-text="No serial ports found"
            class="flex-1"
            @update:model-value="onPortSelected"
          />
          <v-btn icon="mdi-refresh" variant="text" size="small" :disabled="!gnss.isSupported" @click="onRefreshPorts" />
        </div>
        <div v-if="device.port && !device.usbMatch?.vendorId" class="-mt-2 text-xs text-amber-300/80">
          This device reports no USB model id, so auto-connect won't follow it to other computers.
        </div>

        <div class="flex items-center gap-x-2">
          <v-select
            v-model="device.baud"
            :items="commonBaudRates"
            label="Baud rate"
            theme="dark"
            variant="outlined"
            density="compact"
            hide-details
            :disabled="!gnss.isSupported"
            class="flex-1"
          />
          <v-btn
            variant="text"
            size="small"
            :loading="gnss.detecting[activeId]"
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
            @click="gnss.disconnectDevice(activeId)"
          >
            Disconnect
          </v-btn>
          <v-btn
            v-else
            variant="flat"
            size="small"
            class="bg-[#FFFFFF22]"
            :disabled="!gnss.isSupported || !device.port"
            @click="gnss.connectDevice(activeId)"
          >
            Connect
          </v-btn>
        </div>

        <ExpansiblePanel compact no-top-divider no-bottom-divider :is-expanded="false">
          <template #title>Device Status</template>
          <template #content>
            <div v-if="fix" class="grid grid-cols-2 gap-2 w-full text-sm mt-2">
              <div
                v-for="item in statusItems"
                :key="item.label"
                class="flex justify-between px-3 py-1 rounded bg-[#FFFFFF11]"
              >
                <span class="opacity-70">{{ item.label }}</span>
                <span class="font-mono">{{ item.value }}</span>
              </div>
            </div>
            <div v-else class="text-sm opacity-60 mt-2">No data received yet.</div>
          </template>
        </ExpansiblePanel>

        <div class="flex items-center justify-between">
          <span class="text-xs opacity-60 font-mono">Variables: external/positioning/gnss/{{ displayId }}/*</span>
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
            :get-recent-events="() => getRecentSerialLines(activeId)"
            :subscribe="(listener) => subscribeToSerialLines(activeId, listener)"
            :levels="[]"
            empty-message="No serial data received yet. Connect the device to see incoming data."
          />
        </div>
      </div>
    </template>
    <template #actions>
      <template v-if="create">
        <v-spacer></v-spacer>
        <v-btn text :disabled="!device?.name" @click="onAdd">Add device</v-btn>
      </template>
      <template v-else>
        <v-btn text @click="onDelete">Delete device</v-btn>
        <v-spacer></v-spacer>
        <v-btn text @click="close">Close</v-btn>
      </template>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import ConsoleViewer from '@/components/ConsoleViewer.vue'
import ExpansiblePanel from '@/components/ExpansiblePanel.vue'
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
  /** The id of the device to configure. Ignored in create mode. */
  deviceId?: string
  /** When true, the dialog edits an unsaved draft that is only persisted on "Add device". */
  create?: boolean
}>()

const emit = defineEmits<{
  /** Emitted when the open state changes. */
  (event: 'update:modelValue', value: boolean): void
}>()

const gnss = useGnss()
const { showDialog, closeDialog } = useInteractionDialog()

const device = computed(() =>
  props.create ? gnss.draft.value : gnss.devices.value.find((e) => e.id === props.deviceId)
)
const activeId = computed(() => device.value?.id ?? '')
const plannedId = computed(() => gnss.planDeviceId(device.value?.name ?? ''))
const displayId = computed(() => (props.create ? plannedId.value : activeId.value))
const dialogTitle = computed(() => (props.create ? 'Add GNSS device' : `Configure ${device.value?.name ?? 'device'}`))

const status = computed(() => gnss.statuses[activeId.value] ?? 'disconnected')
const fix = computed(() => gnss.latestFixes[activeId.value])
const isActive = computed(() => status.value !== 'disconnected')

const consoleOpen = ref(false)

const onDialogUpdate = (value: boolean): void => {
  if (!value && props.create && gnss.draft.value) gnss.cancelCreate()
  emit('update:modelValue', value)
}

const close = (): void => onDialogUpdate(false)

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

const onRefreshPorts = (): void => {
  logUserAction('Refreshed GNSS serial port list')
  gnss.refreshPorts()
}

const onPortSelected = (path: string | null): void => {
  const current = device.value
  if (!current) return
  const info = gnss.availablePorts.value.find((port) => port.path === path)
  current.usbMatch = info
    ? { vendorId: info.vendorId, productId: info.productId, manufacturer: info.manufacturer }
    : undefined
}

const toggleConsole = (): void => {
  consoleOpen.value = !consoleOpen.value
  logUserAction(`${consoleOpen.value ? 'Opened' : 'Closed'} serial console for GNSS device "${activeId.value}"`)
}

const onAutodetect = async (): Promise<void> => {
  const detected = await gnss.autodetect(activeId.value)
  openSnackbar({
    message:
      detected !== null ? `Detected baud rate: ${detected}` : 'Could not detect a baud rate with valid GNSS data.',
    variant: detected !== null ? 'success' : 'error',
    duration: 4000,
  })
}

const onAdd = async (): Promise<void> => {
  await gnss.commitCreate()
  emit('update:modelValue', false)
}

const onDelete = (): void => {
  const name = device.value?.name ?? activeId.value
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
          await gnss.removeDevice(activeId.value)
          close()
        },
      },
    ],
  })
}
</script>
