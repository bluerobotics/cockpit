import { expect, test } from 'vitest'

import { dashMask } from '@/libs/map/cesium-vectors'

test('dashMask marches the dashes forward while keeping the pattern', () => {
  expect(dashMask([8, 8])).toEqual({ dashLength: 16, dashPattern: 0b1111111100000000 })
  // A quarter period forward, the line starts in the gap that used to precede the first dash.
  expect(dashMask([8, 8], 4).dashPattern).toBe(0b0000111111110000)
  expect(dashMask([8, 8], 12).dashPattern).toBe(0b1111000000001111)
  expect(dashMask([8, 8], 16).dashPattern).toBe(dashMask([8, 8]).dashPattern)
})
