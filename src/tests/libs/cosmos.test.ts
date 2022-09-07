import '@/libs/cosmos'

import { expect, test } from 'vitest'

test('Array', () => {
  const arrayTen = [...Array(10).keys()]
  expect([].first()).toBe(undefined)
  expect([1, 2].first()).toBe(1)
  expect([].isEmpty()).toBe(true)
  expect([].random()).toBe(undefined)
  expect([1, 2]).toContain([1, 2].random())
  expect([].sum()).toBe(0)
  expect(arrayTen.sum()).toBe(45)
  expect([].last()).toBe(undefined)
  expect([1, 2].last()).toBe(2)
})
