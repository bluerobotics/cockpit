import { type MockInstance, afterEach, beforeEach, expect, test, vi } from 'vitest'

import { SettingsManager } from '@/libs/settings-management'
import {
  localSharedSettingsBackupKey,
  LocalSyncedSettings,
  localSyncedSettingsKey,
  SettingsPackage,
} from '@/types/settings-management'

vi.mock('@/libs/blueos', () => ({
  getKeyDataFromCockpitVehicleStorage: vi.fn(),
  setKeyDataOnCockpitVehicleStorage: vi.fn(),
}))

let manager: SettingsManager

beforeEach(async () => {
  vi.useFakeTimers()
  localStorage.clear()
  manager = new SettingsManager()
  await manager.setKeyValue('cockpit-scale', { zoom: 1 }, 1)
  await manager.setKeyValue('cockpit-unchanged', false, 1)
  vi.advanceTimersByTime(100)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  localStorage.clear()
})

test('notifies changed setting keys once after an external storage update', () => {
  const changed = vi.fn()
  const unchanged = vi.fn()
  manager.registerListener('cockpit-scale', changed)
  manager.registerListener('cockpit-unchanged', unchanged)
  const settings: LocalSyncedSettings = JSON.parse(localStorage.getItem(localSyncedSettingsKey)!)
  const newSetting = { epochLastChangedLocally: 2, value: { zoom: 2 } }
  settings[manager.currentUsername][manager.currentVehicleId]['cockpit-scale'] = newSetting
  localStorage.setItem(localSyncedSettingsKey, JSON.stringify(settings))

  manager.handleStorageChanging()

  expect(changed).toHaveBeenCalledWith(newSetting)
  expect(unchanged).not.toHaveBeenCalled()
  manager.handleStorageChanging()
  expect(changed).toHaveBeenCalledTimes(1)
})

test('notifies only changed settings on the first external update after loading stored settings', () => {
  manager = new SettingsManager()
  const changed = vi.fn()
  const unchanged = vi.fn()
  manager.registerListener('cockpit-scale', changed)
  manager.registerListener('cockpit-unchanged', unchanged)
  const settings: LocalSyncedSettings = JSON.parse(localStorage.getItem(localSyncedSettingsKey)!)
  const newSetting = { epochLastChangedLocally: 2, value: { zoom: 2 } }
  settings[manager.currentUsername][manager.currentVehicleId]['cockpit-scale'] = newSetting
  localStorage.setItem(localSyncedSettingsKey, JSON.stringify(settings))

  manager.handleStorageChanging()

  expect(changed).toHaveBeenCalledWith(newSetting)
  expect(changed).toHaveBeenCalledTimes(1)
  expect(unchanged).not.toHaveBeenCalled()
})

test('ignores unrelated storage events immediately after loading stored settings', () => {
  manager = new SettingsManager()
  const unchanged = vi.fn()
  manager.registerListener('cockpit-scale', unchanged)
  localStorage.setItem('unrelated-key', 'changed')

  manager.handleStorageChanging()

  expect(unchanged).not.toHaveBeenCalled()
})

test('ignores external changes belonging to another user or vehicle', () => {
  const changed = vi.fn()
  manager.registerListener('cockpit-scale', changed)
  const settings: LocalSyncedSettings = JSON.parse(localStorage.getItem(localSyncedSettingsKey)!)
  const newSetting = { epochLastChangedLocally: 2, value: { zoom: 2 } }
  settings['other-user'] = { [manager.currentVehicleId]: { 'cockpit-scale': newSetting } }
  settings[manager.currentUsername]['other-vehicle'] = { 'cockpit-scale': newSetting }
  localStorage.setItem(localSyncedSettingsKey, JSON.stringify(settings))

  manager.handleStorageChanging()

  expect(changed).not.toHaveBeenCalled()
})

test('notifies listeners when another tab clears a setting with null', () => {
  const changed = vi.fn()
  manager.registerListener('cockpit-scale', changed)
  const settings: LocalSyncedSettings = JSON.parse(localStorage.getItem(localSyncedSettingsKey)!)
  const newSetting = { epochLastChangedLocally: 2, value: null }
  settings[manager.currentUsername][manager.currentVehicleId]['cockpit-scale'] = newSetting
  localStorage.setItem(localSyncedSettingsKey, JSON.stringify(settings))

  manager.handleStorageChanging()

  expect(changed).toHaveBeenCalledWith(newSetting)
})

test('reads back a write still waiting on the debounce', async () => {
  await manager.setKeyValue('cockpit-scale', { zoom: 3 })

  expect(manager.getKeyValue('cockpit-scale')).toEqual({ zoom: 3 })
  vi.advanceTimersByTime(100)
  expect(manager.getKeyValue('cockpit-scale')).toEqual({ zoom: 3 })
})

const overlaysKey = 'cockpit-map-overlays-v1'

const seedVehiclePackages = (packages: Record<string, SettingsPackage>): void => {
  const settings: LocalSyncedSettings = JSON.parse(localStorage.getItem(localSyncedSettingsKey)!)
  Object.entries(packages).forEach(([vehicleId, settingsPackage]) => {
    settings[manager.currentUsername][vehicleId] = {
      ...settings[manager.currentUsername][vehicleId],
      ...settingsPackage,
    }
  })
  localStorage.setItem(localSyncedSettingsKey, JSON.stringify(settings))
}

const storedValue = (vehicleId: string, key: string): unknown => {
  const settings: LocalSyncedSettings = JSON.parse(localStorage.getItem(localSyncedSettingsKey)!)
  return settings[manager.currentUsername][vehicleId][key]?.value
}

test('spreads a shared setting written on one vehicle to the other vehicles of the user', async () => {
  seedVehiclePackages({ boat: {} })
  manager = new SettingsManager()

  await manager.setKeyValue(overlaysKey, [{ id: 'survey' }])
  vi.advanceTimersByTime(100)

  expect(storedValue('boat', overlaysKey)).toEqual([{ id: 'survey' }])
  expect(storedValue('boat', 'cockpit-scale')).toBeUndefined()
})

test('keeps the newest copy of a shared setting that is not combined', () => {
  const unitsKey = 'cockpit-display-unit-preferences-v2'
  seedVehiclePackages({
    [manager.currentVehicleId]: { [unitsKey]: { epochLastChangedLocally: 5, value: { distance: 'meters' } } },
    boat: { [unitsKey]: { epochLastChangedLocally: 7, value: { depth: 'feet' } } },
  })

  manager = new SettingsManager()

  expect(storedValue(manager.currentVehicleId, unitsKey)).toEqual({ depth: 'feet' })
})

const failBackupWrites = (): MockInstance => {
  const setItem = Storage.prototype.setItem
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === localSharedSettingsBackupKey) throw new DOMException('Storage is full', 'QuotaExceededError')
    setItem.call(this, key, value)
  })
}

test('keeps settings per vehicle for the session when the backup cannot be stored', async () => {
  localStorage.removeItem(localSharedSettingsBackupKey)
  seedVehiclePackages({ boat: { [overlaysKey]: { epochLastChangedLocally: 7, value: [{ id: 'b' }] } } })
  const spy = failBackupWrites()

  manager = new SettingsManager()
  await manager.setKeyValue(overlaysKey, [{ id: 'a' }])
  vi.advanceTimersByTime(100)
  spy.mockRestore()

  expect(storedValue(manager.currentVehicleId, overlaysKey)).toEqual([{ id: 'a' }])
  expect(storedValue('boat', overlaysKey)).toEqual([{ id: 'b' }])
})
