import { describe, expect, it } from 'vitest'

import {
  codecNameFromStats,
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
    expect(recordingMimeType('H264', supportsEverything)).toBeUndefined()
    expect(recordingMimeType('VP8', supportsEverything)).toBeUndefined()
    expect(recordingMimeType(undefined, supportsEverything)).toBeUndefined()
  })

  it('names an explicit type for HEVC streams, whatever case the codec is reported in', () => {
    expect(recordingMimeType('H265', supportsEverything)).toBe('video/x-matroska;codecs=hvc1.1.6.L186.B0')
    expect(recordingMimeType('h265', supportsEverything)).toBe('video/x-matroska;codecs=hvc1.1.6.L186.B0')
    expect(recordingMimeType('hevc', supportsEverything)).toBe('video/x-matroska;codecs=hvc1.1.6.L186.B0')
  })

  it('falls back to H.264 when HEVC cannot be encoded', () => {
    expect(recordingMimeType('H265', supportsOnlyH264)).toBe('video/x-matroska;codecs=avc1')
  })

  it('still names a type when nothing is supported, so the failure surfaces as a catchable error', () => {
    expect(recordingMimeType('H265', supportsNothing)).toBe('video/x-matroska;codecs=hvc1.1.6.L186.B0')
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
