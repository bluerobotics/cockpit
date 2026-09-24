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

/**
 * Runs an Overpass QL query against the public API. Ways and relations only carry their coordinates
 * when the query ends in `out geom;`; `out body;` returns node references the caller would have to
 * resolve in a second round trip.
 * @param {string} query Full Overpass QL query, including its settings header and `out` statement.
 * @param {AbortSignal} signal Cancellation signal.
 * @returns {Promise<OverpassElement[]>} Matched elements, empty when the query matched nothing.
 */
export const runOverpassQuery = async (query: string, signal: AbortSignal): Promise<OverpassElement[]> => {
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    signal,
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
  const data = (await res.json()) as OverpassResponse
  return data.elements ?? []
}
