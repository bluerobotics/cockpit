import type { Go2RTCStreamInfo, WebRTCVideoStat, WebRTCVideoStats } from '@/types/video'

/**
 * The raw cumulative ingest counters of a go2rtc stream and the epoch they were sampled at
 */
export type Go2rtcIngestCounters = Pick<Go2RTCStreamInfo, 'bytes' | 'packets' | 'sampleEpoch'>

/**
 * Ingest rates derived over a known window between two counter samples
 */
export interface Go2rtcIngestRates {
  /**
   * Ingest bitrate in kbps
   */
  bitrateKbps: number
  /**
   * Ingest packet rate in packets/sec
   */
  packetsPerSec: number
}

/**
 * A go2rtc stream sample as fanned out to consumers: the raw stream info plus the rates the
 * sampler derived over its own window, absent while no window is derivable
 */
export type Go2rtcStreamSample = Go2RTCStreamInfo &
  Partial<Go2rtcIngestRates> & {
    /**
     * Cumulative zero-bitrate time after warmup, in 100 ms units
     */
    stallCount?: number
    /**
     * Whether this sample's ingest bitrate was zero after warmup
     */
    stalled?: boolean
  }

/**
 * Difference two counter samples into rates over the window between them
 * @param {Go2rtcIngestCounters} prev - Earlier sample
 * @param {Go2rtcIngestCounters} next - Later sample
 * @returns {Go2rtcIngestRates | undefined} Rates over the window, or undefined when the window is not positive
 */
export const differenceGo2rtcSamples = (
  prev: Go2rtcIngestCounters,
  next: Go2rtcIngestCounters
): Go2rtcIngestRates | undefined => {
  const elapsedSeconds = (next.sampleEpoch - prev.sampleEpoch) / 1000
  if (elapsedSeconds <= 0) return undefined

  // A producer reconnect restarts go2rtc's counters at zero; differencing across that is meaningless
  if (next.bytes < prev.bytes || next.packets < prev.packets) return undefined

  return {
    bitrateKbps: Math.round(((next.bytes - prev.bytes) * 8) / 1000 / elapsedSeconds),
    packetsPerSec: Math.round((next.packets - prev.packets) / elapsedSeconds),
  }
}

/**
 * Assemble the sample published for one go2rtc poll. The rate keys are left out whenever no window
 * is derivable, so a rate that is merely not known yet is never published as the zero that means a
 * stalled stream.
 * @param {Go2RTCStreamInfo} info - Latest counters and stream info from go2rtc
 * @param {Go2rtcIngestCounters | undefined} previous - Counters of this stream's previous sample, if any
 * @returns {Go2rtcStreamSample} Sample to fan out to consumers
 */
export const buildGo2rtcStreamSample = (
  info: Go2RTCStreamInfo,
  previous: Go2rtcIngestCounters | undefined
): Go2rtcStreamSample => ({
  ...info,
  ...(previous === undefined ? undefined : differenceGo2rtcSamples(previous, info)),
})

// WebRTC stats published to the data lake for every monitored stream
export const webRtcStreamStatKeys: WebRTCVideoStat[] = [
  'bytesReceived',
  'firCount',
  'framesDecoded',
  'framesDropped',
  'framesReceived',
  'freezeCount',
  'headerBytesReceived',
  'jitterBufferEmittedCount',
  'keyFramesDecoded',
  'lastPacketReceivedTimestamp',
  'nackCount',
  'packetsLost',
  'packetsReceived',
  'pauseCount',
  'pliCount',
  'timestamp',
  'totalAssemblyTime',
  'totalDecodeTime',
  'totalFreezesDuration',
  'totalInterFrameDelay',
  'totalPausesDuration',
  'totalProcessingDelay',
  'totalSquaredInterFrameDelay',
  'bitrate',
  'clockRate',
  'frameHeight',
  'framesAssembledFromMultiplePackets',
  'framesPerSecond',
  'jitter',
  'jitterBufferDelay',
  'jitterBufferMinimumDelay',
  'jitterBufferTargetDelay',
  'packetRate',
]

// Published alongside them, but computed here rather than reported by the WebRTC library
const derivedWebRtcStreamStatKeys = ['bitrateKbps'] as const

type DerivedWebRtcStreamStatKey = (typeof derivedWebRtcStreamStatKeys)[number]

// Every WebRTC stat variable a stream gets: one per reported key, plus one per derived stat
export const webRtcStreamStatVariableKeys: string[] = [...webRtcStreamStatKeys, ...derivedWebRtcStreamStatKeys]

/**
 * Derive the WebRTC stats the library does not report. A stat whose source is missing or not finite
 * is left out, so a rate that is merely not known is never published as the zero that means a
 * stalled stream.
 * @param {WebRTCVideoStats} stats - Latest inbound video stats of a stream
 * @returns {Partial<Record<DerivedWebRtcStreamStatKey, number>>} Derived stats that are known
 */
export const derivedWebRtcStreamStats = (
  stats: WebRTCVideoStats
): Partial<Record<DerivedWebRtcStreamStatKey, number>> =>
  // Whole kbps like the go2rtc series this one exists to be plotted against; bitrateBps keeps the full resolution
  Number.isFinite(stats.bitrate) ? { bitrateKbps: Math.round(stats.bitrate / 1000) } : {}

// How long after a stream's first go2rtc sample a zero ingest bitrate is not yet a stall
export const GO2RTC_STALL_WARMUP_MS = 5000

// One stall count is this much zero-bitrate time, the same step the stats panel used when it counted for itself
export const GO2RTC_STALL_QUANTUM_MS = 100

/**
 * Stall accounting after one go2rtc sample
 */
export interface Go2rtcStallAdvance {
  /**
   * Cumulative stall count in 100 ms units
   */
  stallCount: number
  /**
   * Stalled milliseconds not yet enough for another count
   */
  remainderMs: number
  /**
   * Whether this sample's ingest bitrate was zero after warmup
   */
  stalled: boolean
}

/**
 * Advance the cumulative RTSP stall count by the zero-bitrate time in this sample's window.
 * A missing bitrate is not a stall, and time during warmup is not a stall. A window is added
 * only when its bitrate is exactly 0, which is exact at the 100 ms sampler. At the 5 s idle
 * poll, a window that still carried traffic counts as not stalled, so the total is a lower bound.
 * @param {number} stallCount - Cumulative stalls so far, in 100 ms units
 * @param {number} remainderMs - Stalled milliseconds not yet enough for another count
 * @param {number | undefined} bitrateKbps - Ingest bitrate of this sample, absent when no rate is derivable
 * @param {number} elapsedMs - Milliseconds since this stream's first sample
 * @param {number} sampleWindowMs - Milliseconds since this stream's previous sample
 * @returns {Go2rtcStallAdvance} The stall count, leftover milliseconds, and whether this sample stalled
 */
export const nextGo2rtcStallCount = (
  stallCount: number,
  remainderMs: number,
  bitrateKbps: number | undefined,
  elapsedMs: number,
  sampleWindowMs: number
): Go2rtcStallAdvance => {
  const unchanged: Go2rtcStallAdvance = { stallCount, remainderMs, stalled: false }
  // ponytail: the idle poll is the ceiling; run the 100 ms sampler whenever any RTSP stream is
  // active, not only while a panel is open or an rtsp-* id is armed
  if (bitrateKbps !== 0 || !(sampleWindowMs > 0)) return unchanged

  const pastWarmupMs = elapsedMs - GO2RTC_STALL_WARMUP_MS
  const countableMs = Math.min(sampleWindowMs, pastWarmupMs)
  if (!(countableMs > 0)) return unchanged

  const stalledMs = countableMs + remainderMs
  const quanta = Math.floor(stalledMs / GO2RTC_STALL_QUANTUM_MS)
  return {
    stallCount: stallCount + quanta,
    remainderMs: stalledMs - quanta * GO2RTC_STALL_QUANTUM_MS,
    stalled: true,
  }
}

// go2rtc ingest stats published to the data lake for every active RTSP stream (Standalone only)
export const go2rtcStreamStatKeys = [
  'bytes',
  'packets',
  'sampleEpoch',
  'bitrateKbps',
  'packetsPerSec',
  'codec',
  'width',
  'height',
  'fps',
  'protocol',
  'stallCount',
] as const

/**
 * The go2rtc ingest stats published to the data lake
 */
export type Go2rtcStreamStatKey = (typeof go2rtcStreamStatKeys)[number]

// The WebRTC library reports bitrate in bits/sec; the published name carries that unit so it cannot
// be plotted against the go2rtc bitrateKbps series as if they shared a scale
const publishedWebRtcStatKey = (statKey: string): string => (statKey === 'bitrate' ? 'bitrateBps' : statKey)

/**
 * Build the data lake variable id of a stream's WebRTC stat
 * @param {string} internalName - Internal stream name (persisted artifacts never use the external id)
 * @param {string} statKey - WebRTC stat key
 * @returns {string} Data lake variable id
 */
export const streamStatVariableId = (internalName: string, statKey: string): string =>
  `stream-${internalName}-${publishedWebRtcStatKey(statKey)}`

/**
 * Build the data lake display name of a stream's WebRTC stat
 * @param {string} internalName - Internal stream name (persisted artifacts never use the external id)
 * @param {string} statKey - WebRTC stat key
 * @returns {string} Data lake variable display name
 */
export const streamStatDisplayName = (internalName: string, statKey: string): string =>
  `Stream '${internalName}' - ${publishedWebRtcStatKey(statKey)}`

/**
 * Build the data lake variable id of a stream's go2rtc ingest stat. The 'rtsp' infix keeps the two
 * legs of an RTSP stream played through go2rtc's WebRTC output unmistakable under one stream name.
 * @param {string} internalName - Internal stream name (persisted artifacts never use the external id)
 * @param {Go2rtcStreamStatKey} statKey - go2rtc ingest stat key
 * @returns {string} Data lake variable id
 */
export const go2rtcStreamStatVariableId = (internalName: string, statKey: Go2rtcStreamStatKey): string =>
  `stream-${internalName}-rtsp-${statKey}`

const isRtspUrlStreamStatId = (id: string): boolean => /^stream-rtsps?:\/\//i.test(id)

// Peel `stream-<name>` from an id that ends with a minting-function suffix, then remint to confirm.
// endsWith alone is not enough: one published key can be a suffix of another, and stream names have hyphens.
const nameBeforeStreamStatSuffix = (id: string, suffix: string): string | undefined => {
  if (!id.startsWith('stream-') || !id.endsWith(suffix)) return undefined
  const name = id.slice('stream-'.length, id.length - suffix.length)
  return name.length > 0 ? name : undefined
}

const publishedWebRtcStatSuffix = (key: string): string => streamStatVariableId('', key).slice('stream-'.length)

const isWebRtcStreamStatId = (id: string): boolean =>
  webRtcStreamStatVariableKeys.some((key) => {
    const publishedSuffix = publishedWebRtcStatSuffix(key)
    const publishedName = nameBeforeStreamStatSuffix(id, publishedSuffix)
    if (publishedName !== undefined && streamStatVariableId(publishedName, key) === id) return true

    // When minting remaps a key, also treat stream-<name>-<rawKey> as a stream-stat id so the old form can be pruned.
    const rawSuffix = `-${key}`
    if (rawSuffix === publishedSuffix) return false
    const rawName = nameBeforeStreamStatSuffix(id, rawSuffix)
    return rawName !== undefined && streamStatVariableId(rawName, key) === `stream-${rawName}${publishedSuffix}`
  })

const isGo2rtcStreamStatId = (id: string): boolean =>
  go2rtcStreamStatKeys.some((key) => {
    const suffix = go2rtcStreamStatVariableId('', key).slice('stream-'.length)
    const name = nameBeforeStreamStatSuffix(id, suffix)
    return name !== undefined && go2rtcStreamStatVariableId(name, key) === id
  })

const isStreamStatVariableId = (id: string): boolean => isWebRtcStreamStatId(id) || isGo2rtcStreamStatId(id)

/**
 * Pick the recorded stream-stat IDs that are no longer worth recording: those of deleted streams,
 * and pre-switch IDs keyed by external id (an RTSP URL may carry credentials into an export header).
 * @param {string[]} recordedIds - Currently recorded data-lake variable IDs
 * @param {string[] | undefined} liveInternalNames - Internal stream names currently in the correspondency,
 * or undefined while that list cannot be trusted to describe the configured streams
 * @returns {string[]} Recorded IDs that should be dropped
 */
export const staleStreamStatRecordedIds = (
  recordedIds: string[],
  liveInternalNames: string[] | undefined
): string[] => {
  // An empty or not-yet-loaded correspondency is not evidence that a stream is gone, so it only ever
  // drops the credential-bearing ids, which must not persist whichever streams are live.
  if (liveInternalNames === undefined || liveInternalNames.length === 0) {
    return recordedIds.filter(isRtspUrlStreamStatId)
  }

  const liveIds = new Set(
    liveInternalNames.flatMap((name) => [
      ...webRtcStreamStatVariableKeys.map((key) => streamStatVariableId(name, key)),
      ...go2rtcStreamStatKeys.map((key) => go2rtcStreamStatVariableId(name, key)),
    ])
  )

  return recordedIds.filter((id) => {
    if (isRtspUrlStreamStatId(id)) return true
    return isStreamStatVariableId(id) && !liveIds.has(id)
  })
}
