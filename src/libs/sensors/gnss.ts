/**
 * Orchestrates one or more external USB/serial NMEA GNSS receivers and publishes their data into the data
 * lake.
 *
 * This module is Electron-only: it reuses the existing serial byte pipeline exposed on
 * `window.electronAPI` (`linkOpen`/`onLinkData`/`linkClose`, backed by the `serialport` package in the
 * main process) to stream raw bytes, decodes them with {@link NmeaAggregator}, and mirrors the resulting
 * {@link GnssFix} into per-device `external/positioning/gnss/<id>/*` variables. It has no Vue dependencies; reactive
 * orchestration lives in the `useGnss` composable.
 */

import {
  createDataLakeVariable,
  DataLakeVariable,
  deleteDataLakeVariable,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
  updateDataLakeVariableInfo,
} from '@/libs/actions/data-lake'
import { NmeaAggregator, parseNmeaSentence } from '@/libs/sensors/nmea'
import { settingsManager } from '@/libs/settings-management'
import { isElectron } from '@/libs/utils'
import type {
  GnssDevice,
  GnssDeviceInfo,
  GnssDeviceRuntime,
  GnssDeviceState,
  GnssDeviceStateListener,
  GnssField,
  GnssFix,
  GnssStatus,
  SerialLineEvent,
} from '@/types/gnss'
import type { SerialPortInfo } from '@/types/serial'

/** Baud rates offered in the UI, ordered by likelihood for consumer GNSS receivers. */
export const commonBaudRates = [9600, 4800, 38400, 19200, 57600, 115200]

/** Default baud rate, matching the most common consumer GNSS default. */
export const defaultBaudRate = 9600

/** Persistence key for the configured GNSS devices. */
export const gnssDevicesKey = 'cockpit-gnss-devices'

/** Field definitions published per device, shared by variable registration and value publishing. */
export const gnssFields: GnssField[] = [
  {
    suffix: 'latitude',
    label: 'Latitude',
    type: 'number',
    description: 'Latitude in decimal degrees.',
    read: (f) => f.latitude,
  },
  {
    suffix: 'longitude',
    label: 'Longitude',
    type: 'number',
    description: 'Longitude in decimal degrees.',
    read: (f) => f.longitude,
  },
  {
    suffix: 'altitude-msl',
    label: 'Altitude (MSL)',
    type: 'number',
    description: 'Altitude above mean sea level, in meters.',
    read: (f) => f.altitudeMslM,
  },
  {
    suffix: 'geoid-separation',
    label: 'Geoid separation',
    type: 'number',
    description: 'Geoidal separation, in meters.',
    read: (f) => f.geoidSeparationM,
  },
  {
    suffix: 'satellites-used',
    label: 'Satellites used',
    type: 'number',
    description: 'Satellites used in the position solution.',
    read: (f) => f.satellitesUsed,
  },
  {
    suffix: 'satellites-in-view',
    label: 'Satellites in view',
    type: 'number',
    description: 'Satellites currently in view.',
    read: (f) => f.satellitesInView,
  },
  {
    suffix: 'fix-quality',
    label: 'Fix quality',
    type: 'number',
    description: 'GGA fix quality code (0 none, 1 GNSS, 2 DGPS, 4 RTK fixed, 5 RTK float).',
    read: (f) => f.fixQuality,
  },
  {
    suffix: 'fix-quality-label',
    label: 'Fix quality label',
    type: 'string',
    description: 'Human-readable fix quality.',
    read: (f) => f.fixQualityLabel,
  },
  {
    suffix: 'fix-mode',
    label: 'Fix mode',
    type: 'number',
    description: 'GSA fix mode (1 none, 2 = 2D, 3 = 3D).',
    read: (f) => f.fixMode,
  },
  {
    suffix: 'hdop',
    label: 'HDOP',
    type: 'number',
    description: 'Horizontal dilution of precision.',
    read: (f) => f.hdop,
  },
  {
    suffix: 'pdop',
    label: 'PDOP',
    type: 'number',
    description: 'Positional dilution of precision.',
    read: (f) => f.pdop,
  },
  {
    suffix: 'vdop',
    label: 'VDOP',
    type: 'number',
    description: 'Vertical dilution of precision.',
    read: (f) => f.vdop,
  },
  {
    suffix: 'speed-over-ground',
    label: 'Speed over ground',
    type: 'number',
    description: 'Speed over ground, in meters per second.',
    read: (f) => f.speedOverGroundMps,
  },
  {
    suffix: 'course-over-ground',
    label: 'Course over ground',
    type: 'number',
    description: 'Course over ground, in degrees.',
    read: (f) => f.courseOverGroundDeg,
  },
  {
    suffix: 'utc-time',
    label: 'UTC time',
    type: 'string',
    description: 'UTC time of the last position report.',
    read: (f) => f.utcTime,
  },
]

const noDataTimeoutMs = 5000
// Delay after closing a probed port before opening the next, giving the OS time to release the device.
const probeSettleMs = 300
const validSentenceThreshold = 3
const maxSerialLines = 2000

const pathHandlers = new Map<string, (bytes: number[]) => void>()
const runtimes = new Map<string, GnssDeviceRuntime>()
const deviceStatuses = new Map<string, GnssStatus>()
const deviceFixes = new Map<string, GnssFix>()
const stateListeners = new Set<GnssDeviceStateListener>()
const serialLineBuffers = new Map<string, SerialLineEvent[]>()
const serialLineListeners = new Map<string, Set<(event: SerialLineEvent) => void>>()

let listenerRegistered = false
let serialLineIdCounter = 0

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const notifyDeviceState = (deviceId: string): void => {
  const state: GnssDeviceState = {
    status: deviceStatuses.get(deviceId) ?? 'disconnected',
    fix: deviceFixes.get(deviceId),
  }
  stateListeners.forEach((listener) => listener(deviceId, state))
}

/**
 * Returns a device's current connection status.
 * @param {string} deviceId - The device id.
 * @returns {GnssStatus} The current status.
 */
export const getDeviceStatus = (deviceId: string): GnssStatus => deviceStatuses.get(deviceId) ?? 'disconnected'

/**
 * Returns a device's latest consolidated fix, if any.
 * @param {string} deviceId - The device id.
 * @returns {GnssFix | undefined} The latest fix, or undefined when no data has been received.
 */
export const getLatestFix = (deviceId: string): GnssFix | undefined => deviceFixes.get(deviceId)

/**
 * Subscribes to per-device status and fix changes.
 * @param {GnssDeviceStateListener} listener - Called whenever a device's status or fix changes.
 * @returns {() => void} An unsubscribe function.
 */
export const subscribeToDeviceState = (listener: GnssDeviceStateListener): (() => void) => {
  stateListeners.add(listener)
  return () => stateListeners.delete(listener)
}

/**
 * Maps a connection status to a display color.
 * @param {GnssStatus} status - The connection status.
 * @returns {string} The corresponding color name.
 */
export const gnssStatusColor = (status: GnssStatus): string => {
  switch (status) {
    case 'connected':
      return 'success'
    case 'connecting':
    case 'no-data':
      return 'warning'
    default:
      return 'grey'
  }
}

/**
 * Maps a connection status to a display icon.
 * @param {GnssStatus} status - The connection status.
 * @returns {string} The corresponding mdi icon name.
 */
export const gnssStatusIcon = (status: GnssStatus): string => {
  switch (status) {
    case 'connected':
      return 'mdi-check-circle'
    case 'connecting':
      return 'mdi-progress-clock'
    case 'no-data':
      return 'mdi-alert-circle'
    default:
      return 'mdi-circle-outline'
  }
}

/**
 * Maps a connection status to a human-readable label.
 * @param {GnssStatus} status - The connection status.
 * @returns {string} The label.
 */
export const gnssStatusLabel = (status: GnssStatus): string => (status === 'no-data' ? 'connected (no data)' : status)

const recordSerialLine = (deviceId: string, line: string): void => {
  const msg = line.replace(/\r$/, '').trim()
  if (!msg) return
  serialLineIdCounter += 1
  const event: SerialLineEvent = { id: serialLineIdCounter, epoch: Date.now(), msg }
  let buffer = serialLineBuffers.get(deviceId)
  if (!buffer) {
    buffer = []
    serialLineBuffers.set(deviceId, buffer)
  }
  buffer.push(event)
  if (buffer.length > maxSerialLines) buffer.shift()
  serialLineListeners.get(deviceId)?.forEach((listener) => listener(event))
}

/**
 * Returns the recently captured raw serial lines for a device.
 * @param {string} deviceId - The device id.
 * @returns {SerialLineEvent[]} A copy of the device's recent serial lines.
 */
export const getRecentSerialLines = (deviceId: string): SerialLineEvent[] =>
  (serialLineBuffers.get(deviceId) ?? []).slice()

/**
 * Subscribes to raw serial lines received from a device.
 * @param {string} deviceId - The device id.
 * @param {(event: SerialLineEvent) => void} listener - Called for each new line.
 * @returns {() => void} An unsubscribe function.
 */
export const subscribeToSerialLines = (deviceId: string, listener: (event: SerialLineEvent) => void): (() => void) => {
  let set = serialLineListeners.get(deviceId)
  if (!set) {
    set = new Set()
    serialLineListeners.set(deviceId, set)
  }
  set.add(listener)
  return () => serialLineListeners.get(deviceId)?.delete(listener)
}

/**
 * Clears the captured serial line buffer for a device.
 * @param {string} deviceId - The device id.
 * @returns {void}
 */
export const clearSerialLines = (deviceId: string): void => {
  serialLineBuffers.delete(deviceId)
}

/**
 * Forgets a device's cached status and fix, notifying listeners of the reset.
 * @param {string} deviceId - The device id.
 * @returns {void}
 */
export const forgetDeviceState = (deviceId: string): void => {
  deviceStatuses.delete(deviceId)
  deviceFixes.delete(deviceId)
  notifyDeviceState(deviceId)
}

/**
 * Builds the data-lake variable id for a device field.
 * @param {string} deviceId - The device id.
 * @param {string} suffix - The field suffix.
 * @returns {string} The full variable id.
 */
export const deviceVariableId = (deviceId: string, suffix: string): string =>
  `external/positioning/gnss/${deviceId}/${suffix}`

/**
 * Builds the list of data-lake variables produced by a device.
 * @param {GnssDeviceInfo} device - The device to build variables for.
 * @returns {DataLakeVariable[]} The device's data-lake variables.
 */
export const gnssVariablesForDevice = (device: GnssDeviceInfo): DataLakeVariable[] =>
  gnssFields.map((field) => ({
    id: deviceVariableId(device.id, field.suffix),
    name: `${device.name} - ${field.label}`,
    type: field.type,
    description: field.description,
  }))

/**
 * Builds a serial URI that opens the given port at the given baud rate.
 *
 * POSIX ports (e.g. `/dev/ttyUSB0`) already start with a slash and become `serial:///dev/ttyUSB0`, while
 * Windows ports (e.g. `COM3`) become the opaque `serial:COM3`; both resolve to the correct `pathname` used
 * by the main-process `SerialLink`.
 * @param {string} port - The serial port path.
 * @param {number} baud - The baud rate.
 * @returns {string} The serial URI.
 */
const buildSerialUri = (port: string, baud: number): string => {
  const normalizedPort = port.startsWith('/') ? `//${port}` : port
  return `serial:${normalizedPort}?baudrate=${baud}`
}

const setStatus = (deviceId: string, status: GnssStatus): void => {
  if (deviceStatuses.get(deviceId) === status) return
  deviceStatuses.set(deviceId, status)
  notifyDeviceState(deviceId)
}

const publishDeviceFix = (deviceId: string, fix: GnssFix): void => {
  for (const field of gnssFields) {
    const value = field.read(fix)
    if (value !== undefined) setDataLakeVariableData(deviceVariableId(deviceId, field.suffix), value)
  }
}

/**
 * Registers (or refreshes the name of) a device's `external/positioning/gnss/<id>/*` variables in the data lake, so they
 * are discoverable (e.g. in POI editors) even before any data arrives.
 * @param {GnssDeviceInfo} device - The device to register variables for.
 * @returns {void}
 */
export const registerDeviceVariables = (device: GnssDeviceInfo): void => {
  for (const variable of gnssVariablesForDevice(device)) {
    if (getDataLakeVariableInfo(variable.id) === undefined) {
      createDataLakeVariable(variable)
    } else {
      updateDataLakeVariableInfo(variable)
    }
  }
}

/**
 * Removes a device's `external/positioning/gnss/<id>/*` variables from the data lake.
 * @param {string} deviceId - The device id.
 * @returns {void}
 */
export const deleteDeviceVariables = (deviceId: string): void => {
  for (const field of gnssFields) {
    const id = deviceVariableId(deviceId, field.suffix)
    if (getDataLakeVariableInfo(id) !== undefined) deleteDataLakeVariable(id)
  }
}

// A single `onLinkData` listener dispatches to the right per-path handler. `onLinkData` fires for every
// serial link (including MAVLink) and cannot be unsubscribed, so we register it once and keep the per-event
// work to a cheap Map lookup rather than adding a listener per device.
const ensureLinkListener = (): void => {
  if (listenerRegistered || !isElectron() || !window.electronAPI) return
  window.electronAPI.onLinkData((data) => {
    const handler = pathHandlers.get(data.path)
    if (handler) handler(data.data)
  })
  listenerRegistered = true
}

const stopWatchdog = (runtime: GnssDeviceRuntime): void => {
  if (runtime.watchdog === undefined) return
  clearInterval(runtime.watchdog)
  runtime.watchdog = undefined
}

const startWatchdog = (deviceId: string): void => {
  const runtime = runtimes.get(deviceId)
  if (!runtime) return
  stopWatchdog(runtime)
  runtime.watchdog = setInterval(() => {
    if (Date.now() - runtime.lastValidLineAt > noDataTimeoutMs) setStatus(deviceId, 'no-data')
  }, noDataTimeoutMs)
}

const handleDeviceBytes = (deviceId: string, bytes: number[]): void => {
  const runtime = runtimes.get(deviceId)
  if (!runtime) return
  runtime.buffer += runtime.decoder.decode(new Uint8Array(bytes), { stream: true })
  const lines = runtime.buffer.split('\n')
  runtime.buffer = lines.pop() ?? ''
  for (const line of lines) {
    recordSerialLine(deviceId, line)
    if (!runtime.aggregator.ingest(line)) continue
    runtime.lastValidLineAt = Date.now()
    const fix = runtime.aggregator.snapshot()
    deviceStatuses.set(deviceId, 'connected')
    deviceFixes.set(deviceId, fix)
    if (runtime.publish) publishDeviceFix(deviceId, fix)
    notifyDeviceState(deviceId)
  }
}

/**
 * Stops the reader for a device and closes its serial port, if open.
 * @param {string} deviceId - The device id.
 * @returns {Promise<void>} Resolves once the port is closed.
 */
export const stopGnssDevice = async (deviceId: string): Promise<void> => {
  const runtime = runtimes.get(deviceId)
  if (runtime) {
    stopWatchdog(runtime)
    pathHandlers.delete(runtime.path)
    runtimes.delete(deviceId)
    await window.electronAPI?.linkClose(runtime.path)
  }
  setStatus(deviceId, 'disconnected')
}

/**
 * Starts reading a device's GNSS receiver from its serial port.
 *
 * When `publish` is true (the default) the device's data-lake variables are registered and updated; pass
 * `publish: false` to preview an unsaved draft (parses and surfaces status/fix/serial lines without touching
 * the data lake).
 * @param {GnssDeviceInfo} device - The device to read from.
 * @param {boolean} [publish] - Whether to register/update data-lake variables (false to preview a draft).
 * @returns {Promise<void>} Resolves once the port is open.
 * @throws {Error} When not running in Electron, or when the port cannot be opened.
 */
export const startGnssDevice = async (device: GnssDeviceInfo, publish = true): Promise<void> => {
  if (!isElectron() || !window.electronAPI) {
    throw new Error('GNSS reading is only available in Cockpit Standalone.')
  }

  await stopGnssDevice(device.id)
  if (publish) registerDeviceVariables(device)
  ensureLinkListener()

  const resolvedPort = await resolveDevicePort(device)
  if (!resolvedPort) {
    setStatus(device.id, 'disconnected')
    throw new Error(`No matching serial port found for "${device.name}" on this machine.`)
  }

  const path = buildSerialUri(resolvedPort, device.baud)
  const runtime: GnssDeviceRuntime = {
    path,
    aggregator: new NmeaAggregator(),
    decoder: new TextDecoder(),
    buffer: '',
    publish,
    lastValidLineAt: Date.now(),
  }
  runtimes.set(device.id, runtime)
  setStatus(device.id, 'connecting')

  const opened = await window.electronAPI.linkOpen(path)
  if (!opened) {
    runtimes.delete(device.id)
    setStatus(device.id, 'disconnected')
    throw new Error(`Failed to open serial port ${resolvedPort}.`)
  }

  pathHandlers.set(path, (bytes) => handleDeviceBytes(device.id, bytes))
  setStatus(device.id, 'no-data')
  startWatchdog(device.id)
}

const stopDevicesOnPort = async (port: string): Promise<void> => {
  const portPrefix = buildSerialUri(port, 0).split('?')[0]
  const toStop = [...runtimes.entries()].filter(([, runtime]) => runtime.path.startsWith(portPrefix))
  for (const [deviceId] of toStop) {
    await stopGnssDevice(deviceId)
  }
}

/**
 * Probes a serial port at several baud rates and returns the first one that yields valid NMEA sentences.
 *
 * Any device currently reading from the same port is stopped first, since a serial port can only be opened
 * by one reader at a time.
 * @param {string} port - The serial port path to probe.
 * @param {number[]} [candidates] - The baud rates to try, in order.
 * @param {number} [perBaudMs] - How long to listen at each baud rate, in milliseconds.
 * @returns {Promise<number | null>} The detected baud rate, or null when none produced valid data.
 * @throws {Error} When not running in Electron.
 */
export const autodetectBaud = async (
  port: string,
  candidates: number[] = commonBaudRates,
  perBaudMs = 1500
): Promise<number | null> => {
  if (!isElectron() || !window.electronAPI) {
    throw new Error('GNSS reading is only available in Cockpit Standalone.')
  }

  await stopDevicesOnPort(port)
  ensureLinkListener()

  for (const baud of candidates) {
    const uri = buildSerialUri(port, baud)
    const probeDecoder = new TextDecoder()
    let buffer = ''
    let validCount = 0

    pathHandlers.set(uri, (bytes) => {
      buffer += probeDecoder.decode(new Uint8Array(bytes), { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (parseNmeaSentence(line)) validCount++
      }
    })

    const opened = await window.electronAPI.linkOpen(uri)
    if (!opened) {
      pathHandlers.delete(uri)
      continue
    }

    await sleep(perBaudMs)
    await window.electronAPI.linkClose(uri)
    pathHandlers.delete(uri)
    await sleep(probeSettleMs)

    if (validCount >= validSentenceThreshold) return baud
  }

  return null
}

/**
 * Lists the serial ports available on the system, including USB descriptors.
 * @returns {Promise<SerialPortInfo[]>} The available serial ports (empty when not in Electron).
 */
export const listSerialPorts = async (): Promise<SerialPortInfo[]> => {
  if (!isElectron() || !window.electronAPI) return []
  return window.electronAPI.serialListPorts()
}

/**
 * Resolves the serial port a device should open on this machine.
 *
 * Devices are matched by model (USB vendor + product id), so a same-model unit on another computer still
 * resolves. When no USB model is stored, or none of the connected ports match it, the last-selected path is
 * used only if it currently exists; otherwise the device cannot be resolved here.
 * @param {GnssDeviceInfo} device - The device to resolve a port for.
 * @returns {Promise<string | undefined>} The resolved port path, or undefined when none is available.
 */
export const resolveDevicePort = async (device: GnssDeviceInfo): Promise<string | undefined> => {
  const ports = await listSerialPorts()
  const { vendorId, productId } = device.usbMatch ?? {}

  if (vendorId && productId) {
    const matches = ports.filter((port) => port.vendorId === vendorId && port.productId === productId)
    if (matches.length === 1) return matches[0].path
    // Multiple identical-model devices: prefer the exact last-used path, else the first match.
    if (matches.length > 1) return (matches.find((port) => port.path === device.port) ?? matches[0]).path
  }

  return ports.find((port) => port.path === device.port)?.path
}

/**
 * Boots the GNSS reading pipeline: registers each configured device's data-lake variables and auto-connects
 * the enabled ones. Reads the persisted configuration directly (no Vue), so the data-lake posting works
 * independently of any UI being mounted. No-op outside Electron.
 * @returns {void}
 */
export const initGnss = (): void => {
  if (!isElectron()) return
  const devices = settingsManager.getKeyValue<GnssDevice[]>(gnssDevicesKey)
  if (!devices) return
  for (const device of devices) {
    registerDeviceVariables(device)
    if (device.enabled && device.port) {
      startGnssDevice(device).catch((error) => console.error('[GNSS] Failed to auto-connect:', error))
    }
  }
}
