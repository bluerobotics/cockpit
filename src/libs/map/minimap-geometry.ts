/**
 * A point in the map container's pixel space (origin at the top-left corner).
 */
export interface ContainerPoint {
  /** Horizontal pixel offset from the container's left edge. */
  x: number
  /** Vertical pixel offset from the container's top edge. */
  y: number
}

/**
 * A point clamped onto a circular boundary, plus the direction from the circle center to it.
 */
export interface CircleBoundaryPoint extends ContainerPoint {
  /** Direction from the circle center to the point, in degrees (0 = right, 90 = down). */
  angleDeg: number
}

/**
 * Whether a container point falls within a circle of the given radius.
 * @param {ContainerPoint} center - Circle center in container pixels.
 * @param {ContainerPoint} point - Point to test in container pixels.
 * @param {number} radius - Circle radius in pixels.
 * @returns {boolean} True when the point is inside (or on) the circle.
 */
export const isInsideCircle = (center: ContainerPoint, point: ContainerPoint, radius: number): boolean =>
  Math.hypot(point.x - center.x, point.y - center.y) <= radius

/**
 * Projects an off-screen target onto a circular boundary, giving the border point where an edge
 * indicator should sit and the direction to it. The direction is preserved even when the target
 * lies inside the circle, so callers can decide separately whether to show the indicator.
 * @param {ContainerPoint} center - Circle center in container pixels.
 * @param {ContainerPoint} target - Target position in container pixels.
 * @param {number} radius - Circle radius in pixels.
 * @returns {CircleBoundaryPoint} The point on the circle toward the target and its angle in degrees.
 */
export const clampPointToCircle = (
  center: ContainerPoint,
  target: ContainerPoint,
  radius: number
): CircleBoundaryPoint => {
  const dx = target.x - center.x
  const dy = target.y - center.y
  const distance = Math.hypot(dx, dy)

  // A target exactly on the center has no direction; default to the right of the circle.
  if (distance === 0) {
    return { x: center.x + radius, y: center.y, angleDeg: 0 }
  }

  const unitX = dx / distance
  const unitY = dy / distance
  return {
    x: center.x + unitX * radius,
    y: center.y + unitY * radius,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

/**
 * Builds the `mask-image` CSS value that turns a rectangular map into a circle inscribed in its
 * shortest side, with a soft radial fade toward the edge. A fade of 0 yields a hard-edged circle.
 * @param {number} fadeAmount - Fraction of the radius that fades out, clamped to [0, 0.95].
 * @returns {string} A `radial-gradient(...)` string for `mask-image` / `-webkit-mask-image`.
 */
export const buildRadialFadeMask = (fadeAmount: number): string => {
  const clampedFade = Math.min(Math.max(fadeAmount, 0), 0.95)
  const solidStop = Math.round((1 - clampedFade) * 100)
  return `radial-gradient(circle closest-side at 50% 50%, #000 0%, #000 ${solidStop}%, transparent 100%)`
}
