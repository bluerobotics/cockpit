import type { UnprocessedVideoInfo } from '@/types/video'

/**
 * A recording's time window and resolution, to render a telemetry overlay for.
 */
export interface TelemetryOverlayWindow {
  /**
   * When the recording started. Overlay timestamps are relative to it.
   */
  start: Date
  /**
   * When the recording finished
   */
  end: Date
  /**
   * Width of the video, in pixels
   */
  width: number
  /**
   * Height of the video, in pixels
   */
  height: number
  /**
   * Where the window was taken from, to tell the candidates apart while logging
   */
  source: string
}

// Recordings made before the resolution was stored, and windows rebuilt from chunks, have none to go by.
const fallbackResolution = { width: 1920, height: 1080 }

/**
 * The windows a recording's telemetry overlay can be generated for, best first.
 *
 * The recording metadata comes first because it holds the real start and finish. Chunk timestamps are
 * a reconstruction, only as good as the clock that wrote them, and a chunk whose timestamp is unknown
 * reads as the epoch, so it is left out.
 * @param {UnprocessedVideoInfo | undefined} recording - Metadata of the recording, while still known
 * @param {Date[]} chunkTimestamps - Timestamps of the recording's chunks, in any order
 * @returns {TelemetryOverlayWindow[]} Candidate windows, in the order they should be tried
 */
export const telemetryOverlayWindowCandidates = (
  recording: UnprocessedVideoInfo | undefined,
  chunkTimestamps: Date[]
): TelemetryOverlayWindow[] => {
  const candidates: TelemetryOverlayWindow[] = []

  if (recording?.dateStart && recording?.dateFinish) {
    candidates.push({
      start: new Date(recording.dateStart),
      end: new Date(recording.dateFinish),
      width: recording.vWidth ?? fallbackResolution.width,
      height: recording.vHeight ?? fallbackResolution.height,
      source: 'recording metadata',
    })
  }

  const knownEpochs = chunkTimestamps.map((timestamp) => timestamp.getTime()).filter((epoch) => epoch > 0)
  if (knownEpochs.length > 0) {
    candidates.push({
      start: new Date(Math.min(...knownEpochs)),
      // Every chunk covers the second that follows it, so the recording ends a second after the last one.
      end: new Date(Math.max(...knownEpochs) + 1000),
      ...fallbackResolution,
      source: 'chunk timestamps',
    })
  }

  return candidates
}
