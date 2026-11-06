import { expect, test } from 'vitest'

import { externalIdStatRecordingReplacements, streamStatVariableId } from '@/libs/video/stream-stats'

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
