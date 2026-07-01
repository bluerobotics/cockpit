import { reactive, ref } from 'vue'

import { useBlueOsStorage } from '@/composables/settingsSyncer'
import {
  autodetectBaud,
  clearSerialLines,
  defaultBaudRate,
  deleteDeviceVariables,
  forgetDeviceState,
  getDeviceStatus,
  getLatestFix,
  gnssDevicesKey,
  listSerialPorts,
  registerDeviceVariables,
  startGnssDevice,
  stopGnssDevice,
  subscribeToDeviceState,
} from '@/libs/sensors/gnss'
import { isElectron, machinizeString } from '@/libs/utils'
import type { GnssDevice, GnssState } from '@/types/gnss'
import type { SerialPortInfo } from '@/types/serial'

let state: GnssState | undefined

/**
 * Builds a machine-friendly, de-duplicated device id from a display name.
 * @param {string} name - The device name to derive the id from.
 * @param {string[]} existingIds - Ids already in use, which the result must not collide with.
 * @returns {string} A unique machinized id (falls back to `gnss` when the name has no usable characters).
 */
const generateDeviceId = (name: string, existingIds: string[]): string => {
  const base = machinizeString(name) || 'gnss'
  if (!existingIds.includes(base)) return base
  let suffix = 2
  while (existingIds.includes(`${base}-${suffix}`)) suffix++
  return `${base}-${suffix}`
}

/**
 * Builds the shared GNSS UI state: persisted devices, an optional in-progress draft, reactive per-device
 * status/fix maps mirrored from the manager, and the actions the Sources UI calls into.
 * @returns {GnssState} The initialized state object.
 */
const createState = (): GnssState => {
  const isSupported = isElectron()
  const devices = useBlueOsStorage<GnssDevice[]>(gnssDevicesKey, [])
  const draft = ref<GnssDevice | null>(null)
  const statuses = reactive<GnssState['statuses']>({})
  const latestFixes = reactive<GnssState['latestFixes']>({})
  const detecting = reactive<GnssState['detecting']>({})
  const availablePorts = ref<SerialPortInfo[]>([])

  // Mirror the manager's device state into reactive maps for the UI. The reading/data-lake pipeline is
  // driven by the manager (bootstrapped in main.ts), independently of this composable.
  for (const device of devices.value) {
    statuses[device.id] = getDeviceStatus(device.id)
    latestFixes[device.id] = getLatestFix(device.id)
  }
  subscribeToDeviceState((id, deviceState) => {
    statuses[id] = deviceState.status
    latestFixes[id] = deviceState.fix
  })

  const findDevice = (id: string): GnssDevice | undefined => devices.value.find((device) => device.id === id)
  const findDeviceOrDraft = (id: string): GnssDevice | undefined =>
    draft.value?.id === id ? draft.value : findDevice(id)

  const planDeviceId = (name: string): string =>
    generateDeviceId(
      name,
      devices.value.map((device) => device.id)
    )

  const refreshPorts = async (): Promise<void> => {
    availablePorts.value = await listSerialPorts()
  }

  const connectDevice = async (id: string): Promise<void> => {
    const isDraft = draft.value?.id === id
    const device = findDeviceOrDraft(id)
    if (!isSupported || !device || !device.port) return
    device.enabled = true
    // Drafts preview the stream without registering/publishing data-lake variables until saved.
    await startGnssDevice(device, !isDraft)
    logUserAction(`Connected GNSS "${device.name}" on ${device.port} at ${device.baud} baud`)
  }

  const disconnectDevice = async (id: string): Promise<void> => {
    const device = findDeviceOrDraft(id)
    if (device) device.enabled = false
    await stopGnssDevice(id)
    logUserAction(`Disconnected GNSS "${device?.name ?? id}"`)
  }

  const beginCreate = (): GnssDevice => {
    const name = `GNSS ${devices.value.length + 1}`
    const device: GnssDevice = { id: `draft-${Date.now()}`, name, port: '', baud: defaultBaudRate, enabled: false }
    draft.value = device
    statuses[device.id] = 'disconnected'
    logUserAction('Started GNSS device creation')
    return device
  }

  const clearDeviceRuntimeState = async (id: string): Promise<void> => {
    await stopGnssDevice(id)
    clearSerialLines(id)
    forgetDeviceState(id)
    delete detecting[id]
  }

  const cancelCreate = async (): Promise<void> => {
    const current = draft.value
    if (!current) return
    logUserAction('Cancelled GNSS device creation')
    await clearDeviceRuntimeState(current.id)
    delete statuses[current.id]
    delete latestFixes[current.id]
    draft.value = null
  }

  const commitCreate = async (): Promise<string | null> => {
    const current = draft.value
    if (!current) return null

    const wasConnected = (statuses[current.id] ?? 'disconnected') !== 'disconnected'
    const id = planDeviceId(current.name)

    // Release the preview connection and its transient state before creating the persistent device.
    await clearDeviceRuntimeState(current.id)
    delete statuses[current.id]
    delete latestFixes[current.id]
    draft.value = null

    const device: GnssDevice = {
      id,
      name: current.name,
      port: current.port,
      baud: current.baud,
      enabled: wasConnected,
      usbMatch: current.usbMatch,
    }
    devices.value.push(device)
    registerDeviceVariables(device)
    statuses[id] = 'disconnected'
    logUserAction(`Added GNSS device "${device.name}"`)

    if (wasConnected) {
      connectDevice(id).catch((error) => console.error('[GNSS] Failed to connect after creation:', error))
    }
    return id
  }

  const removeDevice = async (id: string): Promise<void> => {
    const device = findDevice(id)
    logUserAction(`Removed GNSS device "${device?.name ?? id}"`)
    await clearDeviceRuntimeState(id)
    deleteDeviceVariables(id)
    const index = devices.value.findIndex((entry) => entry.id === id)
    if (index !== -1) devices.value.splice(index, 1)
    delete statuses[id]
    delete latestFixes[id]
  }

  const autodetect = async (id: string): Promise<number | null> => {
    const device = findDeviceOrDraft(id)
    if (!isSupported || !device || !device.port) return null
    logUserAction(`Started GNSS baud auto-detection on ${device.port}`)
    detecting[id] = true
    try {
      const detected = await autodetectBaud(device.port)
      if (detected !== null) {
        device.baud = detected
        logUserAction(`Detected GNSS baud rate: ${detected}`)
      }
      return detected
    } finally {
      detecting[id] = false
    }
  }

  if (isSupported) refreshPorts()

  return {
    devices,
    draft,
    statuses,
    latestFixes,
    detecting,
    availablePorts,
    isSupported,
    refreshPorts,
    beginCreate,
    cancelCreate,
    commitCreate,
    planDeviceId,
    removeDevice,
    connectDevice,
    disconnectDevice,
    autodetect,
  }
}

/**
 * Reactive access to the GNSS feature for the UI. State is created once and shared across all callers.
 * The reading/data-lake pipeline itself runs independently via `initGnss` and does not require this.
 * @returns {GnssState} The shared GNSS state and actions.
 */
export const useGnss = (): GnssState => {
  if (!state) state = createState()
  return state
}
