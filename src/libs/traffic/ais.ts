import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { isUsableTrafficPosition, knotsToMps } from '@/libs/traffic/traffic'
import type { AisStreamReport, TrafficContact } from '@/types/traffic'

// MAVLink AIS_FLAGS bits marking which optional fields carry data.
const AIS_FLAGS_VALID_COG = 2
const AIS_FLAGS_VALID_VELOCITY = 4
const AIS_FLAGS_VALID_CALLSIGN = 2048
const AIS_FLAGS_VALID_NAME = 4096
const UNKNOWN_HEADING_CDEG = 36000

// Values AIS itself reserves for a field a vessel is not reporting.
const UNKNOWN_COURSE_DEG = 360
const UNKNOWN_TRUE_HEADING_DEG = 511
const UNKNOWN_SPEED_KNOTS = 102.3

const reported = (value: number | undefined, unavailable: number): number | undefined =>
  value !== undefined && value < unavailable ? value : undefined

// AIS pads text fields with `@`, and MAVLink pads the array with NULs.
const trimAisText = (text: string): string | undefined => text.replace(/@+$/, '').trim() || undefined

const decodeText = (chars: number[]): string | undefined =>
  trimAisText(String.fromCharCode(...chars.filter((char) => char > 0)))

let selfChecked = false

/**
 * Converts a MAVLink AIS_VESSEL report from the vehicle's own receiver into a contact, dropping the fields its flags
 * mark unset.
 * @param {Message.AisVessel} message The report as decoded from MAVLink
 * @param {number} receivedAtMs Epoch milliseconds the report arrived at
 * @returns {TrafficContact | null} The vessel, or null when the report carries no usable position
 */
export const parseAisVessel = (message: Message.AisVessel, receivedAtMs: number): TrafficContact | null => {
  runSelfCheckOnce()
  // AIS encodes an unavailable position as 91° latitude and 181° longitude.
  const latitude = message.lat / 1e7
  const longitude = message.lon / 1e7
  if (!isUsableTrafficPosition(latitude, longitude)) return null

  const bits = message.flags?.bits ?? 0
  const has = (flag: number): boolean => (bits & flag) !== 0
  return {
    kind: 'vessel',
    key: String(message.MMSI),
    name: has(AIS_FLAGS_VALID_NAME) ? decodeText(message.name ?? []) : undefined,
    callsign: has(AIS_FLAGS_VALID_CALLSIGN) ? decodeText(message.callsign ?? []) : undefined,
    latitude,
    longitude,
    courseDeg: has(AIS_FLAGS_VALID_COG) ? message.COG / 100 : undefined,
    headingDeg: message.heading < UNKNOWN_HEADING_CDEG ? message.heading / 100 : undefined,
    speedMps: has(AIS_FLAGS_VALID_VELOCITY) ? message.velocity / 100 : undefined,
    lastHeardAtMs: receivedAtMs - Math.max(0, message.tslc) * 1000,
  }
}

/**
 * Converts one aisstream.io report into a contact. Position and identity arrive in separate reports, each carrying
 * the envelope that says which vessel and where, so both kinds are read for whatever they hold.
 * @param {AisStreamReport} report The report as received over the stream
 * @param {number} receivedAtMs Epoch milliseconds the report arrived at
 * @returns {TrafficContact | null} The vessel, or null when the report names no vessel or no usable position
 */
export const parseAisStreamReport = (report: AisStreamReport, receivedAtMs: number): TrafficContact | null => {
  runSelfCheckOnce()
  const { MMSI: mmsi, latitude, longitude, ShipName: shipName } = report.MetaData ?? {}
  if (typeof mmsi !== 'number' || typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!isUsableTrafficPosition(latitude, longitude)) return null

  const position = report.Message?.PositionReport
  const identity = report.Message?.ShipStaticData
  const speedKnots = reported(position?.Sog, UNKNOWN_SPEED_KNOTS)

  return {
    kind: 'vessel',
    key: String(mmsi),
    name: trimAisText(identity?.Name ?? shipName ?? ''),
    callsign: trimAisText(identity?.CallSign ?? ''),
    latitude,
    longitude,
    courseDeg: reported(position?.Cog, UNKNOWN_COURSE_DEG),
    headingDeg: reported(position?.TrueHeading, UNKNOWN_TRUE_HEADING_DEG),
    speedMps: speedKnots === undefined ? undefined : knotsToMps(speedKnots),
    lastHeardAtMs: receivedAtMs,
  }
}

// Runs once, on the first report of a development session, after bootstrap has installed `assert`.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  const report = {
    MMSI: 123456789,
    lat: -275935000,
    lon: -485585400,
    COG: 9050,
    heading: UNKNOWN_HEADING_CDEG,
    velocity: 250,
    tslc: 2,
    flags: { bits: AIS_FLAGS_VALID_COG | AIS_FLAGS_VALID_NAME },
    name: [...'BLUE BOAT@@@'].map((char) => char.charCodeAt(0)),
    callsign: [...'PX1234'].map((char) => char.charCodeAt(0)),
  } as unknown as Message.AisVessel
  const vessel = parseAisVessel(report, 10000)
  assert(vessel?.latitude === -27.5935 && vessel.courseDeg === 90.5, 'AIS positions and course must convert to degrees')
  assert(vessel?.name === 'BLUE BOAT', 'AIS padding must be stripped from the vessel name')
  assert(vessel?.callsign === undefined && vessel?.speedMps === undefined, 'Fields flagged unset must be dropped')
  assert(vessel?.headingDeg === undefined && vessel?.lastHeardAtMs === 8000, 'Unknown heading and report age must hold')
  assert(parseAisVessel({ ...report, lat: 910000000 }, 0) === null, 'An unavailable position must be rejected')

  const streamed = parseAisStreamReport(
    {
      MetaData: { MMSI: 987654321, latitude: 10, longitude: 20, ShipName: 'STREAMED@@' },
      Message: { PositionReport: { Cog: UNKNOWN_COURSE_DEG, Sog: 10, TrueHeading: 42 } },
    },
    5000
  )
  assert(streamed?.name === 'STREAMED' && streamed.headingDeg === 42, 'Streamed name and heading must be read')
  assert(streamed?.courseDeg === undefined, 'A course the vessel is not reporting must be dropped')
  assert(Math.abs((streamed?.speedMps ?? 0) - 5.14444) < 1e-4, 'Streamed speed must convert from knots')
  assert(parseAisStreamReport({ MetaData: { latitude: 10, longitude: 20 } }, 0) === null, 'A report needs an MMSI')
}
