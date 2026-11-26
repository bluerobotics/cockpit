import { type MockInstance, afterEach, beforeEach, expect, test, vi } from 'vitest'

import { type VehicleAdapter, SettingsManager } from '@/libs/settings-management'
import {
  localSharedSettingsBackupKey,
  LocalSyncedSettings,
  localSyncedSettingsKey,
  SettingsPackage,
} from '@/types/settings-management'

vi.mock('@/libs/blueos', () => ({
  getKeyDataFromCockpitVehicleStorage: vi.fn(),
  setKeyDataOnCockpitVehicleStorage: vi.fn(),
  getStatus: vi.fn(async () => true),
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

test('combines diverged shared lists by id on load, keeping the newest version of each entry', () => {
  seedVehiclePackages({
    [manager.currentVehicleId]: {
      [overlaysKey]: { epochLastChangedLocally: 5, value: [{ id: 'a', name: 'old' }, { id: 'b' }] },
    },
    boat: { [overlaysKey]: { epochLastChangedLocally: 7, value: [{ id: 'a', name: 'new' }, { id: 'c' }] } },
  })

  manager = new SettingsManager()

  const combined = [{ id: 'a', name: 'new' }, { id: 'c' }, { id: 'b' }]
  expect(storedValue(manager.currentVehicleId, overlaysKey)).toEqual(combined)
  expect(storedValue('boat', overlaysKey)).toEqual(combined)
})

test('propagates a deletion of a shared entry instead of bringing it back on the next load', async () => {
  seedVehiclePackages({
    [manager.currentVehicleId]: { [overlaysKey]: { epochLastChangedLocally: 5, value: [{ id: 'a' }] } },
    boat: { [overlaysKey]: { epochLastChangedLocally: 7, value: [{ id: 'b' }] } },
  })
  manager = new SettingsManager()

  await manager.setKeyValue(overlaysKey, [{ id: 'b' }])
  vi.advanceTimersByTime(100)
  manager = new SettingsManager()

  expect(storedValue(manager.currentVehicleId, overlaysKey)).toEqual([{ id: 'b' }])
  expect(storedValue('boat', overlaysKey)).toEqual([{ id: 'b' }])
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

const backedUpValue = (vehicleId: string, key: string): unknown => {
  const backup: LocalSyncedSettings = JSON.parse(localStorage.getItem(localSharedSettingsBackupKey)!)
  return backup[manager.currentUsername][vehicleId][key]?.value
}

const failBackupWrites = (): MockInstance => {
  const setItem = Storage.prototype.setItem
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === localSharedSettingsBackupKey) throw new DOMException('Storage is full', 'QuotaExceededError')
    setItem.call(this, key, value)
  })
}

test('backs up every copy of the shared settings before combining them on the first load', () => {
  localStorage.removeItem(localSharedSettingsBackupKey)
  seedVehiclePackages({
    [manager.currentVehicleId]: { [overlaysKey]: { epochLastChangedLocally: 5, value: [{ id: 'a' }] } },
    boat: { [overlaysKey]: { epochLastChangedLocally: 7, value: [{ id: 'b' }] } },
  })

  manager = new SettingsManager()

  expect(storedValue('boat', overlaysKey)).toEqual([{ id: 'b' }, { id: 'a' }])
  expect(backedUpValue(manager.currentVehicleId, overlaysKey)).toEqual([{ id: 'a' }])
  expect(backedUpValue('boat', overlaysKey)).toEqual([{ id: 'b' }])
})

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

const missionsKey = 'cockpit-mission-library'

const fakeVehicle = (
  vehicleId: string,
  settings: SettingsPackage
): [VehicleAdapter, Record<string, SettingsPackage>] => {
  const settingsByUser: Record<string, SettingsPackage> = { [manager.currentUsername]: settings }
  const storage: Record<string, unknown> = {
    'cockpit-vehicle-id': vehicleId,
    'settings-v1-backup': {},
    'settings-v2': settingsByUser,
  }
  const adapter: VehicleAdapter = {
    getKeyData: async (_address: string, key: string) => structuredClone(storage[key]),
    setKeyData: async (_address: string, key: string, data: unknown) => {
      const [, userId, settingKey] = key.split('/')
      settingsByUser[userId] = { ...settingsByUser[userId], [settingKey]: data as SettingsPackage[string] }
    },
  }
  return [adapter, settingsByUser]
}

const editOffline = async (key: string, value: SettingsPackage[string]['value']): Promise<void> => {
  manager = new SettingsManager()
  await manager.setKeyValue(key, value)
  await new Promise((resolve) => setTimeout(resolve, 150))
}

const connect = async (vehicle: VehicleAdapter): Promise<SettingsManager> => {
  const dispatch = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true)
  const connected = new SettingsManager(undefined, vehicle)
  await connected.handleVehicleGettingOnline('192.168.2.2')
  dispatch.mockRestore()
  return connected
}

test('keeps the shared entries of a vehicle this computer never synced with when connecting to it', async () => {
  vi.useRealTimers()
  seedVehiclePackages({
    [manager.currentVehicleId]: { [missionsKey]: { epochLastChangedLocally: 100, value: [{ id: 'local' }] } },
  })
  const [vehicle, onVehicle] = fakeVehicle('towfish', {
    [missionsKey]: { epochLastChangedLocally: 50, value: [{ id: 'on-vehicle' }] },
  })

  manager = await connect(vehicle)

  const both = [{ id: 'local' }, { id: 'on-vehicle' }]
  expect(storedValue('towfish', missionsKey)).toEqual(both)
  expect(onVehicle[manager.currentUsername][missionsKey].value).toEqual(both)
})

test('drops on the vehicle a shared entry deleted here after both agreed on it', async () => {
  vi.useRealTimers()
  const [vehicle, onVehicle] = fakeVehicle('towfish', {
    [missionsKey]: { epochLastChangedLocally: 50, value: [{ id: 'kept' }, { id: 'deleted' }] },
  })
  manager = await connect(vehicle)
  await editOffline(missionsKey, [{ id: 'kept' }])

  manager = await connect(vehicle)

  expect(storedValue('towfish', missionsKey)).toEqual([{ id: 'kept' }])
  expect(onVehicle[manager.currentUsername][missionsKey].value).toEqual([{ id: 'kept' }])
})

test('keeps a shared entry another computer added on the vehicle after the last agreement', async () => {
  vi.useRealTimers()
  const [vehicle, onVehicle] = fakeVehicle('towfish', {
    [missionsKey]: { epochLastChangedLocally: 50, value: [{ id: 'agreed' }] },
  })
  manager = await connect(vehicle)
  await editOffline(missionsKey, [{ id: 'agreed' }, { id: 'added-here' }])
  onVehicle[manager.currentUsername][missionsKey] = {
    epochLastChangedLocally: 60,
    value: [{ id: 'agreed' }, { id: 'added-elsewhere' }],
  }

  manager = await connect(vehicle)

  const all = [{ id: 'agreed' }, { id: 'added-here' }, { id: 'added-elsewhere' }]
  expect(storedValue('towfish', missionsKey)).toEqual(all)
  expect(onVehicle[manager.currentUsername][missionsKey].value).toEqual(all)
})
