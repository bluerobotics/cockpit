import { expect, test } from 'vitest'

import {
  boundsOf,
  fromMercator,
  frustumWidthForZoom,
  mapLayerSlots,
  slotHeight,
  toMercator,
  zoomForFrustumWidth,
} from '@/libs/map/cesium-map'

test('zoom keeps its tile-scale meaning: a 1000px canvas spans 4777m at zoom 15, and the conversion round-trips', () => {
  expect(frustumWidthForZoom(15, 1000)).toBeCloseTo(4777.314, 2)
  expect(zoomForFrustumWidth(frustumWidthForZoom(17.4, 830), 830)).toBeCloseTo(17.4, 9)
  // One level up halves the ground a canvas spans.
  expect(frustumWidthForZoom(16, 1000) * 2).toBeCloseTo(frustumWidthForZoom(15, 1000), 6)
})

test('Web Mercator projection round-trips a coordinate', () => {
  const projected = toMercator([-27.5935, -48.5585])
  const [lat, lng] = fromMercator(projected.x, projected.y)
  expect(lat).toBeCloseTo(-27.5935, 9)
  expect(lng).toBeCloseTo(-48.5585, 9)
})

test('boundsOf covers every coordinate as south-west / north-east', () => {
  expect(
    boundsOf([
      [-27.5, -48.4],
      [-27.6, -48.3],
      [-27.4, -48.5],
    ])
  ).toEqual([
    [-27.6, -48.5],
    [-27.4, -48.3],
  ])
})

test('slots are drawn at heights that keep their stacking order', () => {
  const heights = mapLayerSlots.map(slotHeight)
  expect([...heights].sort((a, b) => a - b)).toEqual(heights)
  expect(new Set(heights).size).toBe(heights.length)
})
