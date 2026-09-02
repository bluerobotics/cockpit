import type { Go2RTCStreamInfo, WebRTCVideoStat } from '@/types/video'

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
 * sampler derived over its own window
 */
export type Go2rtcStreamSample = Go2RTCStreamInfo & Go2rtcIngestRates

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

// WebRTC stats published to the data lake for every monitored stream
const webRtcCumulativeStatKeys: WebRTCVideoStat[] = [
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
] // Keys that have cumulative values
const webRtcAverageStatKeys: WebRTCVideoStat[] = [
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
] // Keys that have average values
export const webRtcStreamStatKeys = [...webRtcCumulativeStatKeys, ...webRtcAverageStatKeys]

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
] as const

/**
 * The go2rtc ingest stats published to the data lake
 */
export type Go2rtcStreamStatKey = (typeof go2rtcStreamStatKeys)[number]

/**
 * Build the data lake variable id of a stream's WebRTC stat
 * @param {string} internalName - Internal stream name (persisted artifacts never use the external id)
 * @param {string} statKey - WebRTC stat key
 * @returns {string} Data lake variable id
 */
export const streamStatVariableId = (internalName: string, statKey: string): string =>
  `stream-${internalName}-${statKey}`

/**
 * Build the data lake variable id of a stream's go2rtc ingest stat. The 'rtsp' infix keeps the two
 * legs of an RTSP stream played through go2rtc's WebRTC output unmistakable under one stream name.
 * @param {string} internalName - Internal stream name (persisted artifacts never use the external id)
 * @param {Go2rtcStreamStatKey} statKey - go2rtc ingest stat key
 * @returns {string} Data lake variable id
 */
export const go2rtcStreamStatVariableId = (internalName: string, statKey: Go2rtcStreamStatKey): string =>
  `stream-${internalName}-rtsp-${statKey}`
