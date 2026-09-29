import type { GeoBbox } from '@/types/general'

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'

/* eslint-disable jsdoc/require-jsdoc -- Overpass transport DTOs; fields mirror the upstream API. */
export type OverpassGeometryPoint = { lat: number; lon: number }

export type OverpassRelationMember = { type?: string; role?: string; geometry?: OverpassGeometryPoint[] }

export type OverpassElement = {
  type?: string
  id?: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
  geometry?: OverpassGeometryPoint[]
  members?: OverpassRelationMember[]
}

type OverpassResponse = { elements?: OverpassElement[] }
/* eslint-enable jsdoc/require-jsdoc */

/**
 * Formats a bounding box as the `(south,west,north,east)` filter Overpass QL appends to a selector.
 * @param {GeoBbox} bbox Area to restrict the query to.
 * @returns {string} The Overpass QL bbox filter, parentheses included.
 */
export const overpassRegion = (bbox: GeoBbox): string => `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`

// The public instance answers 429 when a client is over its quota and 504 when a request waited too
// long for a free query slot; both clear up on their own after a short pause.
const BUSY_STATUSES = [429, 504]
const BUSY_RETRY_DELAY_MS = 5000

// The public instance gives each client only a couple of query slots, and requests queued behind
// them time out, so queries from every caller are sent one at a time.
let queryQueue: Promise<unknown> = Promise.resolve()

const pause = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true }
    )
  })

// Comfortably past the server-side limit the queries themselves carry, so only a connection that
// stalled hits it. Without it a stalled request would hold the queue, and every caller behind it.
const QUERY_DEADLINE_MS = 60000

type QueryAnswer = {
  /**
   * HTTP status the server answered with.
   */
  status: number
  /**
   * Matched elements, only present when the server answered successfully.
   */
  elements?: OverpassElement[]
}

// The body is read inside the deadline too, since a connection can stall after the headers arrive.
const postQuery = async (query: string, signal: AbortSignal): Promise<QueryAnswer> => {
  // A query cancelled while it waited in the queue would otherwise still go out, since an abort
  // listener added to an already aborted signal never fires.
  signal.throwIfAborted()
  const controller = new AbortController()
  const abortFromCaller = (): void => controller.abort(signal.reason)
  signal.addEventListener('abort', abortFromCaller, { once: true })
  const deadline = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), QUERY_DEADLINE_MS)
  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: controller.signal,
    })
    if (!res.ok) return { status: res.status }
    const data = (await res.json()) as OverpassResponse
    return { status: res.status, elements: data.elements ?? [] }
  } catch (error) {
    if ((error as DOMException)?.name === 'TimeoutError') {
      throw new Error('the OpenStreetMap server did not answer in time')
    }
    throw error
  } finally {
    clearTimeout(deadline)
    signal.removeEventListener('abort', abortFromCaller)
  }
}

const sendQuery = async (query: string, signal: AbortSignal): Promise<OverpassElement[]> => {
  let answer = await postQuery(query, signal)
  if (BUSY_STATUSES.includes(answer.status)) {
    await pause(BUSY_RETRY_DELAY_MS, signal)
    answer = await postQuery(query, signal)
  }
  if (BUSY_STATUSES.includes(answer.status)) throw new Error('the OpenStreetMap server is busy, try again in a minute')
  if (!answer.elements) throw new Error(`the OpenStreetMap server answered with error ${answer.status}`)
  return answer.elements
}

/**
 * Runs an Overpass QL query against the public API, after any query already in flight, retrying once
 * when the server reports it is busy. Ways and relations only carry their coordinates when the query
 * ends in `out geom;`; `out body;` returns node references the caller would have to resolve in a
 * second round trip.
 * @param {string} query Full Overpass QL query, including its settings header and `out` statement.
 * @param {AbortSignal} signal Cancellation signal.
 * @returns {Promise<OverpassElement[]>} Matched elements, empty when the query matched nothing.
 */
export const runOverpassQuery = (query: string, signal: AbortSignal): Promise<OverpassElement[]> => {
  const run = queryQueue.then(() => sendQuery(query, signal))
  queryQueue = run.catch(() => undefined)
  return run
}
