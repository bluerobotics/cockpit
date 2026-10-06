import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { SettingsManager } from '@/libs/settings-management'
import { LocalSyncedSettings, localSyncedSettingsKey } from '@/types/settings-management'

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
