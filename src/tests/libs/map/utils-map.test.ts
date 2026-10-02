import type * as L from 'leaflet'
import { expect, test, vi } from 'vitest'

import {
  applyFollowZoomMode,
  distanceInMeters,
  isFiniteLatLng,
  orderedSurveyPath,
  surveyEndpointEdgeBearing,
  TargetFollower,
} from '@/libs/map/utils-map'
import type { WaypointCoordinates } from '@/types/mission'

import surveyFixture from './fixtures/survey-paths.json'

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

// Expected values were produced by the Leaflet-based implementation, so the survey math cannot drift when the map
// library changes underneath it.
const surveyPolygon: WaypointCoordinates[] = [
  [-27.5, -48.5],
  [-27.5, -48.497],
  [-27.503, -48.496],
  [-27.5032, -48.5005],
]

const surveyCases = [
  { params: { distanceBetweenLines: 50, linesAngle: 30 }, entryCorner: 0 },
  { params: { distanceBetweenLines: 60, linesAngle: 75, turnaroundDistance: 20 }, entryCorner: 1 },
  { params: { distanceBetweenLines: 40, linesAngle: 10, turnaroundDistance: -10 }, entryCorner: 2 },
  {
    params: { distanceBetweenLines: 70, linesAngle: 45, crosshatch: true, crosshatchDistanceBetweenLines: 90 },
    entryCorner: 5,
  },
]

/** The reference fields only some surveys carry. */
type ReferenceSurvey = {
  /** First index of the crosshatch pass, when the survey has one. */
  crosshatchStartIndex?: number
}

const expectCoordinatesClose = (actual: WaypointCoordinates[], expected: number[][]): void => {
  expect(actual).toHaveLength(expected.length)
  actual.forEach(([lat, lng], i) => {
    expect(lat).toBeCloseTo(expected[i][0], 9)
    expect(lng).toBeCloseTo(expected[i][1], 9)
  })
}

test.each(surveyCases.map((surveyCase, index) => ({ ...surveyCase, index })))(
  'orderedSurveyPath matches the reference survey $index',
  ({ params, entryCorner, index }) => {
    const expected = surveyFixture.surveys[index]
    const result = orderedSurveyPath({ polygonPoints: surveyPolygon, ...params }, entryCorner)

    expectCoordinatesClose(result.path, expected.path)
    expect(result.turnaroundSegments).toHaveLength(expected.turnarounds.length)
    result.turnaroundSegments.forEach((segment, i) => expectCoordinatesClose(segment, expected.turnarounds[i]))
    expect(result.crosshatchStartIndex).toBe((expected as ReferenceSurvey).crosshatchStartIndex)
  }
)

test('surveyEndpointEdgeBearing matches the reference bearing', () => {
  expect(surveyEndpointEdgeBearing(surveyPolygon, [-27.5, -48.4985])).toBeCloseTo(surveyFixture.endpointBearing, 9)
})

test('distanceInMeters matches the distance Leaflet reported', () => {
  expect(distanceInMeters([-27.5, -48.5], [-27.6, -48.3])).toBeCloseTo(surveyFixture.distance, 6)
})
