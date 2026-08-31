import { expect, test } from 'vitest'

import { type MiniWidgetContainer, fillMissingBarContainers } from '@/types/widgets'

const container = (name: string): MiniWidgetContainer => ({ name, widgets: [] })

test('a bar with fewer containers than slots gets the missing ones, keeping the stored ones', () => {
  const stored = [container('Bottom-left container')]

  const filled = fillMissingBarContainers(stored, 'Bottom')

  expect(filled).toHaveLength(3)
  expect(filled[0]).toBe(stored[0])
  expect(filled.map((c) => c.name)).toEqual([
    'Bottom-left container',
    'Bottom-center container',
    'Bottom-right container',
  ])
})

test('a hole in a value applied by the vehicle sync is filled, and containers past the slots are kept', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stored = [container('Top-left container'), null as any, container('Top-right container'), container('Extra')]

  const filled = fillMissingBarContainers(stored, 'Top')

  expect(filled.map((c) => c.name)).toEqual([
    'Top-left container',
    'Top-center container',
    'Top-right container',
    'Extra',
  ])
})

test('a complete bar is returned untouched, so nothing is written back to the settings', () => {
  const stored = [container('Top-left container'), container('Top-center container'), container('Top-right container')]

  expect(fillMissingBarContainers(stored, 'Top')).toBe(stored)
  expect(fillMissingBarContainers(fillMissingBarContainers([], 'Bottom'), 'Bottom')).toHaveLength(3)
})
