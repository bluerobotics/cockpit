import {
  type DataLakeVariable,
  createDataLakeVariable,
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
 *   updates counters and a fixed-size ring buffer.
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

/**
 * Provide extra, cheap-to-read context (e.g. active video streams, connected vehicle) that gets
 * attached to each stall-episode summary. The provider is called only at episode boundaries, so it
 * never runs in the hot path.
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

  createDataLakeVariable(blockingTimeVariable, 0)
  createDataLakeVariable(longestTaskVariable, 0)

  setInterval(() => {
    setDataLakeVariableData(blockingTimeVariable.id, Math.round(rollingBlockingTime))
    setDataLakeVariableData(longestTaskVariable.id, Math.round(rollingLongestTask))
    rollingBlockingTime = 0
    rollingLongestTask = 0
  }, ROLLING_STATS_INTERVAL_MS)

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

/**
 * Whether the JS Self-Profiling API is available in this runtime. It requires the
 * `Document-Policy: js-profiling` response header, so it may be unavailable even on Chromium.
 * @returns {boolean} True when {@link captureSelfProfile} can produce a trace.
 */
export const isSelfProfilingAvailable = (): boolean => typeof (window as any).Profiler === 'function'

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
