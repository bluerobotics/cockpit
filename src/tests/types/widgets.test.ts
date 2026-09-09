import { expect, test } from 'vitest'

import { type MiniWidgetContainer, type View, fillMissingBarContainers, selectViewsToShow } from '@/types/widgets'

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

const view = (name: string, visible = true): View => ({
  hash: name,
  name,
  visible,
  showBottomBarOnBoot: true,
  widgets: [],
  miniWidgetContainers: [],
})

test('all visible views stay mounted, with the current view last so it stacks on top', () => {
  const views = [view('video'), view('map'), view('hud')]

  expect(selectViewsToShow(views, 0, false).map((v) => v.name)).toEqual(['map', 'hud', 'video'])
})

test('hidden views are left out even when every view stays mounted', () => {
  const views = [view('video'), view('map', false), view('hud')]

  expect(selectViewsToShow(views, 2, false).map((v) => v.name)).toEqual(['video', 'hud'])
})

test('only the current view is mounted when hidden views are unloaded', () => {
  const views = [view('video'), view('map'), view('hud')]

  expect(selectViewsToShow(views, 1, true).map((v) => v.name)).toEqual(['map'])
})

test('a current view marked not visible is not mounted when hidden views are unloaded', () => {
  expect(selectViewsToShow([view('video', false), view('map')], 0, true)).toEqual([])
})

test('an out-of-range current index is clamped so a view still mounts', () => {
  const views = [view('video'), view('map')]

  expect(selectViewsToShow(views, 9, true).map((v) => v.name)).toEqual(['map'])
  expect(selectViewsToShow(views, 9, false).map((v) => v.name)).toEqual(['video', 'map'])
})
