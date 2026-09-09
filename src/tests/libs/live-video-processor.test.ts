import { afterEach, expect, test, vi } from 'vitest'

const removeItem = vi.fn(async () => undefined)

vi.mock('@/libs/videoStorage', () => ({
  tempVideoStorage: { removeItem },
}))

vi.mock('@/libs/utils', async () => ({
  ...(await vi.importActual<typeof import('@/libs/utils')>('@/libs/utils')),
  isElectron: () => true,
}))

import { LiveVideoProcessor } from '@/libs/live-video-processor'

const chunk = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/webm' })

afterEach(() => {
  removeItem.mockReset()
  removeItem.mockResolvedValue(undefined)
  delete window.electronAPI
})

const startProcessor = async (keepRawChunks: boolean): Promise<LiveVideoProcessor> => {
  window.electronAPI = {
    startVideoRecording: vi.fn(async () => ({ id: 'proc', outputPath: '/tmp/out.mp4' })),
  } as unknown as typeof window.electronAPI

  const processor = new LiveVideoProcessor('rec-hash', 'file.mp4', keepRawChunks)
  await processor.startProcessing()
  return processor
}

test('addChunk deletes the raw chunk from temp storage when backup is disabled', async () => {
  const processor = await startProcessor(false)

  // The regression this guards: delete used to call window.electronAPI.deleteChunk, which was never
  // implemented, so the first chunk threw and recording aborted as "First chunk was lost".
  await expect(processor.addChunk(chunk, 0)).resolves.toBeUndefined()
  expect(removeItem).toHaveBeenCalledWith('rec-hash_0')
})

test('addChunk keeps the raw chunk when backup is enabled', async () => {
  const processor = await startProcessor(true)

  await expect(processor.addChunk(chunk, 0)).resolves.toBeUndefined()
  expect(removeItem).not.toHaveBeenCalled()
})

test('addChunk still succeeds if deleting the raw chunk fails', async () => {
  removeItem.mockRejectedValueOnce(new Error('ENOENT'))
  const processor = await startProcessor(false)

  await expect(processor.addChunk(chunk, 0)).resolves.toBeUndefined()
})

test('addChunk deletes a skipped chunk when backup is disabled', async () => {
  const processor = await startProcessor(false)

  // Six out-of-order chunks make the queue skip the missing first one.
  for (let n = 2; n <= 7; n++) {
    await processor.addChunk(chunk, n)
  }
  expect(removeItem).toHaveBeenCalledWith('rec-hash_0')
})
