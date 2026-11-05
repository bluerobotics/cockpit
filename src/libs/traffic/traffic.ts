import {
  createDataLakeVariable,
  deleteDataLakeVariable,
  getDataLakeVariableInfo,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'
import type { DataLakeVariableType } from '@/types/data-lake'
import type { TrafficContact, TrafficKind } from '@/types/traffic'

const STALE_AFTER_MS: Record<TrafficKind, number> = {
  // Airborne ADS-B is broadcast every second or two, so a minute of silence means the aircraft is gone or out of range.
  aircraft: 60 * 1000,
  // Class A vessels report every few seconds and anchored ones every few minutes.
  vessel: 10 * 60 * 1000,
}

const DATA_LAKE_GROUP: Record<TrafficKind, string> = { aircraft: 'aircraft', vessel: 'vessels' }

// A wide search over a busy region answers with over a thousand aircraft, which the map can draw but the data lake
// cannot hold a variable per field of without the catalog itself becoming the cost.
const MAX_MIRRORED_CONTACTS = 100

// Deliberately not reactive: a busy harbour or a flight corridor reports many times a second, and both the map and
// the data lake read it on their own schedule.
const contacts = new Map<string, TrafficContact>()

/* eslint-disable jsdoc/require-jsdoc -- Shape of one mirrored field, described by its own entries below. */
interface TrafficMirrorField {
  suffix: string
  type: DataLakeVariableType
  unit?: string
  description: string
  read: (contact: TrafficContact) => string | number | undefined
}
/* eslint-enable jsdoc/require-jsdoc */

const mirrorFields: TrafficMirrorField[] = [
  { suffix: 'latitude', type: 'number', unit: 'deg', description: 'Latitude of the contact.', read: (c) => c.latitude },
  {
    suffix: 'longitude',
    type: 'number',
    unit: 'deg',
    description: 'Longitude of the contact.',
    read: (c) => c.longitude,
  },
  {
    suffix: 'heading',
    type: 'number',
    unit: 'deg',
    description: 'True heading of the contact, or its course over ground when it broadcasts no heading.',
    read: (c) => c.headingDeg ?? c.courseDeg,
  },
  {
    suffix: 'speed',
    type: 'number',
    unit: 'm/s',
    description: 'Speed of the contact over ground.',
    read: (c) => c.speedMps,
  },
  {
    suffix: 'altitude',
    type: 'number',
    unit: 'm',
    description: 'Altitude of the contact above mean sea level.',
    read: (c) => c.altitudeMeters,
  },
  {
    suffix: 'name',
    type: 'string',
    description: 'Name, registration or callsign the contact broadcasts.',
    read: (c) => c.name ?? c.callsign,
  },
]

const MPS_PER_KNOT = 0.514444

/**
 * Converts a speed over ground as the traffic feeds broadcast it into the units the contacts are kept in.
 * @param {number} knots The speed, in knots
 * @returns {number} The same speed, in meters per second
 */
export const knotsToMps = (knots: number): number => knots * MPS_PER_KNOT

/**
 * Whether a reported position can be drawn, which both ADS-B and AIS encode an unavailable one outside of.
 * @param {number} latitude Latitude, in degrees
 * @param {number} longitude Longitude, in degrees
 * @returns {boolean} True when both coordinates are finite and inside their range
 */
export const isUsableTrafficPosition = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180

const registryKey = (contact: TrafficContact): string => `${contact.kind}/${contact.key}`

const dataLakePrefix = (contact: TrafficContact): string => `/traffic/${DATA_LAKE_GROUP[contact.kind]}/${contact.key}`

const definedFieldsOf = (contact: TrafficContact): Partial<TrafficContact> =>
  Object.fromEntries(Object.entries(contact).filter(([, value]) => value !== undefined)) as Partial<TrafficContact>

// ponytail: the first contacts heard take the slots, since ranking them by distance would need the vehicle position
// down here. Mirroring only the contacts a consumer asked for would lift the cap altogether.
const mirroredContacts = new Set<string>()

const mirrorToDataLake = (contact: TrafficContact): void => {
  const key = registryKey(contact)
  // Creating or deleting a variable notifies every listener of the catalog, and each plotter and expression input
  // rebuilds its whole variable list from that, so a busy corridor must not reach them one aircraft at a time.
  if (!mirroredContacts.has(key)) {
    if (mirroredContacts.size >= MAX_MIRRORED_CONTACTS) return
    mirroredContacts.add(key)
  }

  const prefix = dataLakePrefix(contact)
  const label = contact.kind === 'aircraft' ? `Aircraft ${contact.key.toUpperCase()}` : `Vessel ${contact.key}`

  mirrorFields.forEach((field) => {
    const value = field.read(contact)
    if (value === undefined) return
    const id = `${prefix}/${field.suffix}`
    if (getDataLakeVariableInfo(id) === undefined) {
      createDataLakeVariable({
        id,
        name: `${label} ${field.suffix}`,
        type: field.type,
        unit: field.unit,
        description: field.description,
      })
    }
    setDataLakeVariableData(id, value)
  })
}

const removeFromDataLake = (contact: TrafficContact): void => {
  if (!mirroredContacts.delete(registryKey(contact))) return

  const prefix = dataLakePrefix(contact)
  mirrorFields.forEach((field) => {
    const id = `${prefix}/${field.suffix}`
    if (getDataLakeVariableInfo(id) !== undefined) deleteDataLakeVariable(id)
  })
}

/**
 * Records a report of an aircraft or a vessel, and mirrors what it says into the data lake.
 * @param {TrafficContact} contact The contact as last reported
 * @returns {void}
 */
export const upsertTrafficContact = (contact: TrafficContact): void => {
  const key = registryKey(contact)
  const known = contacts.get(key)
  // A report carries only the fields its source flagged as valid, so what one leaves out keeps the value it last had
  // rather than dropping out of the tooltip and off the marker's heading. Every contact states when it was heard.
  const merged = known === undefined ? contact : { ...known, ...definedFieldsOf(contact) }

  contacts.set(key, merged)
  mirrorToDataLake(merged)
}

/**
 * The contacts of one kind heard so far, newest report per craft.
 * @param {TrafficKind} kind Whether to list aircraft or vessels
 * @returns {TrafficContact[]} The contacts, one per craft
 */
export const currentTrafficContacts = (kind: TrafficKind): TrafficContact[] =>
  [...contacts.values()].filter((contact) => contact.kind === kind)

/**
 * Forgets the contacts gone silent for longer than their kind is expected to stay quiet, taking their data lake
 * variables with them.
 * @param {number} nowMs Epoch milliseconds to measure the silence against
 * @returns {void}
 */
export const pruneStaleTrafficContacts = (nowMs: number = Date.now()): void => {
  contacts.forEach((contact, key) => {
    if (nowMs - contact.lastHeardAtMs <= STALE_AFTER_MS[contact.kind]) return
    contacts.delete(key)
    removeFromDataLake(contact)
  })
}

/**
 * How the contact should be named wherever the operator reads it.
 * @param {TrafficContact} contact The contact to name
 * @returns {string} Its name, callsign, or the identifier it broadcasts
 */
export const trafficContactLabel = (contact: TrafficContact): string =>
  contact.name ??
  contact.callsign ??
  (contact.kind === 'aircraft' ? `ICAO ${contact.key.toUpperCase()}` : `MMSI ${contact.key}`)
