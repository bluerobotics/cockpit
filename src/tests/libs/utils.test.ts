import { expect, test } from 'vitest'

import { serializeForLogging } from '@/libs/utils'

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
