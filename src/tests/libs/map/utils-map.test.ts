import type * as L from 'leaflet'
import { expect, test, vi } from 'vitest'

import { applyFollowZoomMode, isFiniteLatLng, recenterMapOnFollowTarget, TargetFollower } from '@/libs/map/utils-map'
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

test('TargetFollower.enableAutoUpdate replaces an existing interval so disableAutoUpdate stops all of them', () => {
  vi.useFakeTimers()
  try {
    let centers = 0
    const follower = new TargetFollower(
      () => undefined,
      () => {
        centers += 1
      }
    )
    follower.setTrackableTarget('Vehicle', () => [-27.5, -48.4])
    follower.follow('Vehicle', false)
    follower.enableAutoUpdate()
    follower.enableAutoUpdate()
    follower.disableAutoUpdate()
    vi.advanceTimersByTime(2000)
    expect(centers).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

test('isFiniteLatLng requires both components', () => {
  expect(isFiniteLatLng([-27.5, -48.4])).toBe(true)
  expect(isFiniteLatLng([-27.5, undefined as unknown as number])).toBe(false)
  expect(isFiniteLatLng(undefined)).toBe(false)
})

test('recenterMapOnFollowTarget does not re-apply a zoom the map already has', () => {
  const calls: string[] = []
  const map = {
    getZoom: () => 12,
    setView: () => calls.push('setView'),
    setZoom: () => calls.push('setZoom'),
  }
  recenterMapOnFollowTarget(map as unknown as L.Map, 12, [-27.5, -48.4])
  expect(calls).toEqual([])
  recenterMapOnFollowTarget(map as unknown as L.Map, 13, undefined)
  expect(calls).toEqual(['setZoom'])
})
