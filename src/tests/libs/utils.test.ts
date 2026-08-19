import { expect, test } from 'vitest'

import { serializeForLogging, uniqueString } from '@/libs/utils'

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
