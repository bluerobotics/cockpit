import { describe, expect, it } from 'vitest'

import { joinRecordingHead } from '@/libs/video-recording-codec'

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
