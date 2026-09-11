import type * as L from 'leaflet'
import { expect, test } from 'vitest'

import { applyFollowZoomMode, isFiniteLatLng, TargetFollower } from '@/libs/map/utils-map'
import type { WaypointCoordinates } from '@/types/mission'

test('TargetFollower.currentCoordinates returns the followed trackable', () => {
  const home: WaypointCoordinates = [-27.5, -48.4]
  const follower = new TargetFollower(
    () => undefined,
    () => undefined
  )
  follower.setTrackableTarget('Home', () => home)
  expect(follower.currentCoordinates()).toBeUndefined()
  follower.follow('Home', false)
  expect(follower.currentCoordinates()).toEqual(home)
  follower.unFollow()
  expect(follower.currentCoordinates()).toBeUndefined()
})

test('applyFollowZoomMode pins Leaflet zoom on the view center only while following', () => {
  const map = { options: { scrollWheelZoom: true, doubleClickZoom: true, touchZoom: true } }
  applyFollowZoomMode(map as unknown as L.Map, true)
  expect(map.options.scrollWheelZoom).toBe('center')
  expect(map.options.doubleClickZoom).toBe('center')
  expect(map.options.touchZoom).toBe('center')
  applyFollowZoomMode(map as unknown as L.Map, false)
  expect(map.options.scrollWheelZoom).toBe(true)
  expect(map.options.doubleClickZoom).toBe(true)
  expect(map.options.touchZoom).toBe(true)
})

test('isFiniteLatLng requires both components', () => {
  expect(isFiniteLatLng([-27.5, -48.4])).toBe(true)
  expect(isFiniteLatLng([-27.5, undefined as unknown as number])).toBe(false)
  expect(isFiniteLatLng(undefined)).toBe(false)
})
