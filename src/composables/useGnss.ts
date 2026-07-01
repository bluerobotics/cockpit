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

let state: GnssState | undefined

const generateDeviceId = (name: string, existingIds: string[]): string => {
  const base = machinizeString(name) || 'gnss'
  if (!existingIds.includes(base)) return base
  let suffix = 2
  while (existingIds.includes(`${base}-${suffix}`)) suffix++
  return `${base}-${suffix}`
}

/**
 * Builds the shared GNSS UI state: persisted devices, reactive per-device status/fix maps mirrored from the
 * manager, and the actions the Sources UI calls into.
 * @returns {GnssState} The initialized state object.
 */
const createState = (): GnssState => {
  const isSupported = isElectron()
  const devices = useBlueOsStorage<GnssDevice[]>(gnssDevicesKey, [])
  const statuses = reactive<GnssState['statuses']>({})
  const latestFixes = reactive<GnssState['latestFixes']>({})
  const detecting = reactive<GnssState['detecting']>({})
  const availablePorts = ref<string[]>([])

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

  const refreshPorts = async (): Promise<void> => {
    availablePorts.value = await listSerialPorts()
  }

  const connectDevice = async (id: string): Promise<void> => {
    const device = findDevice(id)
    if (!isSupported || !device || !device.port) return
    device.enabled = true
    await startGnssDevice(device)
    logUserAction(`Connected GNSS "${device.name}" on ${device.port} at ${device.baud} baud`)
  }

  const disconnectDevice = async (id: string): Promise<void> => {
    const device = findDevice(id)
    if (device) device.enabled = false
    await stopGnssDevice(id)
    logUserAction(`Disconnected GNSS "${device?.name ?? id}"`)
  }

  const addDevice = (): GnssDevice => {
    const name = `GNSS ${devices.value.length + 1}`
    const id = generateDeviceId(
      name,
      devices.value.map((device) => device.id)
    )
    const device: GnssDevice = { id, name, port: '', baud: defaultBaudRate, enabled: false }
    devices.value.push(device)
    if (isSupported) registerDeviceVariables(device)
    logUserAction(`Added GNSS device "${name}"`)
    return device
  }

  const removeDevice = async (id: string): Promise<void> => {
    const device = findDevice(id)
    logUserAction(`Removed GNSS device "${device?.name ?? id}"`)
    await stopGnssDevice(id)
    deleteDeviceVariables(id)
    clearSerialLines(id)
    forgetDeviceState(id)
    const index = devices.value.findIndex((entry) => entry.id === id)
    if (index !== -1) devices.value.splice(index, 1)
    delete statuses[id]
    delete latestFixes[id]
    delete detecting[id]
  }

  const autodetect = async (id: string): Promise<number | null> => {
    const device = findDevice(id)
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
    statuses,
    latestFixes,
    detecting,
    availablePorts,
    isSupported,
    refreshPorts,
    addDevice,
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
