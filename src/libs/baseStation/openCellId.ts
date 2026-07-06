import type { CachedOpenCellIdSite, CoverageBbox } from '@/types/baseStation'
import type { WaypointCoordinates } from '@/types/mission'

import {
  openCellIdCoverageBboxAround,
  sortCoverageBboxesByDistance,
  tiledCoverageBboxes,
  unionCoverageBboxes,
} from './coverageBbox'

// The `getInArea` endpoint caps a single call at roughly 4 km², so the requested area is split
// into tiles that fit under it.
const OPENCELLID_TILE_HALF_SIDE_KM = 0.95
const OPENCELLID_FOREGROUND_TILE_COUNT = 9
const OPENCELLID_TILE_FETCH_CONCURRENCY = 4

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

/* eslint-disable jsdoc/require-jsdoc -- Inline result shape; field names are self-describing. */
export type OpenCellIdFetchResult = {
  sites: OpenCellIdSite[]
  fetchedBbox: CoverageBbox
}
/* eslint-enable jsdoc/require-jsdoc */

const fetchOpenCellIdTileInElectron = async (bbox: CoverageBbox, apiKey: string): Promise<OpenCellIdSite[]> => {
  const cells = await window.electronAPI?.fetchNearbyOpenCellIdCells({
    west: bbox.west,
    south: bbox.south,
    east: bbox.east,
    north: bbox.north,
    apiKey,
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
 * Fetch OpenCellID sites covering the area around `center`. Splits the area into tiles sized to
 * fit the endpoint's per-call limit and runs them concurrently through the Electron bridge that
 * gets around browser CORS. Standalone only: the API key cannot be set in a Lite build.
 * @param {WaypointCoordinates} center Center coordinate.
 * @param {string} apiKey Trimmed OpenCellID API key. Required: the endpoint rejects keyless calls.
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
  const tiles = tiledCoverageBboxes(coverageArea, lat, OPENCELLID_TILE_HALF_SIDE_KM)
  const selectedTiles = sortCoverageBboxesByDistance(center, tiles).slice(0, OPENCELLID_FOREGROUND_TILE_COUNT)
  // The Electron IPC bridge can't be cancelled mid-call, so reject any tile not yet
  // dispatched once the caller aborts.
  const tileFetcher = (bbox: CoverageBbox): Promise<OpenCellIdSite[]> =>
    signal.aborted
      ? Promise.reject(new DOMException('Aborted', 'AbortError'))
      : fetchOpenCellIdTileInElectron(bbox, apiKey)
  const settled = await mapWithConcurrency(selectedTiles, OPENCELLID_TILE_FETCH_CONCURRENCY, tileFetcher)
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
