import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import { datalogger, DatalogVariable } from '@/libs/sensors-logging'
import { findDataLakeVariablesIdsInString } from '@/libs/utils-data-lake'

/**
 * Maps each predefined video-overlay telemetry variable to the MAVLink message/field(s) that carry the
 * same measurement.
 *
 * Overlay variables are vehicle-store values rendered as formatted strings (with units); the data-lake
 * equivalents are the raw, base-unit MAVLink fields, which is what a raw data log should contain. Each
 * field is later expanded into a full `/mavlink/<systemId>/1/<message>/<field>` ID. Instantaneous power
 * is derived (voltage × current), so it maps to both source fields instead of a single value. Overlay
 * variables with no data-lake source (Mission name, Time, Date) are intentionally omitted.
 */
const overlayVariableToMavlinkFields: Partial<Record<DatalogVariable, string[]>> = {
  [DatalogVariable.roll]: ['ATTITUDE/roll'],
  [DatalogVariable.pitch]: ['ATTITUDE/pitch'],
  [DatalogVariable.heading]: ['ATTITUDE/yaw'],
  [DatalogVariable.depth]: ['AHRS2/altitude'],
  [DatalogVariable.mode]: ['HEARTBEAT/custom_mode'],
  [DatalogVariable.batteryVoltage]: ['SYS_STATUS/voltage_battery'],
  [DatalogVariable.batteryCurrent]: ['SYS_STATUS/current_battery'],
  [DatalogVariable.gpsVisibleSatellites]: ['GPS_RAW_INT/satellites_visible'],
  [DatalogVariable.gpsFixType]: ['GPS_RAW_INT/fix_type'],
  [DatalogVariable.latitude]: ['GLOBAL_POSITION_INT/lat'],
  [DatalogVariable.longitude]: ['GLOBAL_POSITION_INT/lon'],
  [DatalogVariable.instantaneousPower]: ['SYS_STATUS/voltage_battery', 'SYS_STATUS/current_battery'],
}

const datalogVariableNames = new Set<string>(Object.values(DatalogVariable))

/**
 * Resolve the main vehicle's MAVLink system ID, falling back to the default (1) when no vehicle has
 * been seen yet (e.g. on a fresh first run before any heartbeat arrives).
 * @returns {number} The main vehicle system ID
 */
const mainVehicleSystemId = (): number => {
  const systemId = Number(getDataLakeVariableData('autopilotSystemId'))
  return Number.isFinite(systemId) && systemId > 0 ? systemId : 1
}

/**
 * Resolve one video-overlay grid entry to the data-lake variable IDs it should record.
 *
 * Overlay entries come in three shapes: predefined telemetry names (e.g. "Roll"), custom messages with
 * `{{ id }}` templates, and data-lake variable IDs dragged in directly.
 * @param {string} entry - A single overlay grid entry
 * @param {number} systemId - The main vehicle system ID used to build predefined MAVLink IDs
 * @returns {string[]} The data-lake variable IDs the entry maps to (empty when it has no equivalent)
 */
const overlayEntryToDataLakeIds = (entry: string, systemId: number): string[] => {
  const trimmedEntry = entry.trim()
  if (trimmedEntry.length === 0) return []

  if (datalogVariableNames.has(trimmedEntry)) {
    const mavlinkFields = overlayVariableToMavlinkFields[trimmedEntry as DatalogVariable] ?? []
    return mavlinkFields.map((field) => `/mavlink/${systemId}/1/${field}`)
  }

  const templateIds = findDataLakeVariablesIdsInString(trimmedEntry)
  if (templateIds.length > 0) return templateIds

  return [trimmedEntry]
}

/**
 * Collect every data-lake variable ID referenced by the current video-overlay configuration. Used to
 * seed the data lake recording list on first run so logging is useful out of the box.
 * @returns {string[]} Unique data-lake variable IDs, in overlay order
 */
export const collectOverlayRecordedVariableIds = (): string[] => {
  const systemId = mainVehicleSystemId()
  const ids = Object.values(datalogger.telemetryDisplayData)
    .flat()
    .flatMap((entry) => overlayEntryToDataLakeIds(entry, systemId))

  return [...new Set(ids)]
}
