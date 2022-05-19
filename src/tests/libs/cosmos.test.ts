import '@/libs/cosmos'

import { expect, test } from 'vitest'

test('Global functions', () => {
  expect(() => assert(true === false, 'What!')).toThrowError('What!')
  expect(() => assert(true === true, 'No!')).not.toThrowError('No!')
  expect(() => unused(true)).not.toThrowError()
})

test('Array', () => {
  const arrayTen = [...Array(10).keys()]
  expect([].first()).toBe(undefined)
  expect([1, 2].first()).toBe(1)
  expect([].isEmpty()).toBe(true)
  expect([].random()).toBe(undefined)
  expect([1, 2]).toContain([1, 2].random())
  expect([].sum()).toBe(0)
  expect(arrayTen.sum()).toBe(45)
})
