import type { Point2D } from '@/types/general'
import type { ScreenBounds } from '@/types/user-interface'

/**
 * Screen-space extents of a floating panel, measured outward from the anchor point its CSS
 * `left`/`top` is applied to. Panels built out of absolutely-positioned children (rather than one
 * sized box) have no measurable width, so the caller declares it here.
 */
export type ScreenPanelFootprint = {
  /**
   * Pixels between the anchor point and the panel's left edge.
   */
  anchorLeftPx: number
  /**
   * Pixels between the anchor point and the panel's right edge.
   */
  anchorRightPx: number
  /**
   * Pixels between the anchor point and the panel's top edge.
   */
  anchorTopPx: number
  /**
   * Pixels between the anchor point and the panel's bottom edge.
   */
  anchorBottomPx: number
  /**
   * Gap kept between the panel and the target bounds.
   */
  gapPx: number
  /**
   * Minimum distance kept from the viewport edges.
   */
  marginPx: number
}

/**
 * Computes a screen-space axis-aligned bounding box from an array of 2D points.
 * @param {Point2D[]} pts - Screen-space points.
 * @returns {ScreenBounds} The bounding box.
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
 * Picks the best candidate position by maximising viewport visibility and minimising
 * overlap with a polygon bounding box, then clamps the result inside the viewport.
 * @param {Point2D[]} candidates - Top-left positions to evaluate.
 * @param {number} elW - Element width in pixels.
 * @param {number} elH - Element height in pixels.
 * @param {ScreenBounds} polyBounds - Polygon screen bounds.
 * @param {number} vpW - Viewport width.
 * @param {number} vpH - Viewport height.
 * @param {number} margin - Minimum distance from viewport edge.
 * @returns {Point2D} Clamped top-left position.
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

/**
 * Places a floating panel beside a target's screen bounds, trying right, left, below and above in
 * that order and clamping the winner into the viewport.
 * @param {ScreenBounds} target - Screen bounds the panel should sit next to.
 * @param {ScreenPanelFootprint} footprint - Extents of the panel around its anchor point.
 * @param {number} viewportWidth - Width of the container the panel is clamped into.
 * @param {number} viewportHeight - Height of the container the panel is clamped into.
 * @param {number} rightCandidateExtraGapPx - Additional gap applied only to the right-hand candidate.
 * @returns {Point2D} Top-left position for the panel, before its own anchor offsets are added.
 */
export const positionPanelNearBounds = (
  target: ScreenBounds,
  footprint: ScreenPanelFootprint,
  viewportWidth: number,
  viewportHeight: number,
  rightCandidateExtraGapPx = 0
): Point2D => {
  const visualW = footprint.anchorLeftPx + footprint.anchorRightPx
  const visualH = footprint.anchorTopPx + footprint.anchorBottomPx

  const cx = (target.minX + target.maxX) / 2
  const cy = (target.minY + target.maxY) / 2

  return pickBestPosition(
    [
      { x: target.maxX + footprint.gapPx + rightCandidateExtraGapPx, y: cy - visualH / 2 },
      { x: target.minX - footprint.gapPx - visualW, y: cy - visualH / 2 },
      { x: cx - visualW / 2, y: target.maxY + footprint.gapPx },
      { x: cx - visualW / 2, y: target.minY - footprint.gapPx - visualH },
    ],
    visualW,
    visualH,
    target,
    viewportWidth,
    viewportHeight,
    footprint.marginPx
  )
}
