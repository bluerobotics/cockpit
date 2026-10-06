import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  cleanupAutoRun,
  getAutoRunConfig,
  initializeActionAutoRun,
  removeAutoRunConfig,
  saveAutoRunConfig,
} from '@/libs/actions/auto-run'
import { executeActionCallback } from '@/libs/joystick/protocols/cockpit-actions'
import { settingsManager } from '@/libs/settings-management'

vi.mock('@/libs/settings-management', () => ({
  settingsManager: {
    getKeyValue: vi.fn(),
    setKeyValue: vi.fn(),
  },
}))

vi.mock('@/libs/joystick/protocols/cockpit-actions', () => ({
  executeActionCallback: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(settingsManager.getKeyValue).mockReturnValue(undefined)
  vi.mocked(settingsManager.setKeyValue).mockImplementation(async (_key, value): Promise<void> => {
    vi.mocked(settingsManager.getKeyValue).mockReturnValue(value)
  })
})

afterEach(() => {
  cleanupAutoRun()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('can save a trigger after removing its previous configuration', () => {
  saveAutoRunConfig('action', { type: 'once', delayMs: 1000 })
  removeAutoRunConfig('action')
  saveAutoRunConfig('action', { type: 'interval', delayMs: 2000 })

  expect(getAutoRunConfig('action')).toEqual({ type: 'interval', delayMs: 2000 })
  expect(settingsManager.setKeyValue).toHaveBeenLastCalledWith('cockpit-actions-auto-run-options', {
    action: { type: 'interval', delayMs: 2000 },
  })
  expect(executeActionCallback).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(2000)
  expect(executeActionCallback).toHaveBeenCalledTimes(2)
})

test('loads startup and interval triggers stored as JSON strings', () => {
  vi.mocked(settingsManager.getKeyValue).mockReturnValue(
    JSON.stringify({
      startup: { type: 'once', delayMs: 1000 },
      repeated: { type: 'interval', delayMs: 2000 },
    })
  )

  initializeActionAutoRun()
  vi.advanceTimersByTime(1000)
  expect(executeActionCallback).toHaveBeenCalledWith('startup')
  vi.advanceTimersByTime(1000)
  expect(executeActionCallback).toHaveBeenCalledWith('repeated')
  vi.advanceTimersByTime(2000)
  expect(executeActionCallback).toHaveBeenCalledTimes(3)
})

test('removing a trigger preserves other stored triggers as an object', () => {
  vi.mocked(settingsManager.getKeyValue).mockReturnValue(
    JSON.stringify({
      removed: { type: 'once', delayMs: 1000 },
      retained: { type: 'interval', delayMs: 2000 },
    })
  )

  removeAutoRunConfig('removed')

  expect(settingsManager.setKeyValue).toHaveBeenCalledWith('cockpit-actions-auto-run-options', {
    retained: { type: 'interval', delayMs: 2000 },
  })
})
