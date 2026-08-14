import { expect, test } from 'vitest'

import { isReceivingData, isValidMavlinkId } from '@/libs/vehicle/mavlink/secondary-connections'

const timeoutMs = 4000
const now = 1_700_000_000_000

test('isReceivingData', () => {
  expect(isReceivingData(now, now, timeoutMs)).toBe(true)
  expect(isReceivingData(now - timeoutMs + 1, now, timeoutMs)).toBe(true)
  expect(isReceivingData(now - timeoutMs, now, timeoutMs)).toBe(false)
  expect(isReceivingData(now - 10 * timeoutMs, now, timeoutMs)).toBe(false)
  expect(isReceivingData(undefined, now, timeoutMs)).toBe(false)
})

test('isValidMavlinkId', () => {
  expect(isValidMavlinkId(1)).toBe(true)
  expect(isValidMavlinkId(255)).toBe(true)
  expect(isValidMavlinkId(0)).toBe(false)
  expect(isValidMavlinkId(256)).toBe(false)
  expect(isValidMavlinkId(1.5)).toBe(false)
  expect(isValidMavlinkId(NaN)).toBe(false)
  expect(isValidMavlinkId(undefined)).toBe(false)

  // A string that stringifies to a valid ID is what an announced ID has to be rejected as: it would name the
  // piloted vehicle's variables while never matching the numeric guard that drops that ID.
  expect(isValidMavlinkId('1')).toBe(false)

  // The shape that would otherwise be spliced into a generated coordinate expression and evaluated.
  expect(isValidMavlinkId('42/1/GLOBAL_POSITION_INT/lat}}+(globalThis.pwned=true)+{{/mavlink/42')).toBe(false)
})
