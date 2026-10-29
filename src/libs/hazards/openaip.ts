import type { GeoBbox } from '@/types/general'
import type { HazardArea, HazardFetchResult } from '@/types/hazards'
import type { WaypointCoordinates } from '@/types/mission'

const OPENAIP_AIRSPACES_URL = 'https://api.core.openaip.net/api/airspaces'

/** Airspace is dense over Europe; past this the picture is reported as partial. */
const MAX_AIRSPACES = 300

const FEET_TO_METERS = 0.3048
// A flight level is hundreds of feet on the standard pressure datum.
const FLIGHT_LEVEL_TO_METERS = 100 * FEET_TO_METERS

// openAIP encodes the unit and the reference datum of a vertical limit as integers.
const OpenAipUnit = { Meters: 0, Feet: 1, FlightLevel: 2 } as const
const OpenAipDatum = { Ground: 0, MeanSeaLevel: 1, StandardPressure: 2 } as const

/* eslint-disable jsdoc/require-jsdoc -- openAIP transport DTOs; fields mirror the upstream API. */
type OpenAipLimit = { value?: number; unit?: number; referenceDatum?: number }

type OpenAipAirspace = {
  _id?: string
  name?: string
  type?: number
  icaoClass?: number
  activity?: number
  country?: string
  onDemand?: boolean
  onRequest?: boolean
  byNotam?: boolean
  specialAgreement?: boolean
  requestCompliance?: boolean
  frequencies?: { value?: string; name?: string }[]
  geometry?: { type?: string; coordinates?: number[][][] }
  lowerLimit?: OpenAipLimit
  upperLimit?: OpenAipLimit
}

type OpenAipResponse = { items?: OpenAipAirspace[] } | OpenAipAirspace[]
/* eslint-enable jsdoc/require-jsdoc */

// Ground-referenced limits are heights above terrain, and turning one into a sea-level altitude
// needs an elevation this module does not have, so they are left unknown rather than made up.
const limitToMetersAmsl = (limit: OpenAipLimit | undefined): number | undefined => {
  if (limit?.value === undefined || !Number.isFinite(limit.value)) return undefined
  if (limit.referenceDatum === OpenAipDatum.Ground) return undefined
  if (limit.unit === OpenAipUnit.Feet) return limit.value * FEET_TO_METERS
  if (limit.unit === OpenAipUnit.FlightLevel) return limit.value * FLIGHT_LEVEL_TO_METERS
  if (limit.unit === OpenAipUnit.Meters) return limit.value
  return undefined
}

const AIRSPACE_TYPES = [
  'Other airspace',
  'Restricted area',
  'Danger area',
  'Prohibited area',
  'Control zone (CTR)',
  'Transponder mandatory zone (TMZ)',
  'Radio mandatory zone (RMZ)',
  'Terminal control area (TMA)',
  'Temporary reserved area (TRA)',
  'Temporary segregated area (TSA)',
  'Flight information region (FIR)',
  'Upper flight information region (UIR)',
  'Air defense identification zone (ADIZ)',
  'Aerodrome traffic zone (ATZ)',
  'Military aerodrome traffic zone (MATZ)',
  'Airway',
  'Military training route (MTR)',
  'Alert area',
  'Warning area',
  'Protected area',
  'Helicopter traffic zone (HTZ)',
  'Gliding sector',
  'Transponder setting area (TRP)',
  'Traffic information zone (TIZ)',
  'Traffic information area (TIA)',
  'Military training area (MTA)',
  'Control area (CTA)',
  'ACC sector',
  'Aerial sporting or recreational activity',
  'Low altitude overflight restriction',
  'Military route (MRT)',
  'TSA/TRA feeding route (TFR)',
  'VFR sector',
  'FIS sector',
  'Lower traffic area (LTA)',
  'Upper traffic area (UTA)',
  'Military control zone (MCTR)',
]

const ICAO_CLASSES: Record<number, string> = {
  0: 'ICAO class A',
  1: 'ICAO class B',
  2: 'ICAO class C',
  3: 'ICAO class D',
  4: 'ICAO class E',
  5: 'ICAO class F',
  6: 'ICAO class G',
  8: 'Special use airspace',
}

const ACTIVITIES: Record<number, string> = {
  1: 'Parachuting',
  2: 'Aerobatics',
  3: 'Aeroclub activity',
  4: 'Ultralight flying',
  5: 'Hang gliding and paragliding',
}

const DATUM_NAMES: Record<number, string> = {
  [OpenAipDatum.Ground]: 'above ground',
  [OpenAipDatum.MeanSeaLevel]: 'above sea level',
  [OpenAipDatum.StandardPressure]: 'standard pressure',
}

const formatLimit = (limit: OpenAipLimit | undefined): string | undefined => {
  if (limit?.value === undefined) return undefined
  if (limit.unit === OpenAipUnit.FlightLevel) return `FL ${limit.value}`
  if (limit.value === 0 && limit.referenceDatum === OpenAipDatum.Ground) return 'ground'
  const unit = limit.unit === OpenAipUnit.Feet ? 'ft' : 'm'
  return `${limit.value} ${unit} ${DATUM_NAMES[limit.referenceDatum ?? -1] ?? ''}`.trim()
}

const airspaceDetails = (airspace: OpenAipAirspace): string[] => {
  const lower = formatLimit(airspace.lowerLimit)
  const upper = formatLimit(airspace.upperLimit)
  const icaoClass = ICAO_CLASSES[airspace.icaoClass ?? -1]
  const flags: [boolean | undefined, string][] = [
    [airspace.byNotam, 'Activated by NOTAM'],
    [airspace.onDemand, 'Active on demand'],
    [airspace.onRequest, 'Entry on request'],
    [airspace.specialAgreement, 'Special agreement applies'],
    [airspace.requestCompliance, 'Compliance must be requested'],
  ]
  return [
    ...(airspace.type !== undefined ? [AIRSPACE_TYPES[airspace.type] ?? `Airspace type ${airspace.type}`] : []),
    ...(icaoClass ? [icaoClass] : []),
    ...(lower || upper ? [`From ${lower ?? 'unknown'} to ${upper ?? 'unknown'}`] : []),
    ...(ACTIVITIES[airspace.activity ?? -1] ? [ACTIVITIES[airspace.activity ?? -1]] : []),
    ...flags.filter(([set]) => set).map(([, text]) => text),
    ...(airspace.frequencies ?? [])
      .filter((frequency) => frequency.value)
      .map((frequency) => `Radio ${frequency.value}${frequency.name ? ` (${frequency.name})` : ''}`),
    ...(airspace.country ? [`Country: ${airspace.country}`] : []),
  ]
}

const toArea = (airspace: OpenAipAirspace, index: number): HazardArea | null => {
  const ring = airspace.geometry?.coordinates?.[0]
  if (!Array.isArray(ring)) return null

  const coordinates = ring
    .filter((position): position is number[] => Array.isArray(position) && position.length >= 2)
    .map<WaypointCoordinates>(([lng, lat]) => [lat, lng])

  // openAIP closes its rings; Cockpit's areas keep the closing vertex implicit.
  const last = coordinates[coordinates.length - 1]
  if (coordinates.length > 3 && coordinates[0][0] === last[0] && coordinates[0][1] === last[1]) coordinates.pop()
  if (coordinates.length < 3) return null

  return {
    id: `airspace:${airspace._id ?? index}`,
    sourceId: 'airspace',
    kind: 'polygon',
    coordinates,
    label: airspace.name?.trim() || 'Unnamed airspace',
    lowerLimitM: limitToMetersAmsl(airspace.lowerLimit),
    upperLimitM: limitToMetersAmsl(airspace.upperLimit),
    details: airspaceDetails(airspace),
  }
}

/**
 * Raised when openAIP rejected the key, so the caller can point the operator at the settings field
 * instead of showing a bare HTTP status.
 */
export class OpenAipAuthError extends Error {}

/**
 * Fetches airspace areas from openAIP for a bounding box. The result is advisory: openAIP is a
 * contributor-maintained database, and it carries no temporary restrictions.
 * @param {GeoBbox} bbox Area to query.
 * @param {string} apiKey The operator's personal openAIP key.
 * @param {AbortSignal} signal Cancellation signal.
 * @returns {Promise<HazardFetchResult>} Airspace areas for the queried box.
 */
export const fetchAirspaceHazards = async (
  bbox: GeoBbox,
  apiKey: string,
  signal: AbortSignal
): Promise<HazardFetchResult> => {
  if (!apiKey) {
    throw new OpenAipAuthError('Add your openAIP key from the cog beside "Restricted airspace" to load airspace.')
  }

  const url = new URL(OPENAIP_AIRSPACES_URL)
  url.searchParams.set('bbox', [bbox.west, bbox.south, bbox.east, bbox.north].join(','))
  url.searchParams.set('limit', String(MAX_AIRSPACES + 1))

  // A cross-origin request the browser refuses rejects with a bare TypeError that names neither the
  // host nor the reason, which would reach the operator as "Failed to fetch".
  let response: Response
  try {
    response = await fetch(url, { headers: { 'x-openaip-api-key': apiKey }, signal })
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') throw error
    throw new Error(
      'openAIP did not answer. The topside computer may be offline, or openAIP may be limiting requests; ' +
        'try again in a minute.'
    )
  }

  if (response.status === 401 || response.status === 403) {
    throw new OpenAipAuthError('openAIP rejected the key. Check it from the cog beside "Restricted airspace".')
  }
  if (!response.ok) throw new Error(`openAIP HTTP ${response.status}`)

  const payload = (await response.json()) as OpenAipResponse
  const items = Array.isArray(payload) ? payload : payload.items ?? []
  const found = items
    .map((airspace, index) => toArea(airspace, index))
    .filter((area): area is HazardArea => area !== null)

  return {
    sourceId: 'airspace',
    bbox,
    fetchedAtMs: Date.now(),
    areas: found.slice(0, MAX_AIRSPACES),
    truncated: found.length > MAX_AIRSPACES,
  }
}
