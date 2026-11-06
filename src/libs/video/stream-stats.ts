import type { Go2RTCStreamInfo } from '@/types/video'

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
export type Go2rtcStreamSample = Go2RTCStreamInfo & Partial<Go2rtcIngestRates>

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
