/**
 * Resizing a widget with a two-finger pinch. The widget scales by how far the fingers spread apart from where they
 * landed, and travels with the point between them, so it stays under the fingers the way a photo does. Fingers landing
 * side by side resize only its width, one above the other only its height, and diagonally both.
 */

import { constrain } from '@/libs/utils'
import type { Point2D, SizeRect2D } from '@/types/general'

/** Two fingers on the screen, in pixels. */
export type FingerPair = [Point2D, Point2D]

const spread = ([a, b]: FingerPair): number => Math.hypot(b.x - a.x, b.y - a.y)
const midpoint = ([a, b]: FingerPair): Point2D => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

// Fingers within this many degrees of an axis resize along that axis alone. Taken once, from where they landed, so the
// pinch does not flip between axes as the fingers turn.
const axisLockDegrees = 30

const pinchedSides = ([a, b]: FingerPair): Record<keyof SizeRect2D, boolean> => {
  const angle = (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI
  return { width: angle < 90 - axisLockDegrees, height: angle > axisLockDegrees }
}

/**
 * Where a pinch takes a widget. The sides it resizes scale alike and stop together when either reaches a limit, so a
 * diagonal pinch keeps the widget's proportions.
 * @param {Point2D} startCenter - The widget's center when the pinch began, normalized to the view
 * @param {SizeRect2D} startSize - The widget's size when the pinch began, normalized to the view
 * @param {FingerPair} startFingers - The fingers when the pinch began
 * @param {FingerPair} fingers - The fingers now
 * @param {SizeRect2D} viewSize - The view, in pixels
 * @param {number} minSide - Smallest either side may get, normalized to the view
 * @param {SizeRect2D} maxSize - Largest the widget may get, normalized to the view
 * @returns {{ center: Point2D, size: SizeRect2D }} The widget's new center and size, normalized to the view
 */
export const pinchedWidget = (
  startCenter: Point2D,
  startSize: SizeRect2D,
  startFingers: FingerPair,
  fingers: FingerPair,
  viewSize: SizeRect2D,
  minSide: number,
  maxSize: SizeRect2D
): {
  /**
   * New center, normalized to the view
   */
  center: Point2D
  /**
   * New size, normalized to the view
   */
  size: SizeRect2D
} => {
  // Fingers that land on the same spot would divide by zero; a pixel apart is as close as two can be.
  const pinchScale = spread(fingers) / Math.max(spread(startFingers), 1)
  const sides = pinchedSides(startFingers)
  const scaledSides = (['width', 'height'] as const).filter((side) => sides[side])
  const minScale = minSide / Math.min(...scaledSides.map((side) => startSize[side]))
  const maxScale = Math.min(...scaledSides.map((side) => maxSize[side] / startSize[side]))
  // A widget already past the limit (a maximized one) can still shrink, just not grow.
  const scale = constrain(pinchScale, minScale, Math.max(maxScale, 1))
  const startMidpoint = midpoint(startFingers)
  const currentMidpoint = midpoint(fingers)
  return {
    center: {
      x: startCenter.x + (currentMidpoint.x - startMidpoint.x) / viewSize.width,
      y: startCenter.y + (currentMidpoint.y - startMidpoint.y) / viewSize.height,
    },
    size: {
      width: sides.width ? startSize.width * scale : startSize.width,
      height: sides.height ? startSize.height * scale : startSize.height,
    },
  }
}
