import { expect, test, vi } from 'vitest'

import { findAxisRangeIssues, findOffDefaultAxisEndpoints } from '@/libs/joystick/default-mappings'

// The shipped profiles pull in the settings manager, which this pure check does not need.
vi.mock('@/assets/joystick-profiles', () => ({
  cockpitStandardToProtocols: [],
  defaultProtocolMappingVehicleCorrespondency: {},
}))

const stick = { min: -1000, max: 1000 }
const throttle = { min: 1000, max: 0 }

test('swapped endpoints and a narrower range are fine', () => {
  expect(findAxisRangeIssues({ min: 1000, max: -1000 }, stick)).toEqual([])
  expect(findAxisRangeIssues({ min: -500, max: 500 }, stick)).toEqual([])
})

test('any moved center is flagged', () => {
  expect(findAxisRangeIssues({ min: 900, max: 100 }, throttle)).toEqual([])
  expect(findAxisRangeIssues({ min: 1000, max: 10 }, throttle)).toEqual(['off-center'])
  expect(findAxisRangeIssues({ min: 0, max: 1000 }, throttle)).toEqual([])
})

test('reaching past the default limits is flagged', () => {
  expect(findAxisRangeIssues({ min: -1000, max: 1000 }, throttle)).toEqual(['off-center', 'beyond-limits'])
  expect(findAxisRangeIssues({ min: -1100, max: 1100 }, stick)).toEqual(['beyond-limits'])
})

test('only the endpoints that stray from the default are flagged', () => {
  expect(findOffDefaultAxisEndpoints({ min: 1000, max: 10 }, throttle)).toEqual(['max'])
  expect(findOffDefaultAxisEndpoints({ min: -1000, max: 1000 }, throttle)).toEqual(['min'])
  expect(findOffDefaultAxisEndpoints({ min: 0, max: 1000 }, throttle)).toEqual([])
  expect(findOffDefaultAxisEndpoints({ min: -1100, max: 1100 }, stick)).toEqual(['min', 'max'])
})
