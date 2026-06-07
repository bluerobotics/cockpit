import {
  type DataLakeVariable,
  createDataLakeVariable,
  getDataLakeListenerCount,
  getDataLakeVariableCount,
  getDataLakeVariableData,
  setDataLakeVariableData,
} from '@/libs/actions/data-lake'

/**
 * Main-thread performance instrumentation for Cockpit.
 *
 * The module is split in two tiers so it can stay enabled in the field without ever becoming the
 * cause of a problem it is meant to detect:
 *
 * - Tier 1 (always-on, near-zero cost): a `longtask` PerformanceObserver that the browser feeds for
 *   free whenever a task blocks the main thread for >50ms. We aggregate consecutive long tasks into
 *   "episodes" and emit a single summary log on recovery, so a multi-second stutter becomes one log
 *   line instead of hundreds. No formatting happens in the hot path - the observer callback only
 *   updates counters and a fixed-size ring buffer. This tier also emits a periodic trend snapshot
 *   (see {@link TrendSnapshot}) that captures windowed framerate health together with leak
 *   indicators, so a session that slowly degrades over tens of minutes self-documents what is
 *   growing - the signature of gradual decline rather than discrete stalls.
 * - Tier 2 (opt-in, more intrusive): User Timing instrumentation via {@link instrument} and the JS
 *   Self-Profiling API via {@link captureSelfProfile}. These are gated behind a flag so they are only
 *   active while a user is actively trying to pin-point where a stall comes from.
 */

const LONG_TASK_RING_SIZE = 256
// A long task already implies the main thread was blocked; we close an episode once this much idle
// time passes without any new long task, so unrelated stalls don't get merged into one report.
const EPISODE_IDLE_MS = 1500
// The Long Tasks API only reports tasks longer than this, so it doubles as our "blocking" baseline.
const LONG_TASK_THRESHOLD_MS = 50
// Avoid flooding the logs if the app enters a sustained storm of stalls.
const MAX_EPISODE_LOGS_PER_MINUTE = 12
const ROLLING_STATS_INTERVAL_MS = 1000
// How often to emit the trend snapshot. Low cadence keeps a multi-hour session to a few hundred
// concise log lines while still being dense enough to see a slow decline.
const TREND_INTERVAL_MS = 30_000
const TREND_RING_SIZE = 240

const frameRateVariableId = 'cockpit-app-frame-rate'

const blockingTimeVariable: DataLakeVariable = {
  id: 'cockpit-main-thread-blocking-time',
  name: 'Cockpit Main Thread Blocking Time',
  type: 'number',
  description:
    'Total blocking time (sum of long-task durations above 50ms, in ms) on the main thread over the last second. ' +
    'High values mean the UI, control sending and telemetry reception were starved.',
}

const longestTaskVariable: DataLakeVariable = {
  id: 'cockpit-longest-task-duration',
  name: 'Cockpit Longest Task Duration',
  type: 'number',
  description: 'Duration in ms of the longest main-thread task observed over the last second.',
}

/** A single main-thread long task as reported by the Long Tasks API. */
export interface LongTaskRecord {
  /** Time (relative to navigation start, in ms) at which the task started. */
  startTime: number
  /** How long the task blocked the main thread, in ms. */
  duration: number
  /** Best-effort attribution name provided by the browser (often "self" or a frame container). */
  attribution: string
}

/**
 * A periodic snapshot of windowed framerate health plus leak indicators. Designed for diagnosing
 * gradual degradation: comparing snapshots across a long session shows whether framerate is sinking
 * and, if so, which tracked count is growing alongside it.
 */
export interface TrendSnapshot {
  /** Minutes since monitoring started, at the time of the snapshot. */
  uptimeMin: number
  /** Average framerate over the window, in fps. */
  avgFps: number
  /** Standard deviation of frame intervals over the window, in ms (quantifies "oscillating"). */
  frameMsStdDev: number
  /** 95th-percentile frame interval over the window, in ms. */
  p95FrameMs: number
  /** Longest frame interval over the window, in ms (worst hitch). */
  maxFrameMs: number
  /** Number of long tasks observed during the window. */
  longTasks: number
  /** Total blocking time (long-task ms above the 50ms threshold) during the window. */
  blockingMs: number
  /** Sampled JS/process memory usage, in MB. */
  memoryMB: number
  /** Number of registered data lake variables (leak indicator). */
  dataLakeVars: number
  /** Total data lake value listeners across all variables (leak indicator). */
  dataLakeListeners: number
  /** Number of DOM nodes in the document (leak indicator for widget/overlay accumulation). */
  domNodes: number
}

/** Aggregated User Timing statistics for an instrumented subsystem. */
export interface InstrumentationStat {
  /** Number of times the instrumented section ran. */
  count: number
  /** Total time spent inside the instrumented section, in ms. */
  totalMs: number
  /** Longest single execution of the instrumented section, in ms. */
  maxMs: number
}

type PerformanceContextProvider = () => Record<string, unknown>

const longTaskRing: LongTaskRecord[] = []
let longTaskRingHead = 0

let currentEpisode: {
  /** Start time of the episode's first long task, in ms relative to navigation start. */
  startTime: number
  /** End time of the episode's most recent long task, in ms relative to navigation start. */
  lastTaskEndTime: number
  /** Number of long tasks observed during the episode. */
  taskCount: number
  /** Sum of long-task durations above the 50ms threshold, in ms. */
  totalBlockingTime: number
  /** Duration of the longest single long task in the episode, in ms. */
  maxTaskDuration: number
  /** Lowest frame rate sampled while the episode was in progress. */
  minFps: number
} | null = null
let episodeIdleTimer: ReturnType<typeof setTimeout> | null = null

const recentEpisodeLogTimestamps: number[] = []
let suppressedEpisodeCount = 0

let rollingBlockingTime = 0
let rollingLongestTask = 0

let monitoringStartTime = 0
let frameSamplerLastTime = 0
// Frame intervals (ms) accumulated since the last trend snapshot. Reset each window; at 60fps a 30s
// window holds ~1800 entries, so memory stays bounded.
let windowFrameTimes: number[] = []
let windowStartTime = 0
let windowLongTaskCount = 0
let windowBlockingTime = 0
const trendRing: TrendSnapshot[] = []
let trendRingHead = 0

let observer: PerformanceObserver | null = null
let monitoringStarted = false

let contextProvider: PerformanceContextProvider | null = null

let profilingEnabled = false
const instrumentationStats: Record<string, InstrumentationStat> = {}

const isHidden = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden'

const pushLongTask = (record: LongTaskRecord): void => {
  longTaskRing[longTaskRingHead] = record
  longTaskRingHead = (longTaskRingHead + 1) % LONG_TASK_RING_SIZE
}

const canLogEpisode = (): boolean => {
  const now = performance.now()
  const oneMinuteAgo = now - 60_000
  while (recentEpisodeLogTimestamps.length > 0 && recentEpisodeLogTimestamps[0] < oneMinuteAgo) {
    recentEpisodeLogTimestamps.shift()
  }
  return recentEpisodeLogTimestamps.length < MAX_EPISODE_LOGS_PER_MINUTE
}

const finalizeEpisode = (): void => {
  episodeIdleTimer = null
  const episode = currentEpisode
  currentEpisode = null
  if (episode === null) return

  // Browsers legitimately throttle timers/rendering while hidden, so a "stall" there is not a real
  // problem worth alerting about.
  if (isHidden()) return

  if (!canLogEpisode()) {
    suppressedEpisodeCount++
    return
  }
  recentEpisodeLogTimestamps.push(performance.now())

  const durationMs = Math.round(episode.lastTaskEndTime - episode.startTime)
  const summary: Record<string, unknown> = {
    durationMs,
    longTasks: episode.taskCount,
    totalBlockingTimeMs: Math.round(episode.totalBlockingTime),
    maxTaskMs: Math.round(episode.maxTaskDuration),
    minFps: episode.minFps === Infinity ? null : episode.minFps,
  }

  if (contextProvider !== null) {
    try {
      Object.assign(summary, contextProvider())
    } catch {
      // Context is best-effort; never let it break logging.
    }
  }

  if (suppressedEpisodeCount > 0) {
    summary.suppressedSimilarEpisodesLastMinute = suppressedEpisodeCount
    suppressedEpisodeCount = 0
  }

  console.warn(`[Performance] Main-thread stall episode: ${JSON.stringify(summary)}`)
}

const onLongTask = (entry: PerformanceEntry): void => {
  const blocking = entry.duration - LONG_TASK_THRESHOLD_MS
  // `attribution` is part of PerformanceLongTaskTiming but missing from some TS lib versions.
  const attribution: string = (entry as any).attribution?.[0]?.name ?? 'unknown'

  pushLongTask({ startTime: entry.startTime, duration: entry.duration, attribution })

  rollingBlockingTime += Math.max(0, blocking)
  rollingLongestTask = Math.max(rollingLongestTask, entry.duration)
  windowLongTaskCount++
  windowBlockingTime += Math.max(0, blocking)

  const fps = Number(getDataLakeVariableData(frameRateVariableId) ?? Infinity)
  const taskEnd = entry.startTime + entry.duration

  if (currentEpisode === null) {
    currentEpisode = {
      startTime: entry.startTime,
      lastTaskEndTime: taskEnd,
      taskCount: 1,
      totalBlockingTime: Math.max(0, blocking),
      maxTaskDuration: entry.duration,
      minFps: fps,
    }
  } else {
    currentEpisode.lastTaskEndTime = taskEnd
    currentEpisode.taskCount++
    currentEpisode.totalBlockingTime += Math.max(0, blocking)
    currentEpisode.maxTaskDuration = Math.max(currentEpisode.maxTaskDuration, entry.duration)
    currentEpisode.minFps = Math.min(currentEpisode.minFps, fps)
  }

  if (episodeIdleTimer !== null) clearTimeout(episodeIdleTimer)
  episodeIdleTimer = setTimeout(finalizeEpisode, EPISODE_IDLE_MS)
}

const sampleFrame = (): void => {
  const now = performance.now()
  windowFrameTimes.push(now - frameSamplerLastTime)
  frameSamplerLastTime = now
  requestAnimationFrame(sampleFrame)
}

const percentile = (sorted: number[], fraction: number): number => {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))
  return sorted[index]
}

const resetTrendWindow = (): void => {
  windowFrameTimes = []
  windowLongTaskCount = 0
  windowBlockingTime = 0
  windowStartTime = performance.now()
}

const pushTrend = (snapshot: TrendSnapshot): void => {
  trendRing[trendRingHead] = snapshot
  trendRingHead = (trendRingHead + 1) % TREND_RING_SIZE
}

const emitTrend = (): void => {
  // While hidden the browser throttles rAF, so framerate numbers would be meaningless. Skip the
  // window entirely rather than reporting a fake decline.
  if (isHidden() || windowFrameTimes.length === 0) {
    resetTrendWindow()
    return
  }

  const elapsedSeconds = (performance.now() - windowStartTime) / 1000
  const frames = windowFrameTimes.length
  const sorted = [...windowFrameTimes].sort((a, b) => a - b)
  const mean = windowFrameTimes.reduce((sum, value) => sum + value, 0) / frames
  const variance = windowFrameTimes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / frames

  const snapshot: TrendSnapshot = {
    uptimeMin: Math.round((performance.now() - monitoringStartTime) / 6000) / 10,
    avgFps: elapsedSeconds > 0 ? Math.round(frames / elapsedSeconds) : 0,
    frameMsStdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    p95FrameMs: Math.round(percentile(sorted, 0.95)),
    maxFrameMs: Math.round(sorted[sorted.length - 1]),
    longTasks: windowLongTaskCount,
    blockingMs: Math.round(windowBlockingTime),
    memoryMB: Math.round(Number(getDataLakeVariableData('cockpit-memory-usage') ?? 0)),
    dataLakeVars: getDataLakeVariableCount(),
    dataLakeListeners: getDataLakeListenerCount(),
    domNodes: typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0,
  }

  const line: Record<string, unknown> = { ...snapshot }
  if (contextProvider !== null) {
    try {
      Object.assign(line, contextProvider())
    } catch {
      // Context is best-effort; never let it break logging.
    }
  }

  pushTrend(snapshot)
  console.info(`[Performance] Trend: ${JSON.stringify(line)}`)
  resetTrendWindow()
}

/**
 * Provide extra, cheap-to-read context (e.g. active video streams, connected vehicle) that gets
 * attached to each stall-episode summary and trend snapshot. The provider is called only at episode
 * boundaries and trend ticks, so it never runs in the hot path.
 * @param {PerformanceContextProvider} provider Function returning a flat object of context values.
 */
export const setPerformanceContextProvider = (provider: PerformanceContextProvider): void => {
  contextProvider = provider
}

/**
 * Start Tier-1 monitoring: register the long-task observer and the rolling data-lake metrics.
 * Safe to call multiple times; only the first call has an effect. Degrades silently where the
 * Long Tasks API is unavailable.
 */
export const startPerformanceMonitoring = (): void => {
  if (monitoringStarted) return
  monitoringStarted = true

  monitoringStartTime = performance.now()

  createDataLakeVariable(blockingTimeVariable, 0)
  createDataLakeVariable(longestTaskVariable, 0)

  setInterval(() => {
    setDataLakeVariableData(blockingTimeVariable.id, Math.round(rollingBlockingTime))
    setDataLakeVariableData(longestTaskVariable.id, Math.round(rollingLongestTask))
    rollingBlockingTime = 0
    rollingLongestTask = 0
  }, ROLLING_STATS_INTERVAL_MS)

  // Frame-interval sampler feeding the trend snapshots. A single rAF that only diffs timestamps and
  // pushes a number; negligible cost, and it pauses automatically while the tab is hidden.
  frameSamplerLastTime = performance.now()
  resetTrendWindow()
  requestAnimationFrame(sampleFrame)
  setInterval(emitTrend, TREND_INTERVAL_MS)

  if (typeof PerformanceObserver === 'undefined') {
    console.info('[Performance] PerformanceObserver is unavailable; long-task monitoring disabled.')
    return
  }

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        onLongTask(entry)
      }
    })
    observer.observe({ entryTypes: ['longtask'] })
  } catch (error) {
    console.warn('[Performance] Failed to start long-task observer:', error)
  }
}

/**
 * Returns a chronological snapshot of the most recent long tasks held in the ring buffer.
 * @returns {LongTaskRecord[]} Recorded long tasks ordered from oldest to newest.
 */
export const getRecentLongTasks = (): LongTaskRecord[] => {
  const ordered: LongTaskRecord[] = []
  for (let i = 0; i < LONG_TASK_RING_SIZE; i++) {
    const record = longTaskRing[(longTaskRingHead + i) % LONG_TASK_RING_SIZE]
    if (record !== undefined) ordered.push(record)
  }
  return ordered
}

/**
 * Returns the trend snapshots held in the ring buffer, oldest to newest. Useful for rendering the
 * decline curve of a long session in a diagnostics view.
 * @returns {TrendSnapshot[]} Recorded trend snapshots ordered from oldest to newest.
 */
export const getRecentTrends = (): TrendSnapshot[] => {
  const ordered: TrendSnapshot[] = []
  for (let i = 0; i < TREND_RING_SIZE; i++) {
    const snapshot = trendRing[(trendRingHead + i) % TREND_RING_SIZE]
    if (snapshot !== undefined) ordered.push(snapshot)
  }
  return ordered
}

/**
 * Enable or disable Tier-2 (opt-in) instrumentation. While disabled, {@link instrument} is a no-op
 * wrapper with no measurable overhead.
 * @param {boolean} enabled Whether opt-in profiling instrumentation should be active.
 */
export const setPerformanceProfilingEnabled = (enabled: boolean): void => {
  profilingEnabled = enabled
}

/**
 * Whether Tier-2 instrumentation is currently enabled.
 * @returns {boolean} True when opt-in profiling is active.
 */
export const isPerformanceProfilingEnabled = (): boolean => profilingEnabled

const recordInstrument = (name: string, durationMs: number): void => {
  const stat = instrumentationStats[name] ?? { count: 0, totalMs: 0, maxMs: 0 }
  stat.count++
  stat.totalMs += durationMs
  stat.maxMs = Math.max(stat.maxMs, durationMs)
  instrumentationStats[name] = stat
}

/**
 * Wrap a synchronous section so its main-thread cost is measured when profiling is enabled. When
 * profiling is disabled this just calls `fn` directly, so it is safe to leave permanently in hot
 * paths. When enabled, it records aggregate stats and emits a User Timing measure (`cockpit:<name>`)
 * so the section shows up labelled in DevTools and self-profiles.
 * @param {string} name Stable identifier for the instrumented section.
 * @param {() => T} fn The work to execute and measure.
 * @returns {T} The value returned by `fn`.
 * @template T
 */
export const instrument = <T>(name: string, fn: () => T): T => {
  if (!profilingEnabled) return fn()
  const start = performance.now()
  try {
    return fn()
  } finally {
    const end = performance.now()
    recordInstrument(name, end - start)
    try {
      performance.measure(`cockpit:${name}`, { start, end })
    } catch {
      // measure can throw on exotic engines; metrics above are the source of truth.
    }
  }
}

/**
 * Returns the aggregated User Timing statistics collected while profiling was enabled.
 * @returns {Record<string, InstrumentationStat>} Per-section instrumentation statistics.
 */
export const getInstrumentationStats = (): Record<string, InstrumentationStat> => {
  return JSON.parse(JSON.stringify(instrumentationStats))
}

/** Clears all accumulated User Timing statistics. */
export const clearInstrumentationStats = (): void => {
  Object.keys(instrumentationStats).forEach((key) => delete instrumentationStats[key])
}

let selfProfilingAvailability: boolean | null = null

/**
 * Whether the JS Self-Profiling API is actually usable in this runtime. The `Profiler` global can
 * exist while the API is still blocked by the missing `Document-Policy: js-profiling` header, so a
 * mere `typeof` check is misleading. We probe once by constructing a throwaway profiler (caching the
 * result), which reflects reality and avoids triggering a policy violation on every capture attempt.
 * @returns {boolean} True when {@link captureSelfProfile} can produce a trace.
 */
export const isSelfProfilingAvailable = (): boolean => {
  if (selfProfilingAvailability !== null) return selfProfilingAvailability

  const ProfilerCtor = (window as any).Profiler
  if (typeof ProfilerCtor !== 'function') {
    selfProfilingAvailability = false
    return false
  }

  try {
    const probe = new ProfilerCtor({ sampleInterval: 10, maxBufferSize: 1 })
    void probe.stop?.().catch(() => undefined)
    selfProfilingAvailability = true
  } catch {
    selfProfilingAvailability = false
  }
  return selfProfilingAvailability
}

/**
 * Capture a low-overhead sampling profile of the main thread over the given window. This is the most
 * intrusive instrument and is intended for on-demand use while reproducing a stall.
 * @param {number} [durationMs] How long to sample for, in ms.
 * @param {number} [sampleIntervalMs] Requested sampling interval, in ms (the engine may round it).
 * @returns {Promise<unknown | undefined>} The profiler trace, or undefined if profiling is unavailable.
 */
export const captureSelfProfile = async (durationMs = 10_000, sampleIntervalMs = 10): Promise<unknown | undefined> => {
  if (!isSelfProfilingAvailable()) {
    console.warn('[Performance] JS Self-Profiling API is unavailable in this runtime.')
    return undefined
  }
  try {
    const ProfilerCtor = (window as any).Profiler
    const profiler = new ProfilerCtor({ sampleInterval: sampleIntervalMs, maxBufferSize: 100_000 })
    await new Promise((resolve) => setTimeout(resolve, durationMs))
    return await profiler.stop()
  } catch (error) {
    console.warn('[Performance] Failed to capture self-profile:', error)
    return undefined
  }
}
