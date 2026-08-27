import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StorageAdapter, VehicleAdapter } from '@/libs/settings-management'
import {
  type PendingSettingWrites,
  fallbackUsername,
  fallbackVehicleId,
  localPendingSettingWritesKey,
} from '@/types/settings-management'

// Node's own `localStorage` global shadows jsdom's here and is inert without `--localstorage-file`, so a
// stand-in has to be in place before the settings manager is loaded, as it builds its singleton against it
// on load.
const globalStoredItems = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => globalStoredItems.get(key) ?? null,
    setItem: (key: string, value: string) => globalStoredItems.set(key, value),
    removeItem: (key: string) => globalStoredItems.delete(key),
    clear: () => globalStoredItems.clear(),
  },
})

const { SettingsManager } = await import('@/libs/settings-management')

const testKey = 'cockpit-test-setting'
const otherTestKey = 'cockpit-other-test-setting'

/**
 * A storage adapter for a settings manager under test, alongside what it wrote.
 */
interface TestStorage {
  /**
   * The backing record, exposed so a test can read what the adapter was given
   */
  items: Record<string, string>
  /**
   * How many times the journal of pending writes was stored, so a test can tell coalesced writes apart
   */
  journalWrites: number
  /**
   * The adapter to hand to the settings manager
   */
  adapter: StorageAdapter
}

const buildStorage = (): TestStorage => {
  const items: Record<string, string> = {}
  const storage: TestStorage = {
    items,
    journalWrites: 0,
    adapter: {
      getItem: (key) => items[key] ?? null,
      setItem: (key, value) => {
        if (key === localPendingSettingWritesKey) {
          storage.journalWrites += 1
        }
        items[key] = value
      },
      removeItem: (key) => {
        delete items[key]
      },
      getAllKeys: () => Object.keys(items),
    },
  }
  return storage
}

// Every test runs with no vehicle connected, so reaching for the vehicle at all is a failure in itself.
const unreachableVehicle: VehicleAdapter = {
  getKeyData: () => Promise.reject(new Error('The vehicle should not be contacted while it is offline.')),
  setKeyData: () => Promise.reject(new Error('The vehicle should not be contacted while it is offline.')),
}

const readJournal = (items: Record<string, string>): PendingSettingWrites => {
  return items[localPendingSettingWritesKey] === undefined ? {} : JSON.parse(items[localPendingSettingWritesKey])
}

describe('Journal of pending setting writes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('records a change before the debounced write reaches the local settings', () => {
    const storage = buildStorage()
    const manager = new SettingsManager(storage.adapter, unreachableVehicle)

    manager.setKeyValue(testKey, 'changed')

    expect(readJournal(storage.items)[testKey].value).toBe('changed')
    expect(manager.getKeyValue(testKey)).toBeUndefined()
  })

  it('drops the record once the change reaches the local settings', () => {
    const storage = buildStorage()
    const manager = new SettingsManager(storage.adapter, unreachableVehicle)

    manager.setKeyValue(testKey, 'changed')
    vi.advanceTimersByTime(1000)

    expect(manager.getKeyValue(testKey)).toBe('changed')
    expect(readJournal(storage.items)).toEqual({})
  })

  it('applies a change the previous session recorded but never wrote', () => {
    const storage = buildStorage()
    const closedSession = new SettingsManager(storage.adapter, unreachableVehicle)
    closedSession.setKeyValue(testKey, 'changed')

    // No timers are advanced, standing in for Cockpit being closed inside the debounce window.
    const newSession = new SettingsManager(storage.adapter, unreachableVehicle)

    expect(newSession.getKeyValue(testKey)).toBe('changed')
    expect(readJournal(storage.items)).toEqual({})
  })

  it('discards a recorded change that the stored settings already moved past', () => {
    const storage = buildStorage()
    const closedSession = new SettingsManager(storage.adapter, unreachableVehicle)
    closedSession.setKeyValue(testKey, 'stale', 1000)
    vi.advanceTimersByTime(1000)

    // Stands in for another tab, or a restored backup, writing something newer than the record below.
    closedSession.setKeyValue(testKey, 'newest', 3000)
    vi.advanceTimersByTime(1000)
    closedSession.savePendingKeyValue(testKey, 'stale', 1000, fallbackUsername, fallbackVehicleId)
    vi.advanceTimersByTime(1000)

    const newSession = new SettingsManager(storage.adapter, unreachableVehicle)

    expect(newSession.getKeyValue(testKey)).toBe('newest')
    expect(readJournal(storage.items)).toEqual({})
  })

  it('keeps a change recorded while an older one was still waiting out its debounce', () => {
    const storage = buildStorage()
    const manager = new SettingsManager(storage.adapter, unreachableVehicle)

    manager.setKeyValue(testKey, 'older', 1000)
    manager.savePendingKeyValue(testKey, 'newer', 2000, fallbackUsername, fallbackVehicleId)
    vi.advanceTimersByTime(1000)

    expect(manager.getKeyValue(testKey)).toBe('older')
    expect(readJournal(storage.items)[testKey].value).toBe('newer')
  })

  it('collapses a burst of changes into a single journal write', () => {
    const storage = buildStorage()
    const manager = new SettingsManager(storage.adapter, unreachableVehicle)

    manager.savePendingKeyValue(testKey, 'leading', 1000, fallbackUsername, fallbackVehicleId)
    const writesAfterLeadingChange = storage.journalWrites

    for (let burstIndex = 0; burstIndex < 50; burstIndex++) {
      manager.savePendingKeyValue(
        testKey,
        `burst-${burstIndex}`,
        2000 + burstIndex,
        fallbackUsername,
        fallbackVehicleId
      )
    }
    expect(storage.journalWrites).toBe(writesAfterLeadingChange)

    vi.advanceTimersByTime(1000)

    expect(storage.journalWrites).toBe(writesAfterLeadingChange + 1)
    expect(readJournal(storage.items)[testKey].value).toBe('burst-49')
  })

  it('stores a change to a quiet key without waiting out the window another key opened', () => {
    const storage = buildStorage()
    const manager = new SettingsManager(storage.adapter, unreachableVehicle)

    manager.savePendingKeyValue(testKey, 'burst-start', 1000, fallbackUsername, fallbackVehicleId)
    manager.savePendingKeyValue(testKey, 'burst-next', 2000, fallbackUsername, fallbackVehicleId)
    manager.savePendingKeyValue(otherTestKey, 'deliberate', 3000, fallbackUsername, fallbackVehicleId)

    expect(readJournal(storage.items)[otherTestKey].value).toBe('deliberate')
  })

  it('leaves a key seeded from a default out of the journal', () => {
    const storage = buildStorage()
    const manager = new SettingsManager(storage.adapter, unreachableVehicle)

    manager.setKeyValue(testKey, 'seeded', 0)

    expect(readJournal(storage.items)).toEqual({})
  })

  it('discards a malformed record instead of failing to start', () => {
    const storage = buildStorage()
    storage.items[localPendingSettingWritesKey] = JSON.stringify({
      [testKey]: null,
      [otherTestKey]: { value: 'kept', epochChange: 1000, userId: fallbackUsername, vehicleId: fallbackVehicleId },
    })

    const manager = new SettingsManager(storage.adapter, unreachableVehicle)

    expect(manager.getKeyValue(testKey)).toBeUndefined()
    expect(manager.getKeyValue(otherTestKey)).toBe('kept')
  })
})
