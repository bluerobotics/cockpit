/**
 * Alignment of a widget against the other widgets of its view, on one axis at a time. Everything here works on the
 * normalized (0-1) lines that a widget's edges and center project onto an axis, so the same code serves both the
 * horizontal and the vertical axis.
 */

import { snapToInterval } from '@/libs/utils'

/** A widget's extent on one axis. */
export type AxisSpan = {
  /**
   * Normalized coordinate of the leading edge
   */
  start: number
  /**
   * Normalized extent along the axis
   */
  length: number
}

/** Distance, in screen pixels, under which a widget line glues to the alignment line it is approaching. */
export const alignmentSnapTolerancePixels = 8

// Wide enough to survive the rounding of adding a snap delta, narrow enough that only a real alignment matches.
const alignmentEpsilon = 1e-6

/**
 * The lines a widget projects on one axis: its two edges and its center.
 * @param {AxisSpan} span - Extent of the widget on the axis
 * @returns {number[]} The leading edge, the center and the trailing edge
 */
export const widgetAlignmentLines = (span: AxisSpan): number[] => [
  span.start,
  span.start + span.length / 2,
  span.start + span.length,
]

/**
 * How far the given lines have to move so the closest of them lands on an alignment line.
 * @param {number[]} lines - Lines the gesture is moving
 * @param {number[]} alignmentLines - Lines the widget can be aligned to
 * @param {number} tolerance - Largest distance that still snaps
 * @returns {number | undefined} The offset to apply, or undefined when nothing is close enough
 */
export const alignmentSnapDelta = (
  lines: number[],
  alignmentLines: number[],
  tolerance: number
): number | undefined => {
  let closestDelta: number | undefined = undefined
  let closestDistance = Infinity

  for (const line of lines) {
    for (const alignmentLine of alignmentLines) {
      const distance = Math.abs(alignmentLine - line)
      if (distance > tolerance || distance >= closestDistance) continue
      closestDelta = alignmentLine - line
      closestDistance = distance
    }
  }

  return closestDelta
}

/** Which edge of the span a resize gesture is dragging on this axis. */
export type MovedEdge = 'start' | 'end' | 'none'

/**
 * Where a resized edge lands: on a nearby alignment line when there is one, on the grid otherwise.
 * @param {number} edge - Coordinate the edge arrived at
 * @param {number[]} alignmentLines - Lines the widget can be aligned to
 * @param {number} tolerance - Largest distance that still snaps
 * @param {number | undefined} gridInterval - Grid to fall back to, or undefined when snapping to it is off
 * @returns {number} The coordinate to place the edge at
 */
const placeResizedEdge = (
  edge: number,
  alignmentLines: number[],
  tolerance: number,
  gridInterval: number | undefined
): number => {
  const delta = alignmentSnapDelta([edge], alignmentLines, tolerance)
  if (delta !== undefined) return edge + delta
  return gridInterval === undefined ? edge : snapToInterval(edge, gridInterval)
}

/**
 * Places the single edge a resize is dragging, leaving the opposite one exactly where it is. Alignment wins over the
 * grid, since rounding afterwards would pull the edge off the line it just glued to.
 * @param {AxisSpan} span - Extent the resize arrived at on this axis
 * @param {MovedEdge} movedEdge - Edge the gesture is dragging, as the caller's handle tells it
 * @param {number[]} alignmentLines - Lines the widget can be aligned to
 * @param {number} tolerance - Largest distance that still snaps
 * @param {number | undefined} gridInterval - Grid to fall back to, or undefined when snapping to it is off
 * @returns {AxisSpan} The extent with the dragged edge placed, or the given one when no edge moved on this axis
 */
export const alignResizedSpan = (
  span: AxisSpan,
  movedEdge: MovedEdge,
  alignmentLines: number[],
  tolerance: number,
  gridInterval: number | undefined
): AxisSpan => {
  if (movedEdge === 'start') {
    const start = placeResizedEdge(span.start, alignmentLines, tolerance, gridInterval)
    return { start: start, length: span.length + (span.start - start) }
  }

  if (movedEdge === 'end') {
    const end = placeResizedEdge(span.start + span.length, alignmentLines, tolerance, gridInterval)
    return { start: span.start, length: end - span.start }
  }

  return span
}

/**
 * The alignment lines the widget currently sits on, which are the ones worth drawing as guides.
 * @param {number[]} lines - Lines of the widget in its current geometry
 * @param {number[]} alignmentLines - Lines the widget can be aligned to
 * @returns {number[]} The matched alignment lines, without repetitions
 */
export const matchedAlignmentLines = (lines: number[], alignmentLines: number[]): number[] => {
  const matched = alignmentLines.filter((alignmentLine) =>
    lines.some((line) => Math.abs(line - alignmentLine) < alignmentEpsilon)
  )
  return [...new Set(matched)]
}
