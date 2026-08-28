import { describe, expect, test } from 'vitest'

import {
  buildRadialFadeMask,
  clampPointToCircle,
  isInsideCircle,
  rotatePointAroundCenter,
} from '@/libs/map/minimap-geometry'

describe('isInsideCircle', () => {
  const center = { x: 100, y: 100 }

  test('point at the center is inside', () => {
    expect(isInsideCircle(center, center, 50)).toBe(true)
  })

  test('point on the boundary is inside', () => {
    expect(isInsideCircle(center, { x: 150, y: 100 }, 50)).toBe(true)
  })

  test('point outside the radius is not inside', () => {
    expect(isInsideCircle(center, { x: 151, y: 100 }, 50)).toBe(false)
  })
})

describe('clampPointToCircle', () => {
  const center = { x: 100, y: 100 }

  test('projects a target to the right onto the boundary', () => {
    const result = clampPointToCircle(center, { x: 400, y: 100 }, 50)
    expect(result.x).toBeCloseTo(150)
    expect(result.y).toBeCloseTo(100)
    expect(result.angleDeg).toBeCloseTo(0)
  })

  test('projects a target below onto the boundary (positive angle points down)', () => {
    const result = clampPointToCircle(center, { x: 100, y: 400 }, 50)
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(150)
    expect(result.angleDeg).toBeCloseTo(90)
  })

  test('keeps the target direction regardless of distance', () => {
    const near = clampPointToCircle(center, { x: 110, y: 110 }, 50)
    const far = clampPointToCircle(center, { x: 300, y: 300 }, 50)
    expect(near.angleDeg).toBeCloseTo(far.angleDeg)
    expect(near.angleDeg).toBeCloseTo(45)
    expect(Math.hypot(near.x - center.x, near.y - center.y)).toBeCloseTo(50)
  })

  test('falls back to the right of the circle when target is the center', () => {
    const result = clampPointToCircle(center, center, 50)
    expect(result).toEqual({ x: 150, y: 100, angleDeg: 0 })
  })
})

describe('rotatePointAroundCenter', () => {
  const center = { x: 100, y: 100 }

  test('a zero angle leaves the point untouched', () => {
    expect(rotatePointAroundCenter(center, { x: 150, y: 100 }, 0)).toEqual({ x: 150, y: 100 })
  })

  test('a positive angle turns clockwise, matching CSS rotate() on screen axes', () => {
    const result = rotatePointAroundCenter(center, { x: 150, y: 100 }, 90)
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(150)
  })

  // The minimap rotates the container by the negated heading, so a target lying along the vehicle's
  // direction of travel has to come out at the top of the widget.
  test('the heading-up bearing puts a target ahead of the vehicle above the center', () => {
    const dueEastOfCenter = { x: 150, y: 100 }
    const result = rotatePointAroundCenter(center, dueEastOfCenter, -90)
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(50)
  })

  test('rotation keeps the distance from the center', () => {
    const result = rotatePointAroundCenter(center, { x: 130, y: 140 }, 37)
    expect(Math.hypot(result.x - center.x, result.y - center.y)).toBeCloseTo(50)
  })
})

describe('buildRadialFadeMask', () => {
  test('a zero fade keeps the circle solid to its edge', () => {
    expect(buildRadialFadeMask(0)).toContain('#000 100%')
  })

  test('a fade moves the solid stop inward', () => {
    expect(buildRadialFadeMask(0.25)).toContain('#000 75%')
  })

  test('clamps out-of-range fades', () => {
    expect(buildRadialFadeMask(-1)).toContain('#000 100%')
    expect(buildRadialFadeMask(5)).toContain('#000 5%')
  })
})
