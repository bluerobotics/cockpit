import { flattenData } from '@/libs/vehicle/common/data-flattener'

/**
 * Direction a captured MAVLink frame travelled (matches `MavlinkDumperEntry.dir`).
 */
export type MavlinkDumpDirection = 'in' | 'out'

/**
 * One numeric time-series extracted from a MAVLink JSONL dump.
 */
export interface MavlinkDumpSeries {
  /**
   * Unique series identifier (`<dir>:<sysId>:<compId>:<path>`). Incoming and outgoing frames with
   * the same path produce distinct series.
   */
  id: string
  /**
   * Display label. Prefixed with `← ` (incoming) or `→ ` (outgoing) and an optional
   * `[sys=X comp=Y]` tag when the dump contains multiple `(system_id, component_id)` pairs
   * producing the same path.
   */
  label: string
  /**
   * Flattened MAVLink path (e.g. `ATTITUDE/roll`, `NAMED_VALUE_FLOAT/CamTilt`).
   */
  path: string
  /**
   * Direction the captured frame travelled.
   */
  direction: MavlinkDumpDirection
  /**
   * MAVLink source system id.
   */
  systemId: number
  /**
   * MAVLink source component id.
   */
  componentId: number
  /**
   * Sample timestamps in unix-ms (sorted, monotonically non-decreasing).
   */
  times: number[]
  /**
   * Sample values aligned with `times`.
   */
  values: number[]
  /**
   * Min observed value across the whole series.
   */
  min: number
  /**
   * Max observed value across the whole series.
   */
  max: number
}

/**
 * Result of parsing a MAVLink JSONL dump file.
 */
export interface MavlinkDumpParseResult {
  /**
   * All numeric series indexed by `id` for fast lookup.
   */
  series: Map<string, MavlinkDumpSeries>
  /**
   * Series sorted alphabetically by label, ready to feed into a list/autocomplete.
   */
  seriesList: MavlinkDumpSeries[]
  /**
   * Total number of JSONL entries successfully parsed.
   */
  messageCount: number
  /**
   * Number of lines that could not be parsed as JSON.
   */
  invalidLineCount: number
  /**
   * First timestamp present in the dump (unix-ms), or `null` if no timestamps were found.
   */
  startTimeMs: number | null
  /**
   * Last timestamp present in the dump (unix-ms), or `null` if no timestamps were found.
   */
  endTimeMs: number | null
  /**
   * Tracks which `(system_id, component_id)` pairs contribute to each flattened path.
   * Retained for incremental live-plot appends.
   */
  pathSources: Map<string, Set<string>>
}

/* eslint-disable jsdoc/require-jsdoc */
interface DumpMessage {
  header?: {
    system_id?: number
    component_id?: number
  }
  message?: Record<string, unknown>
}
/* eslint-enable jsdoc/require-jsdoc */

/**
 * Parsed MAVLink dump entry shape accepted by the entry-based append path. Matches the JSONL
 * format produced by `mavlink-message-dumper.ts`. Older dumps (pre-bidirectional capture) omit
 * `dir`; missing values are treated as `in` for backward compatibility.
 */
export interface MavlinkDumpEntry {
  /** Capture timestamp (unix-ms). */
  ts: number
  /** Direction the frame travelled. Defaults to `'in'` when absent. */
  dir?: MavlinkDumpDirection
  /** Parsed MAVLink2REST payload as received from / sent to the connection. */
  msg: unknown
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const createEmptyParseResult = (): MavlinkDumpParseResult => ({
  series: new Map(),
  seriesList: [],
  messageCount: 0,
  invalidLineCount: 0,
  startTimeMs: null,
  endTimeMs: null,
  pathSources: new Map(),
})

const directionArrow = (direction: MavlinkDumpDirection): string => (direction === 'out' ? '→ ' : '← ')

const finalizeSeriesLabels = (result: MavlinkDumpParseResult): void => {
  for (const bucket of result.series.values()) {
    const arrow = directionArrow(bucket.direction)
    const sources = result.pathSources.get(bucket.path)
    const sourceTag = sources && sources.size > 1 ? `[sys=${bucket.systemId} comp=${bucket.componentId}] ` : ''
    bucket.label = `${arrow}${sourceTag}${bucket.path}`
  }
}

const refreshSeriesList = (result: MavlinkDumpParseResult): void => {
  result.seriesList = Array.from(result.series.values()).sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Controls which work `appendMavlinkDumpLines` performs on each JSONL row.
 * - `all`: extract every numeric series (file / static plot load).
 * - `metadata-only`: count messages only, no flattening.
 * - `discover-only`: register series ids for autocomplete without storing points.
 * - `Set<string>`: store points only for the listed series ids (live plot fast path).
 */
export type MavlinkDumpAppendMode = 'all' | 'metadata-only' | 'discover-only' | Set<string>

const ensureSeriesStub = (
  result: MavlinkDumpParseResult,
  seriesId: string,
  path: string,
  direction: MavlinkDumpDirection,
  systemId: number,
  componentId: number,
  value: number
): boolean => {
  if (result.series.has(seriesId)) return false

  result.series.set(seriesId, {
    id: seriesId,
    label: `${directionArrow(direction)}${path}`,
    path,
    direction,
    systemId,
    componentId,
    times: [],
    values: [],
    min: value,
    max: value,
  })
  return true
}

/**
 * Process one already-parsed dump entry. Hot path for live plot. Skips the JSON.parse cost.
 * @param {MavlinkDumpParseResult} result - Parse result to mutate in place.
 * @param {MavlinkDumpEntry} entry - A parsed dump entry as produced by the dumper.
 * @param {MavlinkDumpAppendMode} mode - Controls how much work is done for this entry.
 * @param {Set<string>} [modifiedSeries] - When set, receives ids of series that gained points.
 * @returns {boolean} Whether a new series bucket was created.
 */
const processDumpEntry = (
  result: MavlinkDumpParseResult,
  entry: MavlinkDumpEntry,
  mode: MavlinkDumpAppendMode = 'all',
  modifiedSeries?: Set<string>
): boolean => {
  const ts = entry.ts
  const msg = entry.msg as DumpMessage | undefined
  const message = msg?.message
  if (!isFiniteNumber(ts) || !message || typeof message !== 'object') {
    result.invalidLineCount += 1
    return false
  }

  result.messageCount += 1
  if (mode === 'all') {
    if (result.startTimeMs === null || ts < result.startTimeMs) result.startTimeMs = ts
    if (result.endTimeMs === null || ts > result.endTimeMs) result.endTimeMs = ts
  }

  if (mode === 'metadata-only') return false

  const direction: MavlinkDumpDirection = entry.dir === 'out' ? 'out' : 'in'
  const systemId = msg?.header?.system_id ?? 0
  const componentId = msg?.header?.component_id ?? 0
  const sourceKey = `${systemId}:${componentId}`
  const seriesFilter = mode instanceof Set ? mode : null

  let addedSeries = false
  const flattened = flattenData(message)
  for (const pair of flattened) {
    if (pair.type !== 'number' || !isFiniteNumber(pair.value)) continue

    const seriesId = `${direction}:${sourceKey}:${pair.path}`
    if (seriesFilter && !seriesFilter.has(seriesId)) continue

    let sources = result.pathSources.get(pair.path)
    if (!sources) {
      sources = new Set<string>()
      result.pathSources.set(pair.path, sources)
    }
    sources.add(sourceKey)

    if (mode === 'discover-only') {
      if (ensureSeriesStub(result, seriesId, pair.path, direction, systemId, componentId, pair.value)) {
        addedSeries = true
      }
      continue
    }

    let bucket = result.series.get(seriesId)
    if (!bucket) {
      bucket = {
        id: seriesId,
        label: `${directionArrow(direction)}${pair.path}`,
        path: pair.path,
        direction,
        systemId,
        componentId,
        times: [],
        values: [],
        min: pair.value,
        max: pair.value,
      }
      result.series.set(seriesId, bucket)
      addedSeries = true
    }

    bucket.times.push(ts)
    bucket.values.push(pair.value)
    if (pair.value < bucket.min) bucket.min = pair.value
    if (pair.value > bucket.max) bucket.max = pair.value
    modifiedSeries?.add(seriesId)
  }

  return addedSeries
}

const appendDumpLine = (
  result: MavlinkDumpParseResult,
  rawLine: string,
  mode: MavlinkDumpAppendMode = 'all',
  modifiedSeries?: Set<string>
): boolean => {
  const line = rawLine.trim()
  if (!line) return false

  let entry: MavlinkDumpEntry
  try {
    entry = JSON.parse(line) as MavlinkDumpEntry
  } catch {
    result.invalidLineCount += 1
    return false
  }

  return processDumpEntry(result, entry, mode, modifiedSeries)
}

const recomputeSeriesMinMax = (bucket: MavlinkDumpSeries): void => {
  if (bucket.values.length === 0) {
    bucket.min = 0
    bucket.max = 0
    return
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of bucket.values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  bucket.min = min
  bucket.max = max
}

const sortSeriesByTime = (bucket: MavlinkDumpSeries): void => {
  if (bucket.times.length <= 1) return

  const indices = bucket.times.map((_, index) => index).sort((a, b) => bucket.times[a] - bucket.times[b])
  const sortedTimes: number[] = []
  const sortedValues: number[] = []
  for (const index of indices) {
    sortedTimes.push(bucket.times[index])
    sortedValues.push(bucket.values[index])
  }
  bucket.times = sortedTimes
  bucket.values = sortedValues
  recomputeSeriesMinMax(bucket)
}

/**
 * Parse a MAVLink JSONL dump as produced by `mavlink-message-dumper.ts` and group every numeric
 * field into individual time-series, keyed by `(system_id, component_id, flattenedPath)`.
 *
 * Lines that fail to parse or do not contain a numeric payload are silently skipped, but counted
 * in `invalidLineCount` so the caller can warn the user when a dump looks malformed.
 * @param {string} content Raw JSONL content. Empty lines are ignored.
 * @returns {MavlinkDumpParseResult} The aggregated time-series and dump metadata.
 */
export const parseMavlinkDump = (content: string): MavlinkDumpParseResult => {
  const result = createEmptyParseResult()

  for (const rawLine of content.split(/\r?\n/)) {
    appendDumpLine(result, rawLine)
  }

  finalizeSeriesLabels(result)
  refreshSeriesList(result)
  return result
}

/**
 * Append newly captured JSONL lines to an existing parse result. Used by live plot to avoid
 * re-parsing the full in-memory buffer on every refresh.
 * @param {MavlinkDumpParseResult} result - Existing parse result to extend in place.
 * @param {string[]} lines - New JSONL lines to append.
 * @param {MavlinkDumpAppendMode} [mode='all'] - Limits how much work is done per line.
 * @returns {MavlinkDumpParseResult} The same `result` instance, updated in place.
 */
export const appendMavlinkDumpLines = (
  result: MavlinkDumpParseResult,
  lines: string[],
  mode: MavlinkDumpAppendMode = 'all'
): MavlinkDumpParseResult => {
  if (lines.length === 0) return result

  let addedSeries = false
  const modifiedSeries = mode === 'metadata-only' || mode === 'discover-only' ? undefined : new Set<string>()
  for (const rawLine of lines) {
    if (appendDumpLine(result, rawLine, mode, modifiedSeries)) addedSeries = true
  }

  if (modifiedSeries) {
    for (const seriesId of modifiedSeries) {
      const bucket = result.series.get(seriesId)
      if (bucket) sortSeriesByTime(bucket)
    }
  }

  if (mode === 'all' || mode === 'discover-only' || addedSeries) {
    finalizeSeriesLabels(result)
  }
  if (addedSeries && mode !== 'metadata-only') {
    refreshSeriesList(result)
  }

  return result
}

/**
 * Register series ids from JSONL lines without storing sample points. Intended for chunked,
 * background autocomplete population during live plot.
 * @param {MavlinkDumpParseResult} result - Parse result to extend in place.
 * @param {string[]} lines - JSONL lines to scan.
 * @returns {MavlinkDumpParseResult} The same `result` instance, updated in place.
 */
export const discoverMavlinkDumpSeries = (result: MavlinkDumpParseResult, lines: string[]): MavlinkDumpParseResult => {
  return appendMavlinkDumpLines(result, lines, 'discover-only')
}

/**
 * Append a single already-parsed dump entry to an existing result. Used by the live plot push
 * path so we never re-parse the JSONL buffer on each refresh tick.
 *
 * Note: this is the per-entry hot path; it does NOT call `finalizeSeriesLabels` or
 * `refreshSeriesList`. Callers that grow the series set (e.g. discovery batches) must call
 * `finalizeAndRefreshSeriesList(result)` once after a batch of entries.
 * @param {MavlinkDumpParseResult} result - Parse result to extend in place.
 * @param {MavlinkDumpEntry} entry - Pre-parsed dump entry.
 * @param {MavlinkDumpAppendMode} [mode='all'] - Limits how much work is done.
 * @returns {boolean} Whether a new series bucket was created (caller should refresh series list).
 */
export const appendMavlinkDumpEntry = (
  result: MavlinkDumpParseResult,
  entry: MavlinkDumpEntry,
  mode: MavlinkDumpAppendMode = 'all'
): boolean => {
  return processDumpEntry(result, entry, mode)
}

/**
 * Re-derive the alphabetically sorted series list from the current series map. Cheap when there
 * are few series; callers should only run this after a batch of entries that may have grown the
 * set, not per-entry.
 * @param {MavlinkDumpParseResult} result - Parse result to refresh in place.
 */
export const finalizeAndRefreshSeriesList = (result: MavlinkDumpParseResult): void => {
  finalizeSeriesLabels(result)
  refreshSeriesList(result)
}

const trimSeriesPoints = (bucket: MavlinkDumpSeries, maxPoints: number): void => {
  const excess = bucket.times.length - maxPoints
  if (excess <= 0) return
  bucket.times.splice(0, excess)
  bucket.values.splice(0, excess)
  recomputeSeriesMinMax(bucket)
}

const refreshParseTimeExtents = (result: MavlinkDumpParseResult): void => {
  let startTimeMs: number | null = null
  let endTimeMs: number | null = null

  for (const bucket of result.series.values()) {
    if (bucket.times.length === 0) continue
    const first = bucket.times[0]
    const last = bucket.times[bucket.times.length - 1]
    if (startTimeMs === null || first < startTimeMs) startTimeMs = first
    if (endTimeMs === null || last > endTimeMs) endTimeMs = last
  }

  result.startTimeMs = startTimeMs
  result.endTimeMs = endTimeMs
}

/**
 * Drop the oldest samples in each series once `maxPoints` is exceeded.
 * @param {MavlinkDumpParseResult} result - Parse result to trim in place.
 * @param {number} maxPoints - Maximum number of points to keep per series.
 * @param {Set<string>} [seriesIds] - When set, only these series are trimmed.
 * @returns {MavlinkDumpParseResult} The same `result` instance, trimmed in place.
 */
export const applyMaxPointsLimit = (
  result: MavlinkDumpParseResult,
  maxPoints: number,
  seriesIds?: Set<string>
): MavlinkDumpParseResult => {
  if (maxPoints <= 0) return result

  const buckets =
    seriesIds === undefined
      ? [...result.series.values()]
      : [...seriesIds].map((id) => result.series.get(id)).filter((bucket): bucket is MavlinkDumpSeries => !!bucket)

  for (const bucket of buckets) {
    trimSeriesPoints(bucket, maxPoints)
  }

  if (seriesIds === undefined) {
    refreshParseTimeExtents(result)
  }

  return result
}
