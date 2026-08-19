<template>
  <InteractionDialog
    :show-dialog="modelValue"
    title="Use a serial/USB device"
    variant="text-only"
    max-width="560"
    @update:show-dialog="onDialogUpdate"
  >
    <template #content>
      <div class="flex gap-x-2 absolute top-0 right-0 py-2 pr-3">
        <v-btn icon :width="34" :height="34" variant="text" aria-label="Close" class="bg-transparent" @click="close">
          <v-icon :size="22">mdi-close</v-icon>
        </v-btn>
      </div>
      <div class="flex flex-col gap-y-4 -mt-7 text-white">
        <template v-if="step === 'select'">
          <p class="text-body-2">
            Pick the device you believe is your GNSS receiver and we will check it for you. Nothing is saved until you
            confirm.
          </p>

          <div v-if="probeError" class="flex items-start gap-x-3 rounded-lg bg-[#FFFFFF11] p-3">
            <v-icon size="20" color="amber">mdi-alert-outline</v-icon>
            <span class="text-body-2">{{ probeError }}</span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-caption">{{ ports.length }} device(s) found</span>
            <v-btn variant="text" size="small" prepend-icon="mdi-refresh" @click="onRefreshPorts">Refresh</v-btn>
          </div>

          <div v-if="ports.length === 0" class="flex flex-col items-center gap-y-2 rounded-lg bg-[#FFFFFF11] p-6">
            <v-icon size="28">mdi-usb-port</v-icon>
            <span class="text-body-2">No serial devices found. Plug the receiver in and refresh the list.</span>
          </div>
          <v-list v-else theme="dark" class="bg-transparent py-0 max-h-[40vh] overflow-y-auto">
            <v-list-item
              v-for="port in ports"
              :key="port.path"
              :active="port.path === selectedPort?.path"
              rounded="lg"
              class="mb-1 bg-[#FFFFFF11]"
              prepend-icon="mdi-usb-port"
              @click="selectPort(port)"
            >
              <v-list-item-title class="font-mono text-body-2">{{ port.path }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{ portDescription(port) }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <div v-if="claimingDevice" class="rounded-lg bg-[#FFFFFF11] p-3 text-body-2">
            This device is already set up as "{{ claimingDevice.name }}". You can use it directly instead of adding it
            again.
          </div>
        </template>

        <template v-else-if="step === 'testing'">
          <div class="flex flex-col items-center gap-y-4 py-8">
            <v-progress-circular indeterminate size="42" width="3" />
            <p class="text-body-2">
              Checking <span class="font-mono">{{ selectedPort?.path }}</span> for GNSS data...
            </p>
            <p class="text-caption">Every common speed is tried, so this can take up to 15 seconds.</p>
          </div>
        </template>

        <template v-else>
          <div class="flex items-start gap-x-3 rounded-lg bg-[#FFFFFF11] p-3">
            <v-icon size="20" color="#3B7B62">mdi-check-circle-outline</v-icon>
            <span class="text-body-2">
              This is a GNSS receiver. Found valid data on
              <span class="font-mono">{{ selectedPort?.path }}</span> at {{ detectedBaud }} baud.
            </span>
          </div>

          <div v-if="!draftHasUsbModel" class="flex items-start gap-x-3 rounded-lg bg-[#FFFFFF11] p-3">
            <v-icon size="20" color="amber">mdi-alert-outline</v-icon>
            <span class="text-body-2">
              This device reports no USB model id, so auto-connect won't follow it to other computers.
            </span>
          </div>

          <div class="flex items-center gap-x-2">
            <v-icon :color="statusColor" size="small">{{ statusIcon }}</v-icon>
            <span class="text-body-2 capitalize">{{ statusLabel }}</span>
          </div>

          <div class="grid gap-2" :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'">
            <div
              v-for="item in previewItems"
              :key="item.key"
              class="flex justify-between rounded bg-[#FFFFFF11] px-3 py-1 text-body-2"
            >
              <span>{{ item.label }}</span>
              <span class="font-mono">{{ item.value }}</span>
            </div>
          </div>

          <v-text-field
            v-model="deviceName"
            label="Name"
            theme="dark"
            variant="outlined"
            density="compact"
            hint="How this receiver shows up in the sources list and in the data lake."
            persistent-hint
            @blur="onNameEdited"
          />
        </template>
      </div>
    </template>

    <template #actions>
      <template v-if="step === 'select'">
        <v-btn variant="text" size="small" @click="close">Cancel</v-btn>
        <v-spacer />
        <v-btn v-if="claimingDevice" size="small" class="bg-[#FFFFFF33] text-white" @click="useExistingDevice">
          Use "{{ claimingDevice.name }}"
        </v-btn>
        <v-btn
          v-else
          size="small"
          class="bg-[#FFFFFF33] text-white"
          :disabled="!selectedPort"
          @click="testSelectedPort"
        >
          Test device
        </v-btn>
      </template>
      <template v-else-if="step === 'testing'">
        <v-spacer />
        <v-btn variant="text" size="small" @click="close">Cancel</v-btn>
      </template>
      <template v-else>
        <v-btn variant="text" size="small" @click="backToSelection">Back</v-btn>
        <v-spacer />
        <v-btn
          size="small"
          class="bg-[#FFFFFF33] text-white"
          :disabled="!deviceName.trim() || draftStatus !== 'connected'"
          @click="confirmDevice"
        >
          Use this device
        </v-btn>
      </template>
    </template>
  </InteractionDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import InteractionDialog from '@/components/InteractionDialog.vue'
import { useBaseStation } from '@/composables/baseStation/useBaseStation'
import { openSnackbar } from '@/composables/snackbar'
import { useGnss } from '@/composables/useGnss'
import {
  autodetectBaud,
  deviceUsingPort,
  gnssFixItems,
  gnssStatusColor,
  gnssStatusIcon,
  gnssStatusLabel,
} from '@/libs/sensors/gnss'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { GnssDevice } from '@/types/gnss'
import type { SerialPortInfo } from '@/types/serial'

// Matches the base station's purpose rather than the receiver's model, since that is what the user is
// setting up here. Suffixed when a device already carries the name.
const preferredDeviceName = 'Base Station'

const props = defineProps<{
  /** Whether the dialog is open. */
  modelValue: boolean
}>()

const emit = defineEmits<{
  /** Emitted when the open state changes. */
  (event: 'update:modelValue', value: boolean): void
}>()

const gnss = useGnss()
const baseStation = useBaseStation()
const interfaceStore = useAppInterfaceStore()

const step = ref<'select' | 'testing' | 'confirm'>('select')
const selectedPort = ref<SerialPortInfo | null>(null)
const detectedBaud = ref<number | null>(null)
const probeError = ref('')
const deviceName = ref('')

const ports = computed(() => gnss.availablePorts.value)

const claimingDevice = computed<GnssDevice | undefined>(() =>
  selectedPort.value ? deviceUsingPort(gnss.devices.value, selectedPort.value) : undefined
)

const draftId = computed(() => gnss.draft.value?.id ?? '')
const draftFix = computed(() => gnss.latestFixes[draftId.value])
const draftHasUsbModel = computed(() => Boolean(gnss.draft.value?.usbMatch?.vendorId))

// The preview keeps rendering the last fix after the receiver goes away, so the readout alone cannot tell
// the operator whether what they are reading is still live.
const draftStatus = computed(() => gnss.statuses[draftId.value] ?? 'disconnected')
const statusLabel = computed(() => gnssStatusLabel(draftStatus.value))
const statusColor = computed(() => gnssStatusColor(draftStatus.value))
const statusIcon = computed(() => gnssStatusIcon(draftStatus.value))

// A probe that is joined by a later one resolves for both callers, and this component is never unmounted
// between a dismissal and a reopen, so a test abandoned earlier would otherwise walk the whole flow again
// alongside the current one and leave a second draft nothing can reach.
let probeRun = 0
const probeIsStale = (run: number): boolean => !props.modelValue || run !== probeRun

const previewKeys = ['fixQuality', 'satellitesUsed', 'latitude', 'longitude']

const previewItems = computed(() => {
  const fix = draftFix.value
  if (!fix) return [{ key: 'data', label: 'Data', value: 'Waiting...' }]
  const items = gnssFixItems(fix)
  return previewKeys.flatMap((key) => items.filter((item) => item.key === key))
})

const portDescription = (port: SerialPortInfo): string => {
  const details = [port.manufacturer, port.vendorId && port.productId ? `${port.vendorId}:${port.productId}` : null]
  const described = details.filter(Boolean).join(' - ')
  return described || 'No USB descriptors reported'
}

const discardDraft = async (): Promise<void> => {
  if (gnss.draft.value) await gnss.cancelCreate()
}

const resetToSelection = (): void => {
  step.value = 'select'
  detectedBaud.value = null
  deviceName.value = ''
}

const close = async (): Promise<void> => {
  logUserAction('Closed the base station GNSS setup')
  await discardDraft()
  emit('update:modelValue', false)
}

// The panel that hosts this dialog can be closed from outside it, taking the dialog down mid-flow.
onBeforeUnmount(discardDraft)

const onDialogUpdate = (value: boolean): void => {
  if (value) return
  close()
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return
    probeRun++
    resetToSelection()
    selectedPort.value = null
    probeError.value = ''
    gnss.refreshPorts()
  }
)

const onRefreshPorts = (): void => {
  logUserAction('Refreshed the serial device list in the base station GNSS setup')
  gnss.refreshPorts()
}

const selectPort = (port: SerialPortInfo): void => {
  selectedPort.value = port
  probeError.value = ''
  logUserAction(`Selected the serial device ${port.path} in the base station GNSS setup`)
}

const trackDevice = (id: string, name: string): void => {
  baseStation.gpsSourceId = id
  baseStation.trackByGps = true
  logUserAction(`Set the base station to be positioned by the GNSS device "${name}"`)
  openSnackbar({
    variant: 'success',
    message: `Connected to "${name}". The base station will follow it as soon as it reports a position.`,
    duration: 5000,
  })
}

const useExistingDevice = async (): Promise<void> => {
  const device = claimingDevice.value
  if (!device) return

  logUserAction(`Chose the already configured GNSS device "${device.name}" in the base station GNSS setup`)

  // Tracking only watches for fixes, so a device that is configured but not reading would never move the
  // base station, while turning tracking on takes manual entry away.
  if (gnss.statuses[device.id] !== 'connected') {
    try {
      await gnss.connectDevice(device.id)
    } catch (error) {
      probeError.value = `Could not connect to "${device.name}": ${(error as Error).message}`
      return
    }
  }

  trackDevice(device.id, device.name)
  close()
}

const testSelectedPort = async (): Promise<void> => {
  const port = selectedPort.value
  if (!port) return

  logUserAction(`Tested the serial device ${port.path} for GNSS data`)
  const run = ++probeRun
  step.value = 'testing'
  probeError.value = ''

  let baud: number | null = null
  try {
    baud = await autodetectBaud(port.path)
  } catch (error) {
    if (probeIsStale(run)) return
    probeError.value = `Could not read ${port.path}: ${(error as Error).message}`
    step.value = 'select'
    return
  }

  // The probe takes seconds, in which the dialog can be dismissed. Bail before claiming the port for a draft
  // nothing would be able to reach, let alone release.
  if (probeIsStale(run)) return

  if (baud === null) {
    const reason = 'does not look like a GNSS receiver, as no valid positioning data came out of it'
    probeError.value = `${port.path} ${reason}. Select another device and test it.`
    logUserAction(`Found no GNSS data on the serial device ${port.path}`)
    step.value = 'select'
    return
  }

  logUserAction(`Found GNSS data on the serial device ${port.path} at ${baud} baud`)
  detectedBaud.value = baud

  const draft = gnss.beginCreate()
  draft.name = gnss.planDeviceName(preferredDeviceName)
  draft.port = port.path
  draft.baud = baud
  // Only stored when the port reports a model: the device list syncs to the vehicle, and a bare path there
  // resolves to whatever happens to be plugged into it on another machine.
  if (port.vendorId && port.productId) {
    draft.usbMatch = { vendorId: port.vendorId, productId: port.productId, manufacturer: port.manufacturer }
  }

  // Previews the live stream without publishing to the data lake, so the user sees real data before saving.
  try {
    await gnss.connectDevice(draft.id)
  } catch (error) {
    probeError.value = `Could not connect to the device: ${(error as Error).message}`
    await discardDraft()
    resetToSelection()
    return
  }

  if (probeIsStale(run)) {
    await discardDraft()
    return
  }

  deviceName.value = draft.name
  step.value = 'confirm'
}

const backToSelection = async (): Promise<void> => {
  logUserAction('Went back to the device selection in the base station GNSS setup')
  await discardDraft()
  resetToSelection()
}

const onNameEdited = (): void => {
  logUserAction(`Named the base station GNSS device "${deviceName.value}"`)
}

const confirmDevice = async (): Promise<void> => {
  const draft = gnss.draft.value
  if (!draft) return

  const name = deviceName.value.trim()
  draft.name = name
  const id = await gnss.commitCreate()
  if (id === null) return

  trackDevice(id, name)
  close()
}
</script>
