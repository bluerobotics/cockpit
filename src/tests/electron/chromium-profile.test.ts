import { expect, test } from 'vitest'

import { isolatedUserDataPath, shouldIsolateChromiumProfile } from '@/electron/chromium-profile'

test('isolates a Chrome 150 profile when this binary is Chrome 122', () => {
  expect(shouldIsolateChromiumProfile('150.0.7871.224', '122.0.6261.156', false)).toBe(true)
  expect(isolatedUserDataPath('/tmp/Cockpit', '122.0.6261.156')).toBe('/tmp/Cockpit-chrome122')
})

test('leaves a same-or-older Chrome profile on the default path', () => {
  expect(shouldIsolateChromiumProfile('122.0.6261.156', '122.0.6261.156', false)).toBe(false)
  expect(shouldIsolateChromiumProfile('122.0.6261.156', '122.0.6261.156', true)).toBe(false)
  expect(shouldIsolateChromiumProfile(undefined, '122.0.6261.156', false)).toBe(false)
})

test('isolates a Chrome 124+ layout when Last Version is missing', () => {
  expect(shouldIsolateChromiumProfile(undefined, '122.0.6261.156', true)).toBe(true)
  expect(shouldIsolateChromiumProfile(undefined, '150.0.7871.224', true)).toBe(false)
})
