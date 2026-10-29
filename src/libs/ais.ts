import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'

/**
 * One vessel as last reported over AIS, in the units the map draws.
 */
export interface AisVessel {
  /**
   * Maritime Mobile Service Identity, unique per vessel.
   */
  mmsi: number
  /**
   * Vessel name, when broadcast.
   */
  name?: string
  /**
   * Radio callsign, when broadcast.
   */
  callsign?: string
  /**
   * Latitude, in degrees.
   */
  latitude: number
  /**
   * Longitude, in degrees.
   */
  longitude: number
  /**
   * Course over ground, in degrees from true north, when broadcast.
   */
  courseDeg?: number
  /**
   * True heading, in degrees, when broadcast.
   */
  headingDeg?: number
  /**
   * Speed over ground, in meters per second, when broadcast.
   */
  speedMps?: number
  /**
   * Epoch milliseconds the vessel was last heard from, which predates the message by its reported age.
   */
  lastHeardAtMs: number
}

// MAVLink AIS_FLAGS bits marking which optional fields carry data.
const AIS_FLAGS_VALID_COG = 2
const AIS_FLAGS_VALID_VELOCITY = 4
const AIS_FLAGS_VALID_CALLSIGN = 2048
const AIS_FLAGS_VALID_NAME = 4096
const UNKNOWN_HEADING_CDEG = 36000

// AIS pads text fields with `@`, and MAVLink pads the array with NULs.
const decodeText = (chars: number[]): string | undefined =>
  String.fromCharCode(...chars.filter((char) => char > 0))
    .replace(/@+$/, '')
    .trim() || undefined

let selfChecked = false

/**
 * Converts a MAVLink AIS_VESSEL report into the map's units, dropping the fields its flags mark unset.
 * @param {Message.AisVessel} message The report as decoded from MAVLink.
 * @param {number} receivedAtMs Epoch milliseconds the report arrived at.
 * @returns {AisVessel | null} The vessel, or null when the report carries no usable position.
 */
export const parseAisVessel = (message: Message.AisVessel, receivedAtMs: number): AisVessel | null => {
  runSelfCheckOnce()
  // AIS encodes an unavailable position as 91° latitude and 181° longitude.
  const latitude = message.lat / 1e7
  const longitude = message.lon / 1e7
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    return null

  const bits = message.flags?.bits ?? 0
  const has = (flag: number): boolean => (bits & flag) !== 0
  return {
    mmsi: message.MMSI,
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
}
