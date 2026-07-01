import type { Point2D } from '@/types/general'
import type { ScreenBounds } from '@/types/user-interface'

/**
 * Computes a screen-space axis-aligned bounding box from an array of 2D points.
 * @param {Point2D[]} pts Screen-space points.
 * @returns {ScreenBounds} The bounding box that tightly contains every point.
 */
export const screenBounds = (pts: Point2D[]): ScreenBounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Picks the best candidate top-left position for a floating action button by
 * maximising viewport visibility and minimising overlap with a polygon
 * bounding box, then clamps the result inside the viewport. Used by both the
 * survey polygon and the geofence polygon confirm buttons to keep their
 * floating anchors visible and away from the shape being drawn.
 * @param {Point2D[]} candidates Top-left positions to evaluate.
 * @param {number} elW Element width in pixels.
 * @param {number} elH Element height in pixels.
 * @param {ScreenBounds} polyBounds Polygon screen bounds.
 * @param {number} vpW Viewport width.
 * @param {number} vpH Viewport height.
 * @param {number} margin Minimum distance from viewport edge.
 * @returns {Point2D} Clamped top-left position for the floating element.
 */
export const pickBestPosition = (
  candidates: Point2D[],
  elW: number,
  elH: number,
  polyBounds: ScreenBounds,
  vpW: number,
  vpH: number,
  margin: number
): Point2D => {
  const area = elW * elH
  let best = candidates[0]
  let bestScore = -Infinity

  for (const c of candidates) {
    const l = c.x
    const r = c.x + elW
    const t = c.y
    const b = c.y + elH

    const visW = Math.max(0, Math.min(r, vpW - margin) - Math.max(l, margin))
    const visH = Math.max(0, Math.min(b, vpH - margin) - Math.max(t, margin))
    const visibility = (visW * visH) / area

    const oW = Math.max(0, Math.min(r, polyBounds.maxX) - Math.max(l, polyBounds.minX))
    const oH = Math.max(0, Math.min(b, polyBounds.maxY) - Math.max(t, polyBounds.minY))
    const overlapPenalty = (oW * oH) / area

    const score = visibility - overlapPenalty * 0.5
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  return {
    x: Math.max(margin, Math.min(best.x, vpW - elW - margin)),
    y: Math.max(margin, Math.min(best.y, vpH - elH - margin)),
  }
}
