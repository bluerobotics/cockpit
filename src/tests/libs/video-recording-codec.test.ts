import { describe, expect, it } from 'vitest'

import {
  codecNameFromStats,
  joinRecordingHead,
  negotiatedVideoCodecNames,
  recordingMimeType,
  recordingVideoBitsPerSecond,
  videoTrackSettingsWithSize,
} from '@/libs/video-recording-codec'

const statsReport = (reports: Record<string, unknown>[]): RTCStatsReport =>
  new Map(reports.map((report) => [report.id as string, report])) as unknown as RTCStatsReport

const peerConnectionReceiving = (tracks: [string, string[]][]): RTCPeerConnection =>
  ({
    getReceivers: () =>
      tracks.map(([kind, codecs]) => ({
        track: { kind },
        getParameters: () => ({ codecs: codecs.map((mimeType) => ({ mimeType })) }),
      })),
  } as unknown as RTCPeerConnection)

const supportsEverything = (): boolean => true
const supportsNothing = (): boolean => false
const supportsOnlyH264 = (type: string): boolean => type.includes('avc1')

describe('recordingMimeType', () => {
  it('records non-HEVC streams by copying their frames, without naming a type', () => {
    expect(recordingMimeType('H264', true, supportsEverything)).toBeUndefined()
    expect(recordingMimeType('VP8', true, supportsEverything)).toBeUndefined()
    expect(recordingMimeType(undefined, true, supportsEverything)).toBeUndefined()
  })

  it('names an explicit type for HEVC streams, whatever case the codec is reported in', () => {
    expect(recordingMimeType('H265', true, supportsEverything)).toBe('video/x-matroska;codecs=hvc1.1.6.L186.B0')
    expect(recordingMimeType('h265', true, supportsEverything)).toBe('video/x-matroska;codecs=hvc1.1.6.L186.B0')
    expect(recordingMimeType('hevc', true, supportsEverything)).toBe('video/x-matroska;codecs=hvc1.1.6.L186.B0')
  })

  it('falls back to H.264 when HEVC cannot be encoded', () => {
    expect(recordingMimeType('H265', true, supportsOnlyH264)).toBe('video/x-matroska;codecs=avc1')
  })

  it('still names a type when nothing is supported, so the failure surfaces as a catchable error', () => {
    expect(recordingMimeType('H265', true, supportsNothing)).toBe('video/x-matroska;codecs=hvc1.1.6.L186.B0')
  })

  it('leaves HEVC alone where copying its frames does not crash, so the recording stays lossless', () => {
    expect(recordingMimeType('H265', false, supportsEverything)).toBeUndefined()
    expect(recordingMimeType('hevc', false, supportsOnlyH264)).toBeUndefined()
  })
})

describe('codecNameFromStats', () => {
  it('reads the codec of the video stream, ignoring the audio one', () => {
    const stats = statsReport([
      { id: 'C1', type: 'codec', mimeType: 'audio/opus' },
      { id: 'C2', type: 'codec', mimeType: 'video/H265' },
      { id: 'R1', type: 'inbound-rtp', kind: 'audio', codecId: 'C1' },
      { id: 'R2', type: 'inbound-rtp', kind: 'video', codecId: 'C2' },
    ])
    expect(codecNameFromStats(stats)).toBe('H265')
  })

  it('tells nothing while no packet has been processed, so callers can fall back', () => {
    const noCodecYet = statsReport([{ id: 'R1', type: 'inbound-rtp', kind: 'video' }])
    expect(codecNameFromStats(noCodecYet)).toBeUndefined()
    expect(codecNameFromStats(statsReport([]))).toBeUndefined()
  })
})

describe('negotiatedVideoCodecNames', () => {
  it('lists the video codecs of the connection, in the negotiated order', () => {
    const peerConnection = peerConnectionReceiving([
      ['audio', ['audio/opus']],
      ['video', ['video/H265', 'video/H264']],
    ])
    expect(negotiatedVideoCodecNames(peerConnection)).toEqual(['H265', 'H264'])
  })

  it('lists nothing when the connection receives no video', () => {
    expect(negotiatedVideoCodecNames(peerConnectionReceiving([]))).toEqual([])
  })
})

describe('recordingVideoBitsPerSecond', () => {
  it('scales with the picture, so a 4K camera is not recorded at a 720p rate', () => {
    const hd = recordingVideoBitsPerSecond({ width: 1280, height: 720, frameRate: 30 })
    expect(recordingVideoBitsPerSecond({ width: 3840, height: 2160, frameRate: 30 })).toBe(hd * 9)
  })

  it('assumes 1080p30 when the track reports no settings', () => {
    const fullHd = recordingVideoBitsPerSecond({ width: 1920, height: 1080, frameRate: 30 })
    expect(recordingVideoBitsPerSecond({})).toBe(fullHd)
  })

  it('keeps a small picture off the floor, where the rate alone starves it', () => {
    // 320x240 at 15fps scales to about 80kbps, an eighth of what such a camera was measured sending
    expect(recordingVideoBitsPerSecond({ width: 320, height: 240, frameRate: 15 })).toBe(1_000_000)
    expect(recordingVideoBitsPerSecond({ width: 3840, height: 2160, frameRate: 30 })).toBeGreaterThan(1_000_000)
  })
})

describe('videoTrackSettingsWithSize', () => {
  const trackReportingSizeAfter = (calls: number): MediaStreamTrack => {
    let remaining = calls
    return {
      getSettings: () => (remaining-- > 0 ? {} : { width: 3840, height: 2160, frameRate: 30 }),
    } as unknown as MediaStreamTrack
  }

  it('waits for the size of a track that has not decoded a frame yet', async () => {
    expect(await videoTrackSettingsWithSize(trackReportingSizeAfter(3))).toEqual({
      width: 3840,
      height: 2160,
      frameRate: 30,
    })
  })

  it('gives up on the timeout, so a stream that never delivers frames cannot hold the recording', async () => {
    expect(await videoTrackSettingsWithSize(trackReportingSizeAfter(Infinity), 100)).toEqual({})
  })
})

describe('joinRecordingHead', () => {
  const chunksOf = (...sizes: number[]): ((index: number) => Promise<Blob | undefined>) => {
    const blobs = sizes.map((size) => new Blob([new Uint8Array(size)]))
    return async (index: number): Promise<Blob | undefined> => blobs[index]
  }

  it('joins leading chunks until the header can be read out of them', async () => {
    // MediaRecorder can open a recording with a single byte, splitting even the EBML magic across chunks
    const { head, consumed } = await joinRecordingHead(chunksOf(1, 3, 40_000, 40_000))
    expect(consumed).toBe(3)
    expect(head.size).toBe(40_004)
  })

  it('takes only the first chunk when it already carries the header', async () => {
    const { head, consumed } = await joinRecordingHead(chunksOf(40_000, 40_000))
    expect(consumed).toBe(1)
    expect(head.size).toBe(40_000)
  })

  it('stops at the end of a recording too short to reach the threshold', async () => {
    const { head, consumed } = await joinRecordingHead(chunksOf(10, 20))
    expect(consumed).toBe(2)
    expect(head.size).toBe(30)
  })
})
