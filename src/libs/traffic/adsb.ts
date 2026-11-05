import type { Message } from '@/libs/connection/m2r/messages/mavlink2rest-message'
import { isUsableTrafficPosition, knotsToMps } from '@/libs/traffic/traffic'
import type { AdsbLolAircraft, TrafficContact } from '@/types/traffic'

// MAVLink ADSB_FLAGS bits marking which optional fields carry data.
const ADSB_FLAGS_VALID_COORDS = 1
const ADSB_FLAGS_VALID_ALTITUDE = 2
const ADSB_FLAGS_VALID_HEADING = 4
const ADSB_FLAGS_VALID_VELOCITY = 8
const ADSB_FLAGS_VALID_CALLSIGN = 16

const METERS_PER_FOOT = 0.3048

// The ICAO 24-bit address, in the lowercase hex every ADS-B feed and lookup site writes it in.
const icaoHex = (address: number): string => (address >>> 0).toString(16).padStart(6, '0')

const decodeCallsign = (chars: number[]): string | undefined =>
  String.fromCharCode(...chars.filter((char) => char > 0)).trim() || undefined

let selfChecked = false

/**
 * Converts a MAVLink ADSB_VEHICLE report from the vehicle's own receiver into a contact, dropping the fields its
 * flags mark unset.
 * @param {Message.AdsbVehicle} message The report as decoded from MAVLink
 * @param {number} receivedAtMs Epoch milliseconds the report arrived at
 * @returns {TrafficContact | null} The aircraft, or null when the report carries no usable position
 */
export const parseAdsbVehicle = (message: Message.AdsbVehicle, receivedAtMs: number): TrafficContact | null => {
  runSelfCheckOnce()
  const bits = message.flags?.bits ?? 0
  const has = (flag: number): boolean => (bits & flag) !== 0
  if (!has(ADSB_FLAGS_VALID_COORDS)) return null

  const latitude = message.lat / 1e7
  const longitude = message.lon / 1e7
  if (!isUsableTrafficPosition(latitude, longitude)) return null

  return {
    kind: 'aircraft',
    key: icaoHex(message.ICAO_address),
    callsign: has(ADSB_FLAGS_VALID_CALLSIGN) ? decodeCallsign(message.callsign ?? []) : undefined,
    latitude,
    longitude,
    // ADS-B broadcasts the track an aircraft is making good, not where its nose points.
    courseDeg: has(ADSB_FLAGS_VALID_HEADING) ? message.heading / 100 : undefined,
    speedMps: has(ADSB_FLAGS_VALID_VELOCITY) ? message.hor_velocity / 100 : undefined,
    altitudeMeters: has(ADSB_FLAGS_VALID_ALTITUDE) ? message.altitude / 1000 : undefined,
    lastHeardAtMs: receivedAtMs - Math.max(0, message.tslc) * 1000,
  }
}

/**
 * Converts one aircraft from an adsb.lol point query into a contact, in the units the map draws.
 * @param {AdsbLolAircraft} aircraft The aircraft as the feed reports it
 * @param {number} receivedAtMs Epoch milliseconds the query answered at
 * @returns {TrafficContact | null} The aircraft, or null when it is not identified or has no usable position
 */
export const parseAdsbLolAircraft = (aircraft: AdsbLolAircraft, receivedAtMs: number): TrafficContact | null => {
  runSelfCheckOnce()
  const { hex, lat: latitude, lon: longitude } = aircraft
  if (!hex || typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!isUsableTrafficPosition(latitude, longitude)) return null

  // Geometric altitude is the one above mean sea level; the barometric one stands in when the aircraft omits it, and
  // reads `ground` for an aircraft that has not taken off.
  const altitudeFeet = aircraft.alt_geom ?? (typeof aircraft.alt_baro === 'number' ? aircraft.alt_baro : undefined)

  return {
    kind: 'aircraft',
    key: hex.toLowerCase(),
    name: aircraft.r?.trim() || undefined,
    callsign: aircraft.flight?.trim() || undefined,
    latitude,
    longitude,
    courseDeg: aircraft.track,
    headingDeg: aircraft.true_heading,
    speedMps: aircraft.gs === undefined ? undefined : knotsToMps(aircraft.gs),
    altitudeMeters: altitudeFeet === undefined ? undefined : altitudeFeet * METERS_PER_FOOT,
    lastHeardAtMs: receivedAtMs - Math.max(0, aircraft.seen ?? 0) * 1000,
  }
}

// Runs once, on the first report of a development session, after bootstrap has installed `assert`.
const runSelfCheckOnce = (): void => {
  // @ts-ignore: import.meta.env does not exist in the types
  if (selfChecked || !import.meta.env.DEV) return
  selfChecked = true

  const report = {
    ICAO_address: 0xe48ca1,
    lat: -275935000,
    lon: -485585400,
    altitude: 1500000,
    heading: 9050,
    hor_velocity: 12000,
    tslc: 3,
    flags: { bits: ADSB_FLAGS_VALID_COORDS | ADSB_FLAGS_VALID_ALTITUDE | ADSB_FLAGS_VALID_CALLSIGN },
    callsign: [...'TAM3304\0\0'].map((char) => char.charCodeAt(0)),
  } as unknown as Message.AdsbVehicle
  const aircraft = parseAdsbVehicle(report, 10000)
  assert(aircraft?.key === 'e48ca1' && aircraft.latitude === -27.5935, 'The ICAO address and position must convert')
  assert(aircraft?.altitudeMeters === 1500 && aircraft.callsign === 'TAM3304', 'Altitude and callsign must be read')
  assert(aircraft?.courseDeg === undefined && aircraft?.speedMps === undefined, 'Fields flagged unset must be dropped')
  assert(aircraft?.lastHeardAtMs === 7000, 'The report age must push back when the aircraft was heard')
  assert(parseAdsbVehicle({ ...report, flags: { bits: 0 } }, 0) === null, 'A report without coordinates is rejected')

  const fetched = parseAdsbLolAircraft(
    { hex: 'E48CA1', flight: 'TAM3304 ', r: 'PR-GUH', lat: 10, lon: 20, alt_baro: 'ground', gs: 10, seen: 2 },
    5000
  )
  assert(fetched?.key === 'e48ca1' && fetched.name === 'PR-GUH', 'The fetched address must be cased as the hex key')
  assert(fetched?.callsign === 'TAM3304' && fetched.altitudeMeters === undefined, 'A grounded aircraft has no altitude')
  assert(Math.abs((fetched?.speedMps ?? 0) - 5.14444) < 1e-4, 'Fetched ground speed must convert from knots')
  assert(fetched?.lastHeardAtMs === 3000, 'A fetched aircraft was heard before the query answered')
}
