import { createHash } from 'crypto'
import { ipcMain } from 'electron'

import type { NearbyOpenCellIdCell, OpenCellIdBboxRequest } from '../../types/baseStation'

/* eslint-disable jsdoc/require-jsdoc -- Internal OpenCellID DTOs; field meanings follow upstream API docs. */
type OpenCellIdOfficialResponse = {
  cells?: OpenCellIdOfficialCell[]
  error?: string
  code?: number
}

type OpenCellIdOfficialCell = {
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
}

type CachedOpenCellIdBboxEntry = {
  cachedAtMs: number
  cells: NearbyOpenCellIdCell[]
}
/* eslint-enable jsdoc/require-jsdoc */

const OPEN_CELL_ID_MIN_REQUEST_INTERVAL_MS = 350
const OPEN_CELL_ID_CACHE_TTL_MS = 10 * 60 * 1000
const OPEN_CELL_ID_REQUEST_TIMEOUT_MS = 15 * 1000
const OPEN_CELL_ID_RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1000
const OPEN_CELL_ID_TOO_MANY_REQUESTS_BACKOFF_MS = [2000, 5000, 10000]
const OPEN_CELL_ID_BBOX_CACHE_MAX_ENTRIES = 200
const openCellIdBboxCache = new Map<string, CachedOpenCellIdBboxEntry>()
const openCellIdInflight = new Map<string, Promise<NearbyOpenCellIdCell[]>>()
let openCellIdQueue: Promise<void> = Promise.resolve()
let lastOpenCellIdRequestMs = 0
let openCellIdRateLimitUntilMs = 0

const trimOpenCellIdCache = (): void => {
  while (openCellIdBboxCache.size > OPEN_CELL_ID_BBOX_CACHE_MAX_ENTRIES) {
    const oldestKey = openCellIdBboxCache.keys().next().value
    if (oldestKey === undefined) break
    openCellIdBboxCache.delete(oldestKey)
  }
}

const validateBbox = (bbox: OpenCellIdBboxRequest): void => {
  for (const value of [bbox.west, bbox.south, bbox.east, bbox.north]) {
    if (!Number.isFinite(value)) throw new Error('OpenCellID: bbox must contain finite numbers.')
  }
  if (bbox.south < -90 || bbox.south > 90 || bbox.north < -90 || bbox.north > 90) {
    throw new Error('OpenCellID: latitude out of [-90, 90] range.')
  }
  if (bbox.west < -180 || bbox.west > 180 || bbox.east < -180 || bbox.east > 180) {
    throw new Error('OpenCellID: longitude out of [-180, 180] range.')
  }
  if (bbox.south >= bbox.north) throw new Error('OpenCellID: bbox south must be < north.')
  if (bbox.west >= bbox.east) throw new Error('OpenCellID: bbox west must be < east.')
}

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, delayMs))
}

// Switching API keys must invalidate cached responses fetched with the previous key, so the
// cache key folds in a short fingerprint of the trimmed key (or `none` when missing).
const openCellIdApiKeyFingerprint = (apiKey: string | undefined): string => {
  const trimmed = apiKey?.trim() ?? ''
  if (!trimmed) return 'none'
  return createHash('sha256').update(trimmed).digest('hex').slice(0, 12)
}

const openCellIdBboxKey = (bbox: OpenCellIdBboxRequest): string =>
  `${openCellIdApiKeyFingerprint(bbox.apiKey)}:` +
  [bbox.west, bbox.south, bbox.east, bbox.north].map((value) => value.toFixed(6)).join(':')

const isTooManyRequestsError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  return /\b429\b/.test(error.message) || /too many requests/i.test(error.message)
}

const fetchOpenCellIdCellsWithApiKey = async (
  bbox: OpenCellIdBboxRequest,
  apiKey: string
): Promise<NearbyOpenCellIdCell[]> => {
  const url = new URL('https://opencellid.org/cell/getInArea')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('BBOX', `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '50')

  const response = await fetchWithTimeout(url.toString(), OPEN_CELL_ID_REQUEST_TIMEOUT_MS)
  if (!response.ok) throw new Error(`OpenCellID HTTP ${response.status}`)

  const data = (await response.json()) as OpenCellIdOfficialResponse
  if (data.error && data.code !== 1) throw new Error(`OpenCellID: ${data.error}`)
  return (data.cells ?? []).map((cell) => ({
    lat: cell.lat,
    lon: cell.lon,
    range: cell.range,
    radio: cell.radio,
    mcc: cell.mcc,
    mnc: cell.mnc,
    lac: cell.lac,
    cellId: cell.cellid,
    samples: cell.samples,
    averageSignalStrength: cell.averageSignalStrength,
  }))
}

const fetchOpenCellIdCellsQueued = async (bbox: OpenCellIdBboxRequest): Promise<NearbyOpenCellIdCell[]> => {
  validateBbox(bbox)
  const apiKey = bbox.apiKey?.trim()
  if (!apiKey) throw new Error('OpenCellID: missing API key.')

  const key = openCellIdBboxKey(bbox)
  const cached = openCellIdBboxCache.get(key)
  if (cached && Date.now() - cached.cachedAtMs < OPEN_CELL_ID_CACHE_TTL_MS) {
    // Refresh LRU order so hot entries survive the size-based eviction below.
    openCellIdBboxCache.delete(key)
    openCellIdBboxCache.set(key, cached)
    return cached.cells
  }

  const inflight = openCellIdInflight.get(key)
  if (inflight) return inflight
  if (Date.now() < openCellIdRateLimitUntilMs) {
    throw new Error('OpenCellID: Too many requests. Cooling down before the next retry.')
  }

  const request = new Promise<NearbyOpenCellIdCell[]>((resolve, reject) => {
    openCellIdQueue = openCellIdQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          const waitMs = Math.max(0, OPEN_CELL_ID_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastOpenCellIdRequestMs))
          if (waitMs > 0) await sleep(waitMs)

          let lastError: unknown = undefined
          for (let attempt = 0; attempt <= OPEN_CELL_ID_TOO_MANY_REQUESTS_BACKOFF_MS.length; attempt++) {
            try {
              const cells = await fetchOpenCellIdCellsWithApiKey(bbox, apiKey)
              lastOpenCellIdRequestMs = Date.now()
              openCellIdBboxCache.set(key, { cachedAtMs: Date.now(), cells })
              trimOpenCellIdCache()
              resolve(cells)
              return
            } catch (error) {
              lastError = error
              if (!isTooManyRequestsError(error) || attempt === OPEN_CELL_ID_TOO_MANY_REQUESTS_BACKOFF_MS.length) {
                if (isTooManyRequestsError(error)) {
                  openCellIdRateLimitUntilMs = Date.now() + OPEN_CELL_ID_RATE_LIMIT_COOLDOWN_MS
                }
                reject(error)
                return
              }
              await sleep(OPEN_CELL_ID_TOO_MANY_REQUESTS_BACKOFF_MS[attempt])
            }
          }
          reject(lastError)
        } catch (error) {
          reject(error)
        }
      })
  }).finally(() => {
    openCellIdInflight.delete(key)
  })

  openCellIdInflight.set(key, request)
  return request
}

const fetchNearbyOpenCellIdCells = async (
  _event: Electron.IpcMainInvokeEvent,
  bbox: OpenCellIdBboxRequest
): Promise<NearbyOpenCellIdCell[]> => {
  return await fetchOpenCellIdCellsQueued(bbox)
}

/**
 * Setup the OpenCellID bridge service. Exposes a renderer-callable IPC handler
 * that proxies bbox queries to opencellid.org with caching, rate-limiting and
 * 429 backoff so the renderer never sees the raw upstream API.
 */
export const setupOpenCellIdService = (): void => {
  ipcMain.handle('fetch-nearby-open-cell-id-cells', fetchNearbyOpenCellIdCells)
}
