import { expect, test } from 'vitest'

import {
  derivedWebRtcStreamStats,
  externalIdStatRecordingReplacements,
  GO2RTC_STALL_QUANTUM_MS,
  GO2RTC_STALL_WARMUP_MS,
  go2rtcStreamStatKeys,
  go2rtcStreamStatVariableId,
  nextGo2rtcStallCount,
  staleStreamStatRecordedIds,
  streamStatDisplayName,
  streamStatVariableId,
  webRtcStreamStatKeys,
} from '@/libs/video/stream-stats'
import type { WebRTCVideoStats } from '@/types/video'

const webRtcKey = webRtcStreamStatKeys[0]
const go2rtcKey = go2rtcStreamStatKeys[0]

const webRtcStats = (bitrate?: number): WebRTCVideoStats => ({ bitrate } as WebRTCVideoStats)

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

test('the bitrate stats of a live stream are not stale, and those of a deleted one are', () => {
  const bitrateIds = (name: string): string[] => [
    streamStatVariableId(name, 'bitrate'),
    streamStatVariableId(name, 'bitrateKbps'),
    streamStatVariableId(name, 'frameHeight'),
  ]

  expect(staleStreamStatRecordedIds(bitrateIds('Front Camera'), ['Front Camera'])).toEqual([])
  expect(staleStreamStatRecordedIds(bitrateIds('Old Camera'), ['Front Camera'])).toEqual(bitrateIds('Old Camera'))
})

test('the RTSP stall count is published under the rtsp infix', () => {
  expect(go2rtcStreamStatVariableId('front', 'stallCount')).toBe('stream-front-rtsp-stallCount')
})

test('a missing RTSP rate or a zero bitrate during warmup does not increment the stall count', () => {
  expect(GO2RTC_STALL_WARMUP_MS).toBe(5000)
  expect(GO2RTC_STALL_QUANTUM_MS).toBe(100)
  const windowMs = GO2RTC_STALL_QUANTUM_MS
  expect(nextGo2rtcStallCount(2, 0, undefined, GO2RTC_STALL_WARMUP_MS + windowMs, windowMs)).toEqual({
    stallCount: 2,
    remainderMs: 0,
    stalled: false,
  })
  expect(nextGo2rtcStallCount(0, 0, 0, 0, windowMs)).toEqual({ stallCount: 0, remainderMs: 0, stalled: false })
  expect(nextGo2rtcStallCount(0, 0, 0, GO2RTC_STALL_WARMUP_MS - 1, windowMs)).toEqual({
    stallCount: 0,
    remainderMs: 0,
    stalled: false,
  })
  expect(nextGo2rtcStallCount(0, 0, 0, GO2RTC_STALL_WARMUP_MS, GO2RTC_STALL_WARMUP_MS)).toEqual({
    stallCount: 0,
    remainderMs: 0,
    stalled: false,
  })
})

test('a zero RTSP bitrate after warmup counts stalled time, and a positive bitrate does not', () => {
  const quantum = GO2RTC_STALL_QUANTUM_MS
  expect(nextGo2rtcStallCount(0, 0, 0, GO2RTC_STALL_WARMUP_MS + quantum, quantum)).toEqual({
    stallCount: 1,
    remainderMs: 0,
    stalled: true,
  })
  const slowWindow = 50 * quantum
  expect(nextGo2rtcStallCount(3, 0, 0, GO2RTC_STALL_WARMUP_MS + slowWindow, slowWindow)).toEqual({
    stallCount: 53,
    remainderMs: 0,
    stalled: true,
  })
  expect(nextGo2rtcStallCount(4, 40, 1000, GO2RTC_STALL_WARMUP_MS + quantum, quantum)).toEqual({
    stallCount: 4,
    remainderMs: 40,
    stalled: false,
  })
})

test('a fully zero-bitrate RTSP outage counts the same at the fast poll and the slow poll', () => {
  const quantum = GO2RTC_STALL_QUANTUM_MS
  const outageMs = 100 * quantum
  let fastCount = 0
  let fastRemainder = 0
  for (let step = 1; step <= outageMs / quantum; step++) {
    const advance = nextGo2rtcStallCount(fastCount, fastRemainder, 0, GO2RTC_STALL_WARMUP_MS + step * quantum, quantum)
    fastCount = advance.stallCount
    fastRemainder = advance.remainderMs
  }

  const half = outageMs / 2
  const firstHalf = nextGo2rtcStallCount(0, 0, 0, GO2RTC_STALL_WARMUP_MS + half, half)
  const secondHalf = nextGo2rtcStallCount(
    firstHalf.stallCount,
    firstHalf.remainderMs,
    0,
    GO2RTC_STALL_WARMUP_MS + outageMs,
    half
  )

  expect(fastCount).toBe(100)
  expect(secondHalf.stallCount).toBe(fastCount)
  expect(secondHalf.remainderMs).toBe(fastRemainder)
})

test('a short zero-bitrate window keeps the leftover until it makes a whole stall count', () => {
  const half = GO2RTC_STALL_QUANTUM_MS / 2
  const first = nextGo2rtcStallCount(0, 0, 0, GO2RTC_STALL_WARMUP_MS + half, half)
  expect(first).toEqual({ stallCount: 0, remainderMs: half, stalled: true })

  const second = nextGo2rtcStallCount(first.stallCount, first.remainderMs, 0, GO2RTC_STALL_WARMUP_MS + half * 2, half)
  expect(second).toEqual({ stallCount: 1, remainderMs: 0, stalled: true })
})

test('a recording made under a stream external id carries over to its internal name', () => {
  const recorded = ['stream-UDP Stream 0-bytesReceived', 'stream-UDP Stream 0-jitter', '/mavlink/1/1/HEARTBEAT/type']

  expect(externalIdStatRecordingReplacements(recorded, [{ externalId: 'UDP Stream 0', name: 'Front' }])).toEqual({
    'stream-UDP Stream 0-bytesReceived': streamStatVariableId('Front', 'bytesReceived'),
    'stream-UDP Stream 0-jitter': streamStatVariableId('Front', 'jitter'),
  })
})

test('a credential-bearing external id carries over too, so it leaves the selection', () => {
  const rtspId = 'stream-rtsp://user:secret@192.168.2.2:554/stream-bytesReceived'
  const corrs = [{ externalId: 'rtsp://user:secret@192.168.2.2:554/stream', name: 'Bow' }]

  expect(externalIdStatRecordingReplacements([rtspId], corrs)).toEqual({
    [rtspId]: streamStatVariableId('Bow', 'bytesReceived'),
  })
})

test('nothing carries over for a stream whose name is its external id, or another stream name', () => {
  const corrs = [
    { externalId: 'Front', name: 'Front' },
    { externalId: 'Rear', name: 'Rear camera' },
    { externalId: 'Cam', name: 'Rear' },
  ]
  const recorded = [streamStatVariableId('Front', 'bytesReceived'), streamStatVariableId('Rear', 'bytesReceived')]

  expect(externalIdStatRecordingReplacements(recorded, corrs)).toEqual({})
})

test('carrying over is idempotent', () => {
  const corrs = [{ externalId: 'UDP Stream 0', name: 'Front' }]
  const replacements = externalIdStatRecordingReplacements(['stream-UDP Stream 0-bytesReceived'], corrs)

  expect(externalIdStatRecordingReplacements(Object.values(replacements), corrs)).toEqual({})
})

test('live stream-stat ids are not stale, including suffix pairs, odd names, and unrelated ids', () => {
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
    go2rtcStreamStatVariableId(liveName, 'bitrateKbps'),
    bytesReceived,
    headerBytesReceived,
    go2rtcStreamStatVariableId(liveName, 'stallCount'),
    streamStatVariableId(streamyName, 'jitter'),
    go2rtcStreamStatVariableId(streamyName, 'bitrateKbps'),
    streamStatVariableId(hyphenatedName, 'framesPerSecond'),
    go2rtcStreamStatVariableId(hyphenatedName, 'bytes'),
  ]

  expect(bytesReceived).not.toBe(headerBytesReceived)
  expect(staleStreamStatRecordedIds(ids, [liveName, streamyName, hyphenatedName])).toEqual([])
})

test('gone-stream ids, a longer near-name, and credential-bearing external ids are stale', () => {
  const liveName = 'Front Camera'
  const deletedName = 'Old Camera'
  const rtspExternalId = 'rtsp://user:secret@192.168.2.2:554/stream'
  const kept = [
    '/mavlink/1/1/HEARTBEAT/type',
    streamStatVariableId(liveName, webRtcKey),
    go2rtcStreamStatVariableId(liveName, 'bitrateKbps'),
    streamStatVariableId('cam', webRtcKey),
  ]
  const stale = [
    streamStatVariableId(deletedName, webRtcKey),
    `stream-${rtspExternalId}-${webRtcKey}`,
    'stream-rtsp://user:secret@192.168.2.2:554/other',
    streamStatVariableId(deletedName, 'jitter'),
    go2rtcStreamStatVariableId(deletedName, 'bitrateKbps'),
    go2rtcStreamStatVariableId(deletedName, 'stallCount'),
    streamStatVariableId('cam-extra', webRtcKey),
    'stream-rtsps://user:secret@192.168.2.2:554/stream-bytesReceived',
  ]

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
    streamStatVariableId('Front Camera', 'bytesReceived'),
    go2rtcStreamStatVariableId('Front Camera', 'bitrateKbps'),
    '/mavlink/1/1/HEARTBEAT/type',
  ]

  expect(staleStreamStatRecordedIds(ids, [])).toEqual([])
  expect(staleStreamStatRecordedIds(ids, undefined)).toEqual([])
})

test('credential-bearing ids are dropped even when the correspondency is empty or not yet loaded', () => {
  const liveStatId = streamStatVariableId('Front Camera', 'bytesReceived')
  const credentialId = 'stream-rtsp://user:secret@192.168.2.2:554/stream-bytesReceived'

  expect(staleStreamStatRecordedIds([liveStatId, credentialId], [])).toEqual([credentialId])
  expect(staleStreamStatRecordedIds([liveStatId, credentialId], undefined)).toEqual([credentialId])
})
