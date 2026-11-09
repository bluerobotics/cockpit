import { t } from 'ttag'

import type { WaypointCoordinates } from '@/types/mission'

import { type TerrainProfileSample, legLengthM } from './mission-profile'

/**
 * Water level at one moment.
 */
export interface WaterLevelPoint {
  /**
   * Moment, in milliseconds since the epoch.
   */
  timeMs: number
  /**
   * Water level relative to mean sea level, in meters.
   */
  levelM: number
}

/**
 * Smallest water under the keel along a route for one departure time.
 */
export interface DepartureClearance {
  /**
   * Departure time, in milliseconds since the epoch.
   */
  departureMs: number
  /**
   * Smallest water under the keel anywhere along the route, in meters, null when unknown.
   */
  minUnderKeelM: number | null
}

/**
 * A tide station the predictions can be read for.
 */
export interface TideStation {
  /**
   * Service id, as `source/id`, such as `noaa/9414290` or `ticon/brest-822-fra-uhslc_fd`.
   */
  id: string
  /**
   * Place name.
   */
  name: string
  /**
   * Station position.
   */
  coordinates: WaypointCoordinates
  /**
   * Credit the station's data licence requires wherever its predictions are shown.
   */
  attribution: string
}

/**
 * One mission start time the tide chart colors.
 */
export interface TideChartStart {
  /**
   * Start time, in milliseconds since the epoch.
   */
  timeMs: number
  /**
   * Strip color.
   */
  color: string
  /**
   * How the mission goes when started then, such as "0.4 m under the keel".
   */
  text: string
}

/**
 * A high or low tide.
 */
export interface TideExtreme extends WaterLevelPoint {
  /**
   * Whether it is a high tide.
   */
  high: boolean
}

const FETCH_TIMEOUT_MS = 15000
const TIDE_API_URL = 'https://api.openwaters.io/tides'

/**
 * Station fields read from the tide service.
 */
interface TideServiceStation {
  /**
   * Service id.
   */
  id?: unknown
  /**
   * Place name.
   */
  name?: unknown
  /**
   * Tide or current station.
   */
  kind?: unknown
  /**
   * Latitude, in degrees.
   */
  latitude?: unknown
  /**
   * Longitude, in degrees.
   */
  longitude?: unknown
  /**
   * Licence credit.
   */
  attribution?: unknown
  /**
   * Licence terms.
   */
  license?: {
    /**
     * False for stations whose data may not be used commercially.
     */
    commercial_use?: unknown
  }
  /**
   * Quality review.
   */
  quality?: {
    /**
     * False for gauges the database rejected.
     */
    accepted?: unknown
  }
}

const readTideService = async <T>(path: string, query: Record<string, string>): Promise<T> => {
  const url = `${TIDE_API_URL}${path}?${new URLSearchParams(query)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) {
    const reason = await response
      .json()
      .then((body) => (typeof body?.message === 'string' ? body.message : ''))
      .catch(() => '')
    throw new Error(reason || t`The tide service answered HTTP ${response.status}.`)
  }
  return (await response.json()) as T
}

const tideStation = (station: TideServiceStation): TideStation | null => {
  const { id, name, kind, latitude, longitude, attribution, license, quality } = station
  if (typeof id !== 'string' || typeof name !== 'string' || kind !== 'tide') return null
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (license?.commercial_use === false || quality?.accepted === false) return null
  return {
    id,
    name,
    coordinates: [latitude, longitude],
    attribution: typeof attribution === 'string' ? attribution : '',
  }
}

/**
 * Tide stations around a position, nearest first, leaving out those whose data may not be used commercially.
 * @param {WaypointCoordinates} position Where to search around.
 * @param {number} maxDistanceKm Search radius, in kilometers.
 * @returns {Promise<TideStation[]>} The stations.
 */
export const fetchTideStations = async (
  position: WaypointCoordinates,
  maxDistanceKm: number
): Promise<TideStation[]> => {
  const [latitude, longitude] = position
  const body = await readTideService<unknown>('/stations', {
    latitude: String(latitude),
    longitude: String(longitude),
    maxDistance: String(maxDistanceKm),
    maxResults: '20',
  })
  if (!Array.isArray(body)) throw new Error(t`The tide service sent no station list.`)
  return body
    .map((station: TideServiceStation) => tideStation(station))
    .filter((station): station is TideStation => station !== null)
    .sort((a, b) => legLengthM(position, a.coordinates) - legLengthM(position, b.coordinates))
}

/**
 * Fetches a station's tide predictions, relative to mean sea level, every ten minutes.
 * @param {string} stationId Service id, as `source/id`.
 * @param {number} fromMs First moment, in milliseconds since the epoch.
 * @param {number} toMs Last moment, in milliseconds since the epoch.
 * @returns {Promise<{ station: TideStation | null, predictions: WaterLevelPoint[] }>} The station and its predictions.
 */
export const fetchTidePredictions = async (
  stationId: string,
  fromMs: number,
  toMs: number
): Promise<{
  /**
   * The station read, null when the service did not describe it.
   */
  station: TideStation | null
  /**
   * Predictions in time order.
   */
  predictions: WaterLevelPoint[]
}> => {
  const path = stationId.split('/').map(encodeURIComponent).join('/')
  const body = await readTideService<{
    /**
     * The station read.
     */
    station?: TideServiceStation
    /**
     * Predicted levels.
     */
    timeline?: {
      /**
       * Moment, as ISO 8601.
       */
      time?: unknown
      /**
       * Level, in meters above mean sea level.
       */
      level?: unknown
    }[]
  }>(`/stations/${path}/timeline`, {
    start: new Date(fromMs).toISOString(),
    end: new Date(toMs).toISOString(),
    datum: 'MSL',
    units: 'meters',
  })
  if (!Array.isArray(body.timeline)) throw new Error(t`The tide service sent no predictions.`)
  const predictions = body.timeline
    .map(({ time, level }) => ({ timeMs: typeof time === 'string' ? Date.parse(time) : NaN, levelM: Number(level) }))
    .filter((point) => Number.isFinite(point.timeMs) && Number.isFinite(point.levelM))
  if (predictions.length === 0) throw new Error(t`The tide service sent no usable predictions.`)
  return { station: body.station ? tideStation(body.station) : null, predictions }
}

/**
 * High and low tides between two moments.
 * @param {WaterLevelPoint[]} predictions Predictions in time order.
 * @param {number} fromMs First moment.
 * @param {number} toMs Last moment.
 * @returns {TideExtreme[]} The turning points, in time order.
 */
export const tideExtremes = (predictions: WaterLevelPoint[], fromMs: number, toMs: number): TideExtreme[] =>
  predictions.slice(1, -1).flatMap((point, index): TideExtreme[] => {
    if (point.timeMs < fromMs || point.timeMs > toMs) return []
    const before = predictions[index].levelM
    const after = predictions[index + 2].levelM
    // Strict on one side only, so a flat top two samples wide still counts once.
    if (point.levelM > before && point.levelM >= after) return [{ ...point, high: true }]
    if (point.levelM < before && point.levelM <= after) return [{ ...point, high: false }]
    return []
  })

/**
 * Water level at a moment, interpolated between predictions.
 * @param {WaterLevelPoint[]} predictions Predictions in time order.
 * @param {number} timeMs Moment to read.
 * @returns {number | null} The level, or null outside the predictions.
 */
export const waterLevelAt = (predictions: WaterLevelPoint[], timeMs: number): number | null => {
  if (predictions.length === 0 || timeMs < predictions[0].timeMs || timeMs > predictions.at(-1)!.timeMs) return null
  let low = 0
  let high = predictions.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (predictions[middle].timeMs <= timeMs) low = middle
    else high = middle
  }
  const before = predictions[low]
  const after = predictions[high]
  const span = after.timeMs - before.timeMs
  return span === 0 ? before.levelM : before.levelM + ((after.levelM - before.levelM) * (timeMs - before.timeMs)) / span
}

/**
 * Smallest water under the keel along a route for a range of departure times, reading the tide at
 * the moment the vessel reaches each point rather than at departure.
 * @param {TerrainProfileSample[]} samples Route stations.
 * @param {WaterLevelPoint[]} predictions Tide predictions.
 * @param {number} speedMs Cruise speed, in meters per second.
 * @param {number} draftM Hull depth below the waterline.
 * @param {number} stepMs Time between departures tried.
 * @returns {DepartureClearance[]} One entry per departure time.
 */
export const departureClearances = (
  samples: TerrainProfileSample[],
  predictions: WaterLevelPoint[],
  speedMs: number,
  draftM: number,
  stepMs = 15 * 60 * 1000
): DepartureClearance[] => {
  if (predictions.length < 2 || speedMs <= 0) return []
  const durationMs = ((samples.at(-1)?.distanceM ?? 0) / speedMs) * 1000
  const first = predictions[0].timeMs
  const last = predictions.at(-1)!.timeMs - durationMs
  const stride = Math.max(1, Math.ceil(samples.length / 400))
  const route = samples.filter((_, index) => index % stride === 0)
  const departures: DepartureClearance[] = []
  for (let departureMs = first; departureMs <= last; departureMs += stepMs) {
    let minUnderKeelM: number | null = null
    for (const sample of route) {
      const level = waterLevelAt(predictions, departureMs + (sample.distanceM / speedMs) * 1000)
      if (level === null || sample.groundHighM === null) continue
      const underKeel = level - sample.groundHighM - draftM
      if (minUnderKeelM === null || underKeel < minUnderKeelM) minUnderKeelM = underKeel
    }
    departures.push({ departureMs, minUnderKeelM })
  }
  return departures
}
