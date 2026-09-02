import { expect, test } from 'vitest'

import {
  buildGo2rtcStreamSample,
  derivedWebRtcStreamStats,
  go2rtcStreamStatKeys,
  go2rtcStreamStatVariableId,
  staleStreamStatRecordedIds,
  streamStatDisplayName,
  streamStatVariableId,
  webRtcStreamStatKeys,
} from '@/libs/video/stream-stats'
import type { Go2RTCStreamInfo, WebRTCVideoStats } from '@/types/video'

const webRtcKey = webRtcStreamStatKeys[0]
const go2rtcKey = go2rtcStreamStatKeys[0]

const webRtcStats = (bitrate?: number): WebRTCVideoStats => ({ bitrate } as WebRTCVideoStats)

const streamInfo = (bytes: number, packets: number, sampleEpoch: number): Go2RTCStreamInfo => ({
  codec: 'H264',
  fps: '30',
  protocol: 'rtsp+tcp',
  bytes,
  packets,
  sampleEpoch,
})

test('WebRTC bitrate is published in bits per second, named so it cannot be plotted against the RTSP kbps series as one series', () => {
  expect(streamStatVariableId('front', 'bitrate')).toBe('stream-front-bitrateBps')
  expect(streamStatDisplayName('front', 'bitrate')).toBe("Stream 'front' - bitrateBps")
})

test('the WebRTC bitrate is published in kbps too, under an id the rtsp infix keeps apart from the go2rtc one', () => {
  expect(streamStatVariableId('front', 'bitrateKbps')).toBe('stream-front-bitrateKbps')
  expect(streamStatDisplayName('front', 'bitrateKbps')).toBe("Stream 'front' - bitrateKbps")
  expect(streamStatVariableId('front', 'bitrateKbps')).not.toBe(go2rtcStreamStatVariableId('front', 'bitrateKbps'))
})

test('the WebRTC bitrate in kbps is its bits per second rounded to whole kbps, as the go2rtc series is', () => {
  expect(derivedWebRtcStreamStats(webRtcStats(1500000))).toEqual({ bitrateKbps: 1500 })
  expect(derivedWebRtcStreamStats(webRtcStats(1500600))).toEqual({ bitrateKbps: 1501 })
  expect(derivedWebRtcStreamStats(webRtcStats(400))).toEqual({ bitrateKbps: 0 })
})

test('an unknown WebRTC bitrate derives no kbps rather than a zero that would read as a stall', () => {
  expect(derivedWebRtcStreamStats(webRtcStats(undefined))).toEqual({})
  expect(derivedWebRtcStreamStats(webRtcStats(NaN))).toEqual({})
})

test('other WebRTC stats keep the library key in both the id and the display name', () => {
  expect(streamStatVariableId('front', 'frameHeight')).toBe('stream-front-frameHeight')
  expect(streamStatDisplayName('front', 'frameHeight')).toBe("Stream 'front' - frameHeight")
})

test('go2rtc ingest bitrate stays in kilobits per second', () => {
  expect(go2rtcStreamStatVariableId('front', 'bitrateKbps')).toBe('stream-front-rtsp-bitrateKbps')
})

test('the first sample of a stream publishes the counters but no rates, since no rate is derivable yet', () => {
  const sample = buildGo2rtcStreamSample(streamInfo(1000, 10, 5000), undefined)

  expect(sample.bytes).toBe(1000)
  expect(sample.packets).toBe(10)
  expect(sample.sampleEpoch).toBe(5000)
  expect('bitrateKbps' in sample).toBe(false)
  expect('packetsPerSec' in sample).toBe(false)
})

test('a sample with a real window publishes both counters and rates', () => {
  const previous = streamInfo(1000, 10, 5000)
  const sample = buildGo2rtcStreamSample(streamInfo(126000, 110, 6000), previous)

  expect(sample.bytes).toBe(126000)
  expect(sample.bitrateKbps).toBe(1000)
  expect(sample.packetsPerSec).toBe(100)
})

test('counters that went backwards publish no rates rather than a zero that would read as a stall', () => {
  const previous = streamInfo(126000, 110, 6000)
  const sample = buildGo2rtcStreamSample(streamInfo(500, 5, 7000), previous)

  expect(sample.bytes).toBe(500)
  expect('bitrateKbps' in sample).toBe(false)
  expect('packetsPerSec' in sample).toBe(false)
})

test('live stream-stat ids are not stale, including remapped keys, suffix pairs, odd names, and unrelated ids', () => {
  const liveName = 'Front Camera'
  const streamyName = 'my-stream-front'
  const hyphenatedName = 'BR-4K-Cam-RTSP'
  const bytesReceived = streamStatVariableId(liveName, 'bytesReceived')
  const headerBytesReceived = streamStatVariableId(liveName, 'headerBytesReceived')
  const ids = [
    '/mavlink/1/1/HEARTBEAT/type',
    'user-custom-depth-offset',
    'cockpit-stream-monitor',
    streamStatVariableId(liveName, webRtcKey),
    go2rtcStreamStatVariableId(liveName, go2rtcKey),
    streamStatVariableId(liveName, 'bitrate'),
    streamStatVariableId(liveName, 'frameHeight'),
    streamStatVariableId(liveName, 'bitrateKbps'),
    go2rtcStreamStatVariableId(liveName, 'bitrateKbps'),
    bytesReceived,
    headerBytesReceived,
    streamStatVariableId(streamyName, 'bitrate'),
    go2rtcStreamStatVariableId(streamyName, 'bitrateKbps'),
    streamStatVariableId(hyphenatedName, 'frameHeight'),
    go2rtcStreamStatVariableId(hyphenatedName, 'bytes'),
  ]

  expect(streamStatVariableId(liveName, 'bitrate')).toBe(`stream-${liveName}-bitrateBps`)
  expect(bytesReceived).not.toBe(headerBytesReceived)
  expect(staleStreamStatRecordedIds(ids, [liveName, streamyName, hyphenatedName])).toEqual([])
})

test('gone-stream ids, a pre-rename bitrate id, a longer near-name, and credential-bearing external ids are stale', () => {
  const liveName = 'Front Camera'
  const deletedName = 'Old Camera'
  const rtspExternalId = 'rtsp://user:secret@192.168.2.2:554/stream'
  const kept = [
    '/mavlink/1/1/HEARTBEAT/type',
    streamStatVariableId(liveName, webRtcKey),
    streamStatVariableId(liveName, 'bitrate'),
    streamStatVariableId(liveName, 'bitrateKbps'),
    go2rtcStreamStatVariableId(liveName, 'bitrateKbps'),
    streamStatVariableId('cam', webRtcKey),
  ]
  const stale = [
    streamStatVariableId(deletedName, webRtcKey),
    `stream-${rtspExternalId}-${webRtcKey}`,
    'stream-rtsp://user:secret@192.168.2.2:554/other',
    `stream-${liveName}-bitrate`,
    streamStatVariableId(deletedName, 'bitrate'),
    streamStatVariableId(deletedName, 'frameHeight'),
    streamStatVariableId(deletedName, 'bitrateKbps'),
    go2rtcStreamStatVariableId(deletedName, 'bitrateKbps'),
    streamStatVariableId('cam-extra', webRtcKey),
    'stream-rtsps://user:secret@192.168.2.2:554/stream-bytesReceived',
  ]

  expect(streamStatVariableId(liveName, 'bitrate')).toBe(`stream-${liveName}-bitrateBps`)
  expect(streamStatVariableId(deletedName, 'bitrate')).toBe(`stream-${deletedName}-bitrateBps`)
  expect(staleStreamStatRecordedIds([...kept, ...stale], [liveName, 'cam'])).toEqual(stale)
})

test('dropping the stale ids leaves a selection with nothing left to drop', () => {
  const liveName = 'Front Camera'
  const liveId = streamStatVariableId(liveName, webRtcKey)
  const staleId = streamStatVariableId('Gone', webRtcKey)
  const stale = staleStreamStatRecordedIds([liveId, staleId], [liveName])
  const remaining = [liveId, staleId].filter((id) => !stale.includes(id))

  expect(remaining).toEqual([liveId])
  expect(staleStreamStatRecordedIds(remaining, [liveName])).toEqual([])
})

test('an empty or not-yet-loaded correspondency drops nothing, because it is not evidence that a stream is gone', () => {
  const ids = [
    streamStatVariableId('Front Camera', 'bitrate'),
    go2rtcStreamStatVariableId('Front Camera', 'bitrateKbps'),
    '/mavlink/1/1/HEARTBEAT/type',
  ]

  expect(staleStreamStatRecordedIds(ids, [])).toEqual([])
  expect(staleStreamStatRecordedIds(ids, undefined)).toEqual([])
})

test('credential-bearing ids are dropped even when the correspondency is empty or not yet loaded', () => {
  const liveStatId = streamStatVariableId('Front Camera', 'bitrate')
  const credentialId = 'stream-rtsp://user:secret@192.168.2.2:554/stream-bytesReceived'

  expect(staleStreamStatRecordedIds([liveStatId, credentialId], [])).toEqual([credentialId])
  expect(staleStreamStatRecordedIds([liveStatId, credentialId], undefined)).toEqual([credentialId])
})
