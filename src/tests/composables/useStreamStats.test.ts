import { beforeEach, expect, test, vi } from 'vitest'

import type { SnackbarOptions } from '@/composables/snackbar'
import { go2rtcStreamStatVariableId, streamStatVariableId } from '@/libs/video/stream-stats'

const snackbars: string[] = []
let recordedVariableIds: string[] = []
const removed: string[][] = []

vi.mock('@/composables/snackbar', () => ({
  openSnackbar: (options: SnackbarOptions) => snackbars.push(options.message),
}))
vi.mock('@/stores/video', () => ({ useVideoStore: () => ({}) }))
vi.mock('@/libs/data-lake-logging', () => ({
  addRecordedVariableIdsChangedHandler: () => undefined,
  dataLakeLogger: {
    get recordedVariableIds(): string[] {
      return recordedVariableIds
    },
    removeRecordedVariableIds: (ids: string[]) => {
      removed.push(ids)
      recordedVariableIds = recordedVariableIds.filter((id) => !ids.includes(id))
    },
  },
}))

import { dropStaleStreamStatRecordings } from '@/composables/useStreamStats'

const liveName = 'Front Camera'
const goneName = 'Old Camera'

beforeEach(() => {
  snackbars.length = 0
  removed.length = 0
  recordedVariableIds = []
})

test('dropping two selections of a deleted stream drops them once and says how many went', () => {
  const liveId = streamStatVariableId(liveName, 'bitrate')
  const goneWebRtcId = streamStatVariableId(goneName, 'bitrate')
  const goneGo2rtcId = go2rtcStreamStatVariableId(goneName, 'bitrateKbps')
  recordedVariableIds = [liveId, goneWebRtcId, goneGo2rtcId]

  dropStaleStreamStatRecordings([liveName])

  expect(removed).toEqual([[goneWebRtcId, goneGo2rtcId]])
  expect(recordedVariableIds).toEqual([liveId])
  expect(snackbars).toHaveLength(1)
  expect(snackbars[0]).toContain('2 video stream statistics')
})

test('a single dropped selection is announced in the singular', () => {
  recordedVariableIds = [streamStatVariableId(goneName, 'bitrate')]

  dropStaleStreamStatRecordings([liveName])

  expect(snackbars).toHaveLength(1)
  expect(snackbars[0]).toContain('1 video stream statistic that')
})

test('nothing to drop means no write and no snackbar', () => {
  recordedVariableIds = [streamStatVariableId(liveName, 'bitrate')]

  dropStaleStreamStatRecordings([liveName])

  expect(removed).toEqual([])
  expect(snackbars).toEqual([])
})

test('an untrustworthy correspondency drops nothing and says nothing, credentials aside', () => {
  const liveId = streamStatVariableId(liveName, 'bitrate')
  const goneId = streamStatVariableId(goneName, 'bitrate')
  recordedVariableIds = [liveId, goneId]

  dropStaleStreamStatRecordings(undefined)
  dropStaleStreamStatRecordings([])

  expect(removed).toEqual([])
  expect(snackbars).toEqual([])
  expect(recordedVariableIds).toEqual([liveId, goneId])
})

test('a credential-bearing selection is dropped and announced even on the boot pass', () => {
  const credentialId = 'stream-rtsp://user:secret@192.168.2.2:554/stream-bytesReceived'
  recordedVariableIds = [streamStatVariableId(liveName, 'bitrate'), credentialId]

  dropStaleStreamStatRecordings(undefined)

  expect(removed).toEqual([[credentialId]])
  expect(snackbars).toHaveLength(1)
})
