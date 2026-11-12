<template>
  <v-form
    v-model="formValid"
    class="grid gap-x-4 w-full mt-2 [&_input]:px-4 [&_input]:text-sm"
    :class="interfaceStore.isOnPhoneScreen ? 'grid-cols-1' : 'grid-cols-2'"
    @submit.prevent="apply"
  >
    <v-select
      v-model="form.type"
      :items="typeItems"
      item-props
      label="Connection type"
      variant="outlined"
      density="compact"
      theme="dark"
      @update:model-value="onTypeChange"
    />
    <template v-if="form.type === 'serial'">
      <v-select
        v-model="form.serialPath"
        :items="serialPortItems"
        item-props
        :rules="[isFilled]"
        label="Serial port"
        no-data-text="No serial devices found"
        variant="outlined"
        density="compact"
        theme="dark"
        @update:model-value="onSerialPortChange"
      >
        <template #append>
          <v-btn
            v-tooltip.bottom="'Refresh the serial device list'"
            aria-label="Refresh the serial device list"
            icon="mdi-refresh"
            size="small"
            variant="text"
            @click="refreshSerialPorts"
          />
        </template>
      </v-select>
      <v-select
        v-model="form.baudRate"
        :items="baudRates"
        label="Baud rate"
        variant="outlined"
        density="compact"
        theme="dark"
      />
    </template>
    <v-text-field
      v-else-if="form.type === 'udp'"
      v-model.number="form.udpPort"
      :rules="[isPort]"
      label="Listening port"
      type="number"
      variant="outlined"
      density="compact"
    />
    <template v-else-if="form.type === 'tcp'">
      <v-text-field
        v-model="form.tcpHost"
        :rules="[isHost]"
        label="Host"
        placeholder="192.168.2.2"
        variant="outlined"
        density="compact"
      />
      <v-text-field
        v-model.number="form.tcpPort"
        :rules="[isPort]"
        label="Port"
        type="number"
        variant="outlined"
        density="compact"
      />
    </template>
    <v-text-field
      v-else-if="form.type === 'custom'"
      v-model="form.uri"
      :rules="uriRules"
      label="Connection address"
      variant="outlined"
      density="compact"
    />
    <div class="flex justify-end items-start" :class="interfaceStore.isOnPhoneScreen ? '' : 'col-start-2'">
      <v-btn
        :size="interfaceStore.isOnSmallScreen ? 'small' : 'default'"
        :disabled="!formValid"
        class="bg-[#FFFFFF22] mt-1"
        variant="text"
        type="submit"
      >
        Apply
      </v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSnackbar } from '@/composables/snackbar'
import {
  type ConnectionForm,
  type ConnectionFormType,
  connectionFormFromUri,
  connectionFormToUri,
  isValidPort,
} from '@/libs/connection/connection-form'
import { listSerialPorts } from '@/libs/connection/serial'
import { isSitlAvailable } from '@/libs/connection/sitl-connection'
import { isElectron, isValidNetworkAddress } from '@/libs/utils'
import { useAppInterfaceStore } from '@/stores/appInterface'
import type { SerialPortInfo } from '@/types/serial'

const props = defineProps<{
  /**
   * Connection URI currently in use
   */
  uri: string
  /**
   * Whether the connection in use is the one that follows the vehicle address
   */
  usingDefault: boolean
  /**
   * Validation rules for a connection address typed by hand
   */
  uriRules: ((value: string) => boolean | string)[]
}>()

const emit = defineEmits<{
  (event: 'apply', uri: string | null): void
}>()

const interfaceStore = useAppInterfaceStore()
const { openSnackbar } = useSnackbar()

const formFromProps = (): ConnectionForm => {
  const form = connectionFormFromUri(props.uri)
  return props.usingDefault ? { ...form, type: 'default' } : form
}

const formValid = ref(false)
const form = ref(formFromProps())
watch(
  () => [props.uri, props.usingDefault],
  () => (form.value = formFromProps())
)

const standaloneOnly = isElectron() ? {} : { disabled: true, subtitle: 'Only on the desktop app' }
const typeItems = [
  { title: 'Vehicle address (default)', value: 'default' },
  { title: 'Serial', value: 'serial', ...standaloneOnly },
  { title: 'UDP', value: 'udp', ...standaloneOnly },
  { title: 'TCP', value: 'tcp', ...standaloneOnly },
  ...(isSitlAvailable() ? [{ title: 'Simulator', value: 'sitl' }] : []),
  { title: 'Custom address', value: 'custom' },
]

const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 500000, 921600]

const serialPorts = ref<SerialPortInfo[]>([])
const serialPortItems = computed(() =>
  serialPorts.value.map((port) => ({ title: port.path, subtitle: port.manufacturer, value: port.path }))
)
const loadSerialPorts = async (): Promise<void> => {
  try {
    serialPorts.value = await listSerialPorts()
  } catch (error) {
    openSnackbar({ message: `Could not list the serial devices. ${error}`, variant: 'error' })
  }
}
watch(
  () => form.value.type,
  (type) => type === 'serial' && loadSerialPorts(),
  { immediate: true }
)

const refreshSerialPorts = (): void => {
  logUserAction('Refreshed the serial device list of the vehicle connection')
  loadSerialPorts()
}

const onSerialPortChange = (path: string): void => {
  logUserAction(`Selected the serial device ${path} for the vehicle connection`)
  const port = serialPorts.value.find((candidate) => candidate.path === path)
  form.value.serialVendorId = port?.vendorId ?? ''
  form.value.serialProductId = port?.productId ?? ''
  form.value.serialNumber = port?.serialNumber ?? ''
}

const onTypeChange = (type: ConnectionFormType): void => {
  logUserAction(`Selected the '${type}' vehicle connection type`)
}

const isFilled = (value: string): boolean | string => !!value || 'Select a serial port'
const isPort = (value: number): boolean | string => isValidPort(value) || 'Should be a port from 1 to 65535'
const isHost = (value: string): boolean | string =>
  isValidNetworkAddress(value) || 'Should be an IP address or a hostname'

const apply = (): void => {
  if (!formValid.value) return
  emit('apply', form.value.type === 'default' ? null : connectionFormToUri(form.value))
}
</script>
