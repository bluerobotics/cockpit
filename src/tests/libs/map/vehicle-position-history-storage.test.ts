import { expect, test, vi } from 'vitest'

// jsdom has no IndexedDB, so the store is replaced by an in-memory one that clones like IndexedDB does.
const data = new Map<string, unknown>()
vi.mock('@/libs/indexed-db-store', () => ({
  IndexedDbStore: class {
    getItem = async (key: string): Promise<unknown> => structuredClone(data.get(key) ?? null)
    setItem = async (key: string, value: unknown): Promise<void> => void data.set(key, structuredClone(value))
  },
}))

import { loadVehiclePositionHistory, saveVehiclePositionHistory } from '@/libs/map/vehicle-position-history-storage'

test('stores and restores the history, and reports when nothing usable was stored', async () => {
  expect(await loadVehiclePositionHistory()).toBeNull()

  const history = Array.from({ length: 5000 }, (_, i): [number, number] => [-27.5 + i * 1e-6, -48.5 - i * 1e-7])
  await saveVehiclePositionHistory(history)
  expect(await loadVehiclePositionHistory()).toEqual(history)

  await saveVehiclePositionHistory([])
  expect(await loadVehiclePositionHistory()).toEqual([])

  data.set('history', [[1, 2]])
  expect(await loadVehiclePositionHistory()).toBeNull()
})
