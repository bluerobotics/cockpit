import { expect, test } from 'vitest'

import { closestPointOnSegment } from '@/libs/map/survey-polygon-edges'

test('closestPointOnSegment projects onto the segment and stops at its ends', () => {
  const start = { x: 0, y: 0 }
  const end = { x: 10, y: 0 }
  expect(closestPointOnSegment({ x: 4, y: 5 }, start, end)).toEqual({ x: 4, y: 0 })
  expect(closestPointOnSegment({ x: -3, y: 2 }, start, end)).toEqual(start)
  expect(closestPointOnSegment({ x: 14, y: -2 }, start, end)).toEqual(end)
  expect(closestPointOnSegment({ x: 4, y: 5 }, start, start)).toEqual(start)
})
