import { isElectron } from '@/libs/utils'
import type { CachedOpenCellIdSite, CoverageBbox } from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

import {
  openCellIdCoverageBboxAround,
  sortCoverageBboxesByDistance,
  tiledCoverageBboxes,
  unionCoverageBboxes,
} from './coverageBbox'

// Keyed browser endpoint caps at ~4 km²; standalone's no-key ajax endpoint rejects around 25 km²,
// so we use smaller tiles on Lite and larger ones on standalone.
const OPENCELLID_KEYED_TILE_HALF_SIDE_KM = 0.95
const OPENCELLID_KEYED_FOREGROUND_TILE_COUNT = 9
const OPENCELLID_LITE_TILE_HALF_SIDE_KM = 1
const OPENCELLID_STANDALONE_TILE_HALF_SIDE_KM = 2
const OPENCELLID_STANDALONE_FOREGROUND_TILE_COUNT = 1

export type OpenCellIdSite = CachedOpenCellIdSite

/**
 * Detect upstream error messages that signal a bad/missing OpenCellID API key so the caller can
 * mark the key as invalid instead of treating the failure as a generic network error.
 * @param {string} message Upstream error message.
 * @returns {boolean} true when the message looks like an auth failure.
 */
export const isOpenCellIdInvalidApiKeyError = (message: string): boolean =>
  /invalid.*key|api key.*invalid|missing.*key|key required|unauthorized|forbidden/i.test(message)

/**
 * `Promise.allSettled`-style mapper bounded by `concurrency`.
 * @param {T[]} items Inputs.
 * @param {number} concurrency Max in-flight workers.
 * @param {(item: T) => Promise<R>} mapper Per-item async mapper.
 * @returns {Promise<PromiseSettledResult<R>[]>} Settled results, in input order.
 */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
  const settled: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++
      try {
        settled[currentIndex] = {
          status: 'fulfilled',
          value: await mapper(items[currentIndex]),
        }
      } catch (error) {
        settled[currentIndex] = {
          status: 'rejected',
          reason: error,
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return settled
}

/* eslint-disable jsdoc/require-jsdoc -- Inline transport DTOs; field meanings follow upstream docs. */
type OpenCellIdResponse = {
  cells?: Array<{
    lat: number
    lon: number
    range?: number
    radio?: string
    mcc?: number
    mnc?: number
    lac?: number
    cellid?: number
    samples?: number
    averageSignalStrength?: number
  }>
  error?: string
  code?: number
}

export type OpenCellIdFetchResult = {
  sites: OpenCellIdSite[]
  fetchedBbox: CoverageBbox
}
/* eslint-enable jsdoc/require-jsdoc */

const fetchOpenCellIdTile = async (
  bbox: CoverageBbox,
  apiKey: string,
  signal: AbortSignal
): Promise<OpenCellIdSite[]> => {
  const url =
    `https://opencellid.org/cell/getInArea?key=${encodeURIComponent(apiKey)}` +
    `&BBOX=${bbox.south},${bbox.west},${bbox.north},${bbox.east}` +
    `&format=json&limit=50`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`OpenCellID HTTP ${res.status}`)
  const data = (await res.json()) as OpenCellIdResponse
  // `code: 1` ("No cells found") is HTTP 200 + an `error` field; treat as empty, not failure.
  if (data.error && data.code !== 1) throw new Error(`OpenCellID: ${data.error}`)
  return (data.cells ?? []).map<OpenCellIdSite>((c) => ({
    lat: c.lat,
    lon: c.lon,
    rangeMeters: c.range ?? 1000,
    radio: c.radio,
    mcc: c.mcc,
    mnc: c.mnc,
    lac: c.lac,
    cellId: c.cellid,
    samples: c.samples,
    averageSignalStrength: c.averageSignalStrength,
  }))
}

const fetchOpenCellIdTileInElectron = async (bbox: CoverageBbox, apiKey: string): Promise<OpenCellIdSite[]> => {
  const cells = await window.electronAPI?.fetchNearbyOpenCellIdCells({
    west: bbox.west,
    south: bbox.south,
    east: bbox.east,
    north: bbox.north,
    apiKey: apiKey || undefined,
  })
  if (!cells) throw new Error('OpenCellID standalone bridge unavailable')
  return cells.map<OpenCellIdSite>((c) => ({
    lat: c.lat,
    lon: c.lon,
    rangeMeters: c.range ?? 1000,
    radio: c.radio,
    mcc: c.mcc,
    mnc: c.mnc,
    lac: c.lac,
    cellId: c.cellId,
    samples: c.samples,
    averageSignalStrength: c.averageSignalStrength,
  }))
}

/**
 * Fetch OpenCellID sites covering the area around `center`. Splits the area into tiles
 * sized to fit each backend's per-call limit (keyed browser, Lite no-key, standalone
 * Electron bridge) and runs them concurrently.
 * @param {WaypointCoordinates} center Center coordinate.
 * @param {string} apiKey Trimmed OpenCellID API key, or empty for keyless mode.
 * @param {AbortSignal} signal Cancellation signal.
 * @returns {Promise<OpenCellIdFetchResult>} Deduped sites and the union of the fetched tiles.
 */
export const fetchOpenCellIdSites = async (
  center: WaypointCoordinates,
  apiKey: string,
  signal: AbortSignal
): Promise<OpenCellIdFetchResult> => {
  const [lat, lng] = center
  const coverageArea = openCellIdCoverageBboxAround(lat, lng)
  const usesApiKey = apiKey.trim().length > 0
  const tileHalfSideKm = usesApiKey
    ? OPENCELLID_KEYED_TILE_HALF_SIDE_KM
    : isElectron()
    ? OPENCELLID_STANDALONE_TILE_HALF_SIDE_KM
    : OPENCELLID_LITE_TILE_HALF_SIDE_KM
  const tiles = tiledCoverageBboxes(coverageArea, lat, tileHalfSideKm)
  const selectedTiles = usesApiKey
    ? sortCoverageBboxesByDistance(center, tiles).slice(0, OPENCELLID_KEYED_FOREGROUND_TILE_COUNT)
    : isElectron()
    ? sortCoverageBboxesByDistance(center, tiles).slice(0, OPENCELLID_STANDALONE_FOREGROUND_TILE_COUNT)
    : tiles
  const tileFetcher = isElectron()
    ? (bbox: CoverageBbox) => fetchOpenCellIdTileInElectron(bbox, apiKey)
    : (bbox: CoverageBbox) => fetchOpenCellIdTile(bbox, apiKey, signal)
  const settled = await mapWithConcurrency(selectedTiles, usesApiKey ? 4 : isElectron() ? 2 : 4, tileFetcher)
  const fulfilled = settled.filter((r): r is PromiseFulfilledResult<OpenCellIdSite[]> => r.status === 'fulfilled')
  // If every tile failed, surface the first error so the operator gets a real diagnostic
  // (invalid key, network down, …) instead of a silent empty heatmap.
  if (fulfilled.length === 0) {
    const firstReject = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (firstReject) throw firstReject.reason
  }
  const uniqueSites = new Map<string, OpenCellIdSite>()
  for (const site of fulfilled.flatMap((r) => r.value)) {
    const key = `${site.lat.toFixed(6)}:${site.lon.toFixed(6)}:${Math.round(site.rangeMeters)}`
    if (!uniqueSites.has(key)) uniqueSites.set(key, site)
  }
  return {
    sites: [...uniqueSites.values()],
    fetchedBbox: unionCoverageBboxes(selectedTiles),
  }
}
