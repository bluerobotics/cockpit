import { expect, test } from 'vitest'

import {
  alignmentSnapDelta,
  alignResizedSpan,
  matchedAlignmentLines,
  widgetAlignmentLines,
} from '@/libs/widget-alignment'

test('widgetAlignmentLines', () => {
  const [start, center, end] = widgetAlignmentLines({ start: 0.2, length: 0.4 })
  expect(start).toBeCloseTo(0.2, 10)
  expect(center).toBeCloseTo(0.4, 10)
  expect(end).toBeCloseTo(0.6, 10)
})

test('alignmentSnapDelta', () => {
  const lines = [0.2, 0.3, 0.4]

  // The closest pair wins, whichever of the moving lines it belongs to.
  expect(alignmentSnapDelta([0.19, 0.39], lines, 0.02)).toBeCloseTo(0.01, 10)
  expect(alignmentSnapDelta([0.18, 0.395], lines, 0.02)).toBeCloseTo(0.005, 10)

  expect(alignmentSnapDelta([0.25], lines, 0.02)).toBe(undefined)
  expect(alignmentSnapDelta([0.19], [], 0.02)).toBe(undefined)
})

test('alignResizedSpan glues only the edge being dragged', () => {
  const initial = { start: 0.2, length: 0.4 }
  const lines = [0.1, 0.65]

  // Leading edge dragged to 0.105: it glues to 0.1 and the trailing edge stays at 0.6.
  const leading = alignResizedSpan({ start: 0.105, length: 0.495 }, 'start', lines, 0.02, undefined)
  expect(leading.start).toBeCloseTo(0.1, 10)
  expect(leading.start + leading.length).toBeCloseTo(0.6, 10)

  // Trailing edge dragged to 0.645: it glues to 0.65 and the leading edge stays at 0.2.
  const trailing = alignResizedSpan({ start: 0.2, length: 0.445 }, 'end', lines, 0.02, undefined)
  expect(trailing.start).toBe(0.2)
  expect(trailing.start + trailing.length).toBeCloseTo(0.65, 10)

  // An axis the gesture does not touch is left alone, even sitting next to a line.
  expect(alignResizedSpan(initial, 'none', [0.205], 0.02, undefined)).toEqual(initial)

  // Nothing within tolerance means nothing moves.
  expect(alignResizedSpan({ start: 0.3, length: 0.3 }, 'start', lines, 0.02, undefined)).toEqual({
    start: 0.3,
    length: 0.3,
  })
})

test('alignResizedSpan falls back to the grid, and only for the edge being dragged', () => {
  // Nothing to align to, so the dragged edge rounds to the grid and the opposite one does not move.
  const leading = alignResizedSpan({ start: 0.213, length: 0.387 }, 'start', [], 0.02, 0.05)
  expect(leading.start).toBeCloseTo(0.2, 10)
  expect(leading.start + leading.length).toBeCloseTo(0.6, 10)

  const trailing = alignResizedSpan({ start: 0.2, length: 0.412 }, 'end', [], 0.02, 0.05)
  expect(trailing.start).toBe(0.2)
  expect(trailing.start + trailing.length).toBeCloseTo(0.6, 10)

  // Alignment wins over the grid, otherwise the rounding would pull the edge off the line it just glued to.
  const aligned = alignResizedSpan({ start: 0.213, length: 0.387 }, 'start', [0.21], 0.02, 0.05)
  expect(aligned.start).toBeCloseTo(0.21, 10)
})

test('matchedAlignmentLines', () => {
  const lines = [0.1, 0.5, 0.5, 0.9]

  expect(matchedAlignmentLines([0.1, 0.3, 0.5], lines)).toEqual([0.1, 0.5])
  expect(matchedAlignmentLines([0.3], lines)).toEqual([])

  // A snapped edge is reported despite the rounding of having been moved there.
  const snapped = 0.37 + (alignmentSnapDelta([0.37], [0.9], 0.6) ?? 0)
  expect(matchedAlignmentLines([snapped], [0.9])).toEqual([0.9])
})
