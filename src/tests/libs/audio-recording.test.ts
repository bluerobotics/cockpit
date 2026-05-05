import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { recoverInterruptedAudioRecordings } from '@/libs/audio-recording'
import type { StorageDB } from '@/types/general'

type MemoryStorage = StorageDB & {
  /**
   * Stored blobs by key, read directly by the assertions
   */
  items: Map<string, Blob>
}

const memoryStorage = (): MemoryStorage => {
  const items = new Map<string, Blob>()
  return {
    items,
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => void items.set(key, value),
    removeItem: async (key) => void items.delete(key),
    clear: async () => items.clear(),
    keys: async () => [...items.keys()],
  }
}

// Read through getters at call time, since the mock factory is hoisted above this declaration.
const storages = {} as Record<'audio' | 'temp', MemoryStorage>

vi.mock('@/libs/videoStorage', () => ({
  get audioStorage() {
    return storages.audio
  },
  get tempAudioStorage() {
    return storages.temp
  },
}))

const fileName = 'Dive (Nov 17, 2026 - 10꞉00꞉00 GMT-3) #abcd1234.webm'
const dateStart = new Date('2026-11-17T13:00:00Z')

beforeEach(() => {
  storages.audio = memoryStorage()
  storages.temp = memoryStorage()
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'locks')
})

const backUpChunks = (count: number): void => {
  for (let i = 0; i < count; i++) storages.temp.items.set(`${fileName}_${i}`, new Blob([`[${i}]`]))
}

const backUpMetadata = (): void => {
  const metadata = { dateStart, mimeType: 'audio/webm;codecs=opus', missionName: 'Dive', cockpitVersion: '1.0.0' }
  storages.temp.items.set(`${fileName}_meta`, new Blob([JSON.stringify(metadata)]))
}

test('rebuilds an interrupted recording from its chunks in numeric order, with its metadata', async () => {
  backUpChunks(12)
  backUpMetadata()

  expect(await recoverInterruptedAudioRecordings()).toBe(1)

  const audio = await storages.audio.items.get(fileName)?.text()
  expect(audio).toBe(Array.from({ length: 12 }, (_, i) => `[${i}]`).join(''))
  const metadata = JSON.parse((await storages.audio.items.get(fileName.replace('.webm', '.json'))?.text()) ?? '{}')
  expect(metadata).toMatchObject({ missionName: 'Dive', durationMs: 12000, mimeType: 'audio/webm;codecs=opus' })
  expect(new Date(metadata.dateFinish).getTime()).toBe(dateStart.getTime() + 12000)
  expect(storages.temp.items.size).toBe(0)
})

test('recovers the audio even when the metadata backup is missing', async () => {
  backUpChunks(2)

  expect(await recoverInterruptedAudioRecordings()).toBe(1)
  expect(await storages.audio.items.get(fileName)?.text()).toBe('[0][1]')
  expect(storages.audio.items.has(fileName.replace('.webm', '.json'))).toBe(false)
})

test('leaves an already saved recording untouched and only clears its backup', async () => {
  storages.audio.items.set(fileName, new Blob(['final']))
  storages.audio.items.set(fileName.replace('.webm', '.json'), new Blob(['{}']))
  backUpChunks(3)
  backUpMetadata()

  expect(await recoverInterruptedAudioRecordings()).toBe(0)
  expect(await storages.audio.items.get(fileName)?.text()).toBe('final')
  expect(storages.temp.items.size).toBe(0)
})

test('a concurrent call waits for the ongoing recovery instead of recovering twice', async () => {
  backUpChunks(1)

  expect(await Promise.all([recoverInterruptedAudioRecordings(), recoverInterruptedAudioRecordings()])).toEqual([1, 0])
})

test('rebuilds a recording whose final save stopped before its sidecar was written', async () => {
  storages.audio.items.set(fileName, new Blob(['[0]']))
  backUpChunks(3)
  backUpMetadata()

  expect(await recoverInterruptedAudioRecordings()).toBe(1)
  expect(await storages.audio.items.get(fileName)?.text()).toBe('[0][1][2]')
})

test('leaves alone the backup of a recording another context still holds the lock of', async () => {
  const held = [{ name: `cockpit-voice-recording-${fileName}`, mode: 'exclusive' }]
  Object.defineProperty(navigator, 'locks', {
    value: { query: async () => ({ held, pending: [] }) },
    configurable: true,
  })
  backUpChunks(2)
  backUpMetadata()

  expect(await recoverInterruptedAudioRecordings()).toBe(0)
  expect(storages.audio.items.size).toBe(0)
  expect(storages.temp.items.size).toBe(3)
})
