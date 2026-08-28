import { afterEach, expect, test } from 'vitest'

import { isElectron } from '@/libs/utils'

const electronUserAgent = 'Mozilla/5.0 Chrome/122.0.6261.156 Electron/29.4.6 Safari/537.36'
const chromeUserAgent = 'Mozilla/5.0 Chrome/122.0.6261.156 Safari/537.36'
const originalUserAgent = navigator.userAgent

const setUserAgent = (userAgent: string): void => {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
}

afterEach(() => {
  setUserAgent(originalUserAgent)
  delete window.electronAPI
})

test('isElectron', () => {
  // The regression this guards: an Electron-based embedded browser matches the user agent but has no
  // preload bridge, and taking the Electron path there throws while the app is still booting.
  setUserAgent(electronUserAgent)
  expect(isElectron()).toBe(false)

  window.electronAPI = {} as NonNullable<typeof window.electronAPI>
  expect(isElectron()).toBe(true)

  setUserAgent(chromeUserAgent)
  expect(isElectron()).toBe(false)
})
