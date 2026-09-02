import { describe, expect, it } from 'vitest'

import { telemetryOverlayWindowCandidates } from '@/libs/video-telemetry'
import type { UnprocessedVideoInfo } from '@/types/video'

const buildRecording = (info: Partial<UnprocessedVideoInfo>): UnprocessedVideoInfo => ({
  fileName: 'Cockpit (Sep 02, 2026 - 10꞉00꞉00 GMT-3) #abc12345.mp4',
  dateStart: new Date('2026-09-02T13:00:00Z'),
  dateFinish: new Date('2026-09-02T13:00:30Z'),
  dateLastRecordingUpdate: new Date('2026-09-02T13:00:30Z'),
  dateLastProcessingUpdate: undefined,
  lastKnownFileSize: undefined,
  lastKnownNumberOfChunks: undefined,
  vWidth: 1280,
  vHeight: 720,
  ...info,
})

const chunkTimestamps = [
  new Date('2026-09-02T13:00:02Z'),
  new Date('2026-09-02T13:00:00Z'),
  new Date('2026-09-02T13:00:01Z'),
]

describe('telemetryOverlayWindowCandidates', () => {
  it('prefers the recording metadata, with the resolution the recording was made at', () => {
    const candidates = telemetryOverlayWindowCandidates(buildRecording({}), chunkTimestamps)

    expect(candidates.map((candidate) => candidate.source)).toEqual(['recording metadata', 'chunk timestamps'])
    expect(candidates[0].start.toISOString()).toBe('2026-09-02T13:00:00.000Z')
    expect(candidates[0].end.toISOString()).toBe('2026-09-02T13:00:30.000Z')
    expect(candidates[0]).toMatchObject({ width: 1280, height: 720 })
  })

  it('rebuilds the window from the chunk timestamps when there is no metadata left', () => {
    const candidates = telemetryOverlayWindowCandidates(undefined, chunkTimestamps)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].source).toBe('chunk timestamps')
    expect(candidates[0].start.toISOString()).toBe('2026-09-02T13:00:00.000Z')
    // The last chunk starts at 13:00:02 and covers the second that follows it.
    expect(candidates[0].end.toISOString()).toBe('2026-09-02T13:00:03.000Z')
    expect(candidates[0]).toMatchObject({ width: 1920, height: 1080 })
  })

  it('falls back to a standard resolution when the recording did not store one', () => {
    const candidates = telemetryOverlayWindowCandidates(buildRecording({ vWidth: undefined, vHeight: undefined }), [])

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ width: 1920, height: 1080 })
  })

  it('discards chunks with an unknown timestamp', () => {
    const candidates = telemetryOverlayWindowCandidates(undefined, [new Date(0), ...chunkTimestamps, new Date(0)])

    expect(candidates[0].start.toISOString()).toBe('2026-09-02T13:00:00.000Z')
  })

  it('has no window to offer for a recording with neither metadata nor timed chunks', () => {
    expect(telemetryOverlayWindowCandidates(undefined, [new Date(0)])).toEqual([])
    expect(telemetryOverlayWindowCandidates(buildRecording({ dateFinish: undefined }), [])).toEqual([])
  })
})
