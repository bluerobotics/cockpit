import { expect, test } from 'vitest'

import {
  pruneStaleStreamStatRecordedIds,
  sessionRangeCoveringBatch,
  sessionWithCreditedPoints,
} from '@/libs/data-lake-logging'
import {
  go2rtcStreamStatKeys,
  go2rtcStreamStatVariableId,
  streamStatVariableId,
  webRtcStreamStatKeys,
} from '@/libs/video/stream-stats'

const webRtcKey = webRtcStreamStatKeys[0]
const go2rtcKey = go2rtcStreamStatKeys[0]
const sessionGapMs = 5 * 60 * 1000

test('a flushed batch widens the session range without counting the points', () => {
  const session = sessionRangeCoveringBatch(null, 1000, 2000, 2001)

  expect(session.startTime).toBe(2000)
  expect(session.endTime).toBe(2001)
  expect(session.dataPointCount).toBe(0)
  expect(session.bootId).toBe(1000)

  const widened = sessionRangeCoveringBatch(session, 1000, 2002, 2003)
  expect(widened.startTime).toBe(2000)
  expect(widened.endTime).toBe(2003)
  expect(widened.dataPointCount).toBe(0)

  const credited = sessionWithCreditedPoints(widened, 2000, 4)
  expect(credited?.dataPointCount).toBe(4)
  expect(sessionRangeCoveringBatch(credited, 1000, 2004, 2005).dataPointCount).toBe(4)
})

test('a gap larger than the threshold opens a new session instead of stretching the old range', () => {
  const session = sessionRangeCoveringBatch(null, 1000, 2000, 2000)
  const next = sessionRangeCoveringBatch(session, 1000, 2000 + sessionGapMs + 1, 2000 + sessionGapMs + 1)

  expect(next.id).not.toBe(session.id)
  expect(next.startTime).toBe(2000 + sessionGapMs + 1)
  expect(next.dataPointCount).toBe(0)
})

test('a gap of exactly the session threshold stays on the same session', () => {
  const session = sessionRangeCoveringBatch(null, 1000, 2000, 2000)
  const next = sessionRangeCoveringBatch(session, 1000, 2000 + sessionGapMs, 2000 + sessionGapMs)

  expect(next.id).toBe(session.id)
  expect(next.startTime).toBe(2000)
  expect(next.endTime).toBe(2000 + sessionGapMs)
  expect(next.dataPointCount).toBe(0)
})

test('points are credited only once the batch is inside the session range', () => {
  const session = sessionRangeCoveringBatch(null, 1000, 2000, 2010)

  expect(sessionWithCreditedPoints(session, 2000, 4)?.dataPointCount).toBe(4)
  expect(sessionWithCreditedPoints(session, 1999, 4)).toBeNull()
  expect(sessionWithCreditedPoints(session, 2011, 4)).toBeNull()
})

test('recorded stream-stat ids of live streams survive a prune, along with unrelated ids', () => {
  const liveName = 'Front Camera'
  const otherId = '/mavlink/1/1/HEARTBEAT/type'
  const liveWebRtcId = streamStatVariableId(liveName, webRtcKey)
  const liveGo2rtcId = go2rtcStreamStatVariableId(liveName, go2rtcKey)

  expect(pruneStaleStreamStatRecordedIds([otherId, liveWebRtcId, liveGo2rtcId], [liveName])).toEqual([
    otherId,
    liveWebRtcId,
    liveGo2rtcId,
  ])
})

test('deleted-stream and pre-switch external-id stream-stat ids are dropped, including RTSP URLs with credentials', () => {
  const liveName = 'Front Camera'
  const liveId = streamStatVariableId(liveName, webRtcKey)
  const deletedId = streamStatVariableId('Old Camera', webRtcKey)
  const rtspExternalId = 'rtsp://user:secret@192.168.2.2:554/stream'
  const preSwitchId = `stream-${rtspExternalId}-${webRtcKey}`
  const credentialOnlyId = 'stream-rtsp://user:secret@192.168.2.2:554/other'
  const otherId = '/mavlink/1/1/HEARTBEAT/type'

  expect(
    pruneStaleStreamStatRecordedIds([otherId, liveId, deletedId, preSwitchId, credentialOnlyId], [liveName])
  ).toEqual([otherId, liveId])
})

test('a shorter live name does not keep stream-stat ids of a longer distinct name', () => {
  const kept = streamStatVariableId('cam', webRtcKey)
  const other = streamStatVariableId('cam-extra', webRtcKey)

  expect(pruneStaleStreamStatRecordedIds([kept, other], ['cam'])).toEqual([kept])
})

test('a pre-rename WebRTC bitrate id is pruned and the published bitrateBps id survives', () => {
  const liveName = 'Front Camera'
  const staleBitrateId = `stream-${liveName}-bitrate`
  const liveBitrateId = streamStatVariableId(liveName, 'bitrate')

  expect(liveBitrateId).toBe(`stream-${liveName}-bitrateBps`)
  expect(pruneStaleStreamStatRecordedIds([staleBitrateId, liveBitrateId], [liveName])).toEqual([liveBitrateId])
})

test("a deleted stream's published ids are pruned, including bitrateBps and both stat families", () => {
  const liveName = 'Front Camera'
  const deletedName = 'Old Camera'
  const liveBitrateId = streamStatVariableId(liveName, 'bitrate')
  const deletedBitrateId = streamStatVariableId(deletedName, 'bitrate')
  const deletedWebRtcId = streamStatVariableId(deletedName, 'frameHeight')
  const deletedGo2rtcId = go2rtcStreamStatVariableId(deletedName, 'bitrateKbps')

  expect(deletedBitrateId).toBe(`stream-${deletedName}-bitrateBps`)
  expect(
    pruneStaleStreamStatRecordedIds([liveBitrateId, deletedBitrateId, deletedWebRtcId, deletedGo2rtcId], [liveName])
  ).toEqual([liveBitrateId])
})

test("a live stream's published ids survive a prune, including bitrateBps", () => {
  const liveName = 'Front Camera'
  const ids = [
    streamStatVariableId(liveName, 'bitrate'),
    streamStatVariableId(liveName, 'frameHeight'),
    go2rtcStreamStatVariableId(liveName, 'bitrateKbps'),
  ]

  expect(ids[0]).toBe(`stream-${liveName}-bitrateBps`)
  expect(pruneStaleStreamStatRecordedIds(ids, [liveName])).toEqual(ids)
})

test('recorded ids that are not stream stats are left untouched', () => {
  const ordinary = '/mavlink/1/1/HEARTBEAT/type'
  const hyphenated = 'user-custom-depth-offset'
  const streamSubstring = 'cockpit-stream-monitor'

  expect(pruneStaleStreamStatRecordedIds([ordinary, hyphenated, streamSubstring], ['Front Camera'])).toEqual([
    ordinary,
    hyphenated,
    streamSubstring,
  ])
})

test('pruning the same recorded list twice does not drop live ids', () => {
  const liveName = 'Front Camera'
  const liveId = streamStatVariableId(liveName, webRtcKey)
  const staleId = streamStatVariableId('Gone', webRtcKey)
  const once = pruneStaleStreamStatRecordedIds([liveId, staleId], [liveName])

  expect(once).toEqual([liveId])
  expect(pruneStaleStreamStatRecordedIds(once, [liveName])).toEqual([liveId])
})

test('a live stream keeps both bytesReceived and headerBytesReceived as distinct reminted ids', () => {
  const liveName = 'Front Camera'
  const shorter = streamStatVariableId(liveName, 'bytesReceived')
  const longer = streamStatVariableId(liveName, 'headerBytesReceived')

  expect(shorter).not.toBe(longer)
  expect(pruneStaleStreamStatRecordedIds([shorter, longer], [liveName])).toEqual([shorter, longer])
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

  expect(pruneStaleStreamStatRecordedIds(ids, [streamyName, hyphenatedName])).toEqual(ids)
})

test('a pre-switch rtsps credential-bearing stream-stat id is dropped', () => {
  const liveName = 'Front Camera'
  const liveId = streamStatVariableId(liveName, webRtcKey)
  const rtspsId = 'stream-rtsps://user:secret@192.168.2.2:554/stream-bytesReceived'

  expect(pruneStaleStreamStatRecordedIds([liveId, rtspsId], [liveName])).toEqual([liveId])
})

test('no live streams means every stream-stat id is pruned', () => {
  const statId = streamStatVariableId('Front Camera', 'bitrate')
  const otherId = '/mavlink/1/1/HEARTBEAT/type'

  expect(pruneStaleStreamStatRecordedIds([statId, otherId], [])).toEqual([otherId])
})
