import { expect, test, vi } from 'vitest'

vi.mock('@/libs/settings-management', () => {
  const settingsManager = {
    stored: undefined as string[] | undefined,
    listeners: {} as Record<string, () => void>,
    getKeyValue: (): string[] | undefined => settingsManager.stored,
    setKeyValue: (_key: string, value: string[]): void => {
      settingsManager.stored = value
    },
    registerListener: (key: string, callback: () => void): string => {
      settingsManager.listeners[key] = callback
      return key
    },
  }
  return { settingsManager }
})

import {
  addRecordedVariableIdsChangedHandler,
  dataLakeLogger,
  recordedDataLakeVariablesKey,
} from '@/libs/data-lake-logging'
import { settingsManager } from '@/libs/settings-management'

const settings = settingsManager as unknown as {
  /**
   * The recorded selection as the mocked settings hold it
   */
  stored: string[] | undefined
  /**
   * Listener registered per settings key
   */
  listeners: Record<string, () => void>
}

test('a settings sync that replaces the selection is reported like an edit made here', () => {
  const changes = vi.fn()
  addRecordedVariableIdsChangedHandler(changes)

  settings.stored = ['synced']
  settings.listeners[recordedDataLakeVariablesKey]()

  expect(changes).toHaveBeenCalledTimes(1)
  expect(dataLakeLogger.recordedVariableIds).toEqual(['synced'])
})

test('a write after a vehicle switch builds on the new vehicle selection, even with no sync notice', () => {
  settings.stored = ['previous-vehicle', 'stream-front-bytesReceived']
  expect(dataLakeLogger.recordedVariableIds).toEqual(['previous-vehicle', 'stream-front-bytesReceived'])

  // A vehicle whose settings lack the key never notifies its listeners
  settings.stored = undefined
  expect(dataLakeLogger.recordedVariableIds).toEqual([])

  settings.stored = ['new-vehicle', 'stream-front-bytesReceived']
  dataLakeLogger.replaceRecordedVariableIds({ 'stream-front-bytesReceived': 'stream-rear-bytesReceived' })
  expect(settings.stored).toEqual(['new-vehicle', 'stream-rear-bytesReceived'])
})
