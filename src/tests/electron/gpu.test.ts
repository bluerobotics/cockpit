import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyChromiumSwitches, markStartupAsHealthy } from '@/electron/services/gpu'

const appliedSwitches: string[] = []
const storeData = new Map<string, unknown>()

vi.mock('electron', () => ({
  app: {
    commandLine: {
      appendSwitch: (name: string, value?: string) => {
        appliedSwitches.push(value === undefined ? name : `${name}=${value}`)
      },
    },
  },
  ipcMain: { handle: vi.fn() },
}))

vi.mock('@/electron/services/config-store', () => ({
  default: {
    get: (key: string) => storeData.get(key),
    set: (key: string, value: unknown) => storeData.set(key, value),
  },
}))

describe('Chromium switches boot failsafe', () => {
  beforeEach(() => {
    appliedSwitches.length = 0
    storeData.clear()
  })

  it('Applies the saved switches and leaves the launch unconfirmed', () => {
    storeData.set('chromiumSwitches', ['disable-gpu', 'use-angle=gl'])

    applyChromiumSwitches()

    expect(appliedSwitches).toEqual(['disable-gpu', 'use-angle=gl'])
    expect(storeData.get('chromiumSwitchesBootPending')).toBe(true)
  })

  it('Confirms the launch once a window has loaded', () => {
    storeData.set('chromiumSwitches', ['disable-gpu'])

    applyChromiumSwitches()
    markStartupAsHealthy()

    expect(storeData.get('chromiumSwitchesBootPending')).toBe(false)
  })

  it('Disables the switches when the previous launch was never confirmed', () => {
    storeData.set('chromiumSwitches', ['disable-gpu'])
    applyChromiumSwitches()
    appliedSwitches.length = 0

    applyChromiumSwitches()

    expect(appliedSwitches).toEqual([])
    expect(storeData.get('chromiumSwitches')).toEqual([])
    expect(storeData.get('chromiumSwitchesDisabled')).toEqual(['disable-gpu'])
  })

  it('Keeps starting clean on the launches that follow a failed one', () => {
    storeData.set('chromiumSwitches', ['disable-gpu'])
    applyChromiumSwitches()
    applyChromiumSwitches()
    appliedSwitches.length = 0

    applyChromiumSwitches()

    expect(appliedSwitches).toEqual([])
    expect(storeData.get('chromiumSwitchesBootPending')).toBe(false)
    expect(storeData.get('chromiumSwitchesDisabled')).toEqual(['disable-gpu'])
  })

  it('Does not guard a launch that has no saved switches', () => {
    applyChromiumSwitches()

    expect(appliedSwitches).toEqual([])
    expect(storeData.get('chromiumSwitchesBootPending')).toBeUndefined()
  })
})
