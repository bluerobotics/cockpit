import { afterEach, expect, test } from 'vitest'

import { isElectron, serializeForLogging, uniqueString } from '@/libs/utils'

test('serializeForLogging', () => {
  // The regression this guards: `JSON.stringify(new Error('boom'))` is `'{}'`, which is what the log used to keep.
  expect(serializeForLogging(new Error('boom'))).toContain('boom')
  expect(serializeForLogging(Object.assign(new Error('boom'), { stack: undefined }))).toBe('Error: boom')

  expect(serializeForLogging('plain message')).toBe('plain message')
  expect(serializeForLogging({ a: 1 })).toBe('{"a":1}')
  expect(serializeForLogging(42)).toBe('42')
  expect(serializeForLogging(null)).toBe('null')
  expect(serializeForLogging(undefined)).toBe('undefined')

  const circular: Record<string, unknown> = {}
  circular.self = circular
  expect(serializeForLogging(circular)).toBe('[object Object]')
  expect(serializeForLogging(Object.create(null))).toBe('{}')
})

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

test('uniqueString', () => {
  expect(uniqueString('Base Station', [], ' ')).toBe('Base Station')
  expect(uniqueString('Base Station', ['Base Station'], ' ')).toBe('Base Station 2')
  expect(uniqueString('Base Station', ['Base Station', 'Base Station 2'], ' ')).toBe('Base Station 3')

  // Gaps are not filled: the suffix walks up from 2 until it finds a free one.
  expect(uniqueString('gnss', ['gnss', 'gnss-3'], '-')).toBe('gnss-2')
  expect(uniqueString('gnss', ['gnss', 'gnss-2'], '-')).toBe('gnss-3')

  // A taken suffix without the bare base taken still yields the base.
  expect(uniqueString('gnss', ['gnss-2'], '-')).toBe('gnss')
})
