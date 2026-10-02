import type { Map as MapLibreMap } from 'maplibre-gl'
import { expect, test } from 'vitest'

import {
  beforeIdForSlot,
  fromLngLat,
  fromMapLibreZoom,
  overlayBoundsToImageCoordinates,
  polygonFeature,
  slottedLayerId,
  toLngLat,
  toLngLatBounds,
  toMapLibreZoom,
} from '@/libs/map/maplibre'

test('zoom conversion keeps the tile scale one level above MapLibre and round-trips', () => {
  expect(toMapLibreZoom(19)).toBe(18)
  expect(fromMapLibreZoom(18)).toBe(19)
  expect(fromMapLibreZoom(toMapLibreZoom(7))).toBe(7)
})

test('coordinate conversion swaps to and from longitude-first order', () => {
  expect(toLngLat([-27.5, -48.4])).toEqual([-48.4, -27.5])
  expect(fromLngLat({ lng: -48.4, lat: -27.5 })).toEqual([-27.5, -48.4])
})

test('toLngLatBounds covers every coordinate as west-south / east-north', () => {
  expect(
    toLngLatBounds([
      [-27.5, -48.4],
      [-27.6, -48.3],
      [-27.4, -48.5],
    ])
  ).toEqual([
    [-48.5, -27.6],
    [-48.3, -27.4],
  ])
})

test('overlay bounds become image corners clockwise from the top-left', () => {
  expect(
    overlayBoundsToImageCoordinates([
      [-28, -49],
      [-27, -48],
    ])
  ).toEqual([
    [-49, -27],
    [-48, -27],
    [-48, -28],
    [-49, -28],
  ])
})

test('polygonFeature closes an open ring', () => {
  const ring = polygonFeature([
    [0, 0],
    [0, 1],
    [1, 1],
  ]).geometry.coordinates[0]
  expect(ring).toHaveLength(4)
  expect(ring[3]).toEqual(ring[0])
})

test('beforeIdForSlot inserts below the first layer of a higher slot', () => {
  const order = [slottedLayerId('base', 'osm'), slottedLayerId('mission', 'path'), slottedLayerId('grid', 'lines')]
  const map = { getLayersOrder: () => order } as unknown as MapLibreMap

  expect(beforeIdForSlot(map, 'raster-overlay')).toBe(slottedLayerId('mission', 'path'))
  expect(beforeIdForSlot(map, 'mission')).toBe(slottedLayerId('grid', 'lines'))
  expect(beforeIdForSlot(map, 'measure')).toBeUndefined()
})
