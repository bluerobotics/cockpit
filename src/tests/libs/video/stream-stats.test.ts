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

test('recorded stream-stat ids of live streams are not stale, and neither are unrelated ids', () => {
  const liveName = 'Front Camera'
  const otherId = '/mavlink/1/1/HEARTBEAT/type'
  const liveWebRtcId = streamStatVariableId(liveName, webRtcKey)
  const liveGo2rtcId = go2rtcStreamStatVariableId(liveName, go2rtcKey)

  expect(staleStreamStatRecordedIds([otherId, liveWebRtcId, liveGo2rtcId], [liveName])).toEqual([])
})

test('deleted-stream and pre-switch external-id stream-stat ids are stale, including RTSP URLs with credentials', () => {
  const liveName = 'Front Camera'
  const liveId = streamStatVariableId(liveName, webRtcKey)
  const deletedId = streamStatVariableId('Old Camera', webRtcKey)
  const rtspExternalId = 'rtsp://user:secret@192.168.2.2:554/stream'
  const preSwitchId = `stream-${rtspExternalId}-${webRtcKey}`
  const credentialOnlyId = 'stream-rtsp://user:secret@192.168.2.2:554/other'
  const otherId = '/mavlink/1/1/HEARTBEAT/type'

  expect(staleStreamStatRecordedIds([otherId, liveId, deletedId, preSwitchId, credentialOnlyId], [liveName])).toEqual([
    deletedId,
    preSwitchId,
    credentialOnlyId,
  ])
})

test('a shorter live name does not keep stream-stat ids of a longer distinct name', () => {
  const kept = streamStatVariableId('cam', webRtcKey)
  const other = streamStatVariableId('cam-extra', webRtcKey)

  expect(staleStreamStatRecordedIds([kept, other], ['cam'])).toEqual([other])
})

test('a pre-rename WebRTC bitrate id is stale and the published bitrateBps id survives', () => {
  const liveName = 'Front Camera'
  const staleBitrateId = `stream-${liveName}-bitrate`
  const liveBitrateId = streamStatVariableId(liveName, 'bitrate')

  expect(liveBitrateId).toBe(`stream-${liveName}-bitrateBps`)
  expect(staleStreamStatRecordedIds([staleBitrateId, liveBitrateId], [liveName])).toEqual([staleBitrateId])
})

test("a deleted stream's published ids are stale, including bitrateBps and both stat families", () => {
  const liveName = 'Front Camera'
  const deletedName = 'Old Camera'
  const liveBitrateId = streamStatVariableId(liveName, 'bitrate')
  const deletedBitrateId = streamStatVariableId(deletedName, 'bitrate')
  const deletedWebRtcId = streamStatVariableId(deletedName, 'frameHeight')
  const deletedGo2rtcId = go2rtcStreamStatVariableId(deletedName, 'bitrateKbps')

  expect(deletedBitrateId).toBe(`stream-${deletedName}-bitrateBps`)
  expect(
    staleStreamStatRecordedIds([liveBitrateId, deletedBitrateId, deletedWebRtcId, deletedGo2rtcId], [liveName])
  ).toEqual([deletedBitrateId, deletedWebRtcId, deletedGo2rtcId])
})

test("a live stream's published ids are never stale, including bitrateBps", () => {
  const liveName = 'Front Camera'
  const ids = [
    streamStatVariableId(liveName, 'bitrate'),
    streamStatVariableId(liveName, 'frameHeight'),
    go2rtcStreamStatVariableId(liveName, 'bitrateKbps'),
  ]

  expect(ids[0]).toBe(`stream-${liveName}-bitrateBps`)
  expect(staleStreamStatRecordedIds(ids, [liveName])).toEqual([])
})

test('the WebRTC and go2rtc kbps ids of a live stream both survive, and both go when the stream does', () => {
  const liveName = 'Front Camera'
  const deletedName = 'Old Camera'
  const liveWebRtcId = streamStatVariableId(liveName, 'bitrateKbps')
  const liveGo2rtcId = go2rtcStreamStatVariableId(liveName, 'bitrateKbps')
  const deletedWebRtcId = streamStatVariableId(deletedName, 'bitrateKbps')
  const deletedGo2rtcId = go2rtcStreamStatVariableId(deletedName, 'bitrateKbps')

  expect(
    staleStreamStatRecordedIds([liveWebRtcId, liveGo2rtcId, deletedWebRtcId, deletedGo2rtcId], [liveName])
  ).toEqual([deletedWebRtcId, deletedGo2rtcId])
})

test('recorded ids that are not stream stats are never stale', () => {
  const ordinary = '/mavlink/1/1/HEARTBEAT/type'
  const hyphenated = 'user-custom-depth-offset'
  const streamSubstring = 'cockpit-stream-monitor'

  expect(staleStreamStatRecordedIds([ordinary, hyphenated, streamSubstring], ['Front Camera'])).toEqual([])
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

test('a live stream keeps both bytesReceived and headerBytesReceived as distinct reminted ids', () => {
  const liveName = 'Front Camera'
  const shorter = streamStatVariableId(liveName, 'bytesReceived')
  const longer = streamStatVariableId(liveName, 'headerBytesReceived')

  expect(shorter).not.toBe(longer)
  expect(staleStreamStatRecordedIds([shorter, longer], [liveName])).toEqual([])
})

test('live streams whose names contain stream- or hyphens keep their stat ids', () => {
  const streamyName = 'my-stream-front'
  const hyphenatedName = 'BR-4K-Cam-RTSP'
  const ids = [
    streamStatVariableId(streamyName, 'bitrate'),
    go2rtcStreamStatVariableId(streamyName, 'bitrateKbps'),
    streamStatVariableId(hyphenatedName, 'frameHeight'),
    go2rtcStreamStatVariableId(hyphenatedName, 'bytes'),
  ]

  expect(staleStreamStatRecordedIds(ids, [streamyName, hyphenatedName])).toEqual([])
})

test('a pre-switch rtsps credential-bearing stream-stat id is stale', () => {
  const liveName = 'Front Camera'
  const liveId = streamStatVariableId(liveName, webRtcKey)
  const rtspsId = 'stream-rtsps://user:secret@192.168.2.2:554/stream-bytesReceived'

  expect(staleStreamStatRecordedIds([liveId, rtspsId], [liveName])).toEqual([rtspsId])
})

test('an empty correspondency is not evidence that a stream is gone, so nothing is dropped for it', () => {
  const statId = streamStatVariableId('Front Camera', 'bitrate')
  const go2rtcId = go2rtcStreamStatVariableId('Front Camera', 'bitrateKbps')
  const otherId = '/mavlink/1/1/HEARTBEAT/type'

  expect(staleStreamStatRecordedIds([statId, go2rtcId, otherId], [])).toEqual([])
})

test('the boot pass, with no trustworthy correspondency yet, drops nothing for missing streams', () => {
  const statId = streamStatVariableId('Front Camera', 'bitrate')
  const otherId = '/mavlink/1/1/HEARTBEAT/type'

  expect(staleStreamStatRecordedIds([statId, otherId], undefined)).toEqual([])
})

test('credential-bearing ids are dropped even when the correspondency is empty or not yet loaded', () => {
  const liveStatId = streamStatVariableId('Front Camera', 'bitrate')
  const credentialId = 'stream-rtsp://user:secret@192.168.2.2:554/stream-bytesReceived'

  expect(staleStreamStatRecordedIds([liveStatId, credentialId], [])).toEqual([credentialId])
  expect(staleStreamStatRecordedIds([liveStatId, credentialId], undefined)).toEqual([credentialId])
})
