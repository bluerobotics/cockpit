import type { Ref } from 'vue'

import type { DataLakeVariableType } from '@/libs/actions/data-lake'
import type { NmeaAggregator } from '@/libs/sensors/nmea'

/**
 * Consolidated GNSS state built from the most recent NMEA sentences.
 * Coordinates are only present when the receiver reports a valid fix.
 */
export interface GnssFix {
  /** Latitude in decimal degrees (positive north). Undefined when there is no fix. */
  latitude?: number
  /** Longitude in decimal degrees (positive east). Undefined when there is no fix. */
  longitude?: number
  /** Altitude above mean sea level, in meters. */
  altitudeMslM?: number
  /** Geoidal separation (difference between WGS-84 ellipsoid and mean sea level), in meters. */
  geoidSeparationM?: number
  /** Number of satellites used in the position solution. */
  satellitesUsed?: number
  /** Number of satellites currently in view. */
  satellitesInView?: number
  /** GGA fix quality (0 no fix, 1 GNSS, 2 DGPS, 4 RTK fixed, 5 RTK float, ...). */
  fixQuality?: number
  /** Human-readable label for {@link GnssFix.fixQuality}. */
  fixQualityLabel?: string
  /** GSA fix mode (1 no fix, 2 = 2D, 3 = 3D). */
  fixMode?: number
  /** Horizontal dilution of precision. */
  hdop?: number
  /** Positional (3D) dilution of precision. */
  pdop?: number
  /** Vertical dilution of precision. */
  vdop?: number
  /** Speed over ground, in meters per second. */
  speedOverGroundMps?: number
  /** Course over ground, in degrees. */
  courseOverGroundDeg?: number
  /** UTC time of the last position report (hhmmss.sss as reported by the receiver). */
  utcTime?: string
  /** Whether the receiver currently reports a valid position fix. */
  hasValidFix: boolean
}

/**
 * A single parsed NMEA sentence, split into its talker, type and data fields.
 */
export interface ParsedNmeaSentence {
  /** Talker id (e.g. `GP`, `GN`, `GL`). */
  talker: string
  /** Sentence type (e.g. `GGA`, `RMC`). */
  type: string
  /** Comma-separated data fields following the header, in order. */
  fields: string[]
}

/**
 * Connection status of a single GNSS reader.
 */
export type GnssStatus = 'disconnected' | 'connecting' | 'connected' | 'no-data'

/**
 * The subset of a device's configuration needed to open and identify its serial stream.
 */
export interface GnssDeviceInfo {
  /** Machine-friendly id, used as the data-lake variable namespace. */
  id: string
  /** User-facing device name. */
  name: string
  /** Serial port path (e.g. /dev/ttyUSB0 or COM3). */
  port: string
  /** Baud rate to open the port at. */
  baud: number
}

/**
 * Persisted configuration for a single GNSS device.
 */
export interface GnssDevice extends GnssDeviceInfo {
  /** Whether the device should auto-connect and be actively read. */
  enabled: boolean
}

/**
 * A device's current runtime state, surfaced to reactive consumers.
 */
export interface GnssDeviceState {
  /** The device's current connection status. */
  status: GnssStatus
  /** The device's latest consolidated fix, when any data has been received. */
  fix?: GnssFix
}

/**
 * Listener notified whenever a device's status or latest fix changes.
 */
export type GnssDeviceStateListener = (deviceId: string, state: GnssDeviceState) => void

/**
 * Definition of a single GNSS field published to the data lake.
 */
export interface GnssField {
  /** Variable id suffix appended after the device namespace. */
  suffix: string
  /** Human-readable label for the field. */
  label: string
  /** Data-lake variable type. */
  type: DataLakeVariableType
  /** Variable description. */
  description: string
  /** Extracts the field value from a consolidated fix. */
  read: (fix: GnssFix) => string | number | undefined
}

/**
 * A single raw serial line captured for debugging, in a shape compatible with the console viewer.
 */
export interface SerialLineEvent {
  /** Monotonic id, used as a stable key for virtualized rendering. */
  id: number
  /** Time the line was received (epoch ms). */
  epoch: number
  /** The raw line content. */
  msg: string
}

/**
 * Per-device runtime state for an active serial reader.
 */
export interface GnssDeviceRuntime {
  /** The serial URI currently open for this device. */
  path: string
  /** The NMEA aggregator building this device's consolidated fix. */
  aggregator: NmeaAggregator
  /** Per-device text decoder, kept isolated so streamed multi-byte sequences don't corrupt other devices. */
  decoder: TextDecoder
  /** Partial line buffer for bytes not yet terminated by a newline. */
  buffer: string
  /** Timestamp (ms) of the last valid NMEA sentence received. */
  lastValidLineAt: number
  /** Handle of the no-data watchdog interval, when running. */
  watchdog?: ReturnType<typeof setInterval>
}

/**
 * Shared reactive state and actions for the GNSS feature.
 */
export interface GnssState {
  /** Persisted device configurations. */
  devices: Ref<GnssDevice[]>
  /** Per-device connection status, keyed by device id. */
  statuses: Record<string, GnssStatus>
  /** Per-device latest consolidated fix, keyed by device id. */
  latestFixes: Record<string, GnssFix | undefined>
  /** Per-device auto-detection flag, keyed by device id. */
  detecting: Record<string, boolean>
  /** Serial ports available on the system. */
  availablePorts: Ref<string[]>
  /** Whether the current environment supports the feature (Electron only). */
  isSupported: boolean
  /** Refreshes the list of available serial ports. */
  refreshPorts: () => Promise<void>
  /** Adds a new (disconnected) device and returns it. */
  addDevice: () => GnssDevice
  /** Removes a device, closing its connection and deleting its data-lake variables. */
  removeDevice: (id: string) => Promise<void>
  /** Connects a device using its current port and baud rate. */
  connectDevice: (id: string) => Promise<void>
  /** Disconnects a device. */
  disconnectDevice: (id: string) => Promise<void>
  /** Auto-detects the baud rate for a device's port, applying it on success. */
  autodetect: (id: string) => Promise<number | null>
}
