import { describe, expect, it } from 'vitest'

import { filterAndSortMissions, formatMissionMeta } from '@/libs/blueos-cloud/mission-list'
import type { BlueOsCloudMission } from '@/libs/blueos-cloud/types'

const mission = (overrides: Partial<BlueOsCloudMission>): BlueOsCloudMission => ({
  id: 'id',
  title: 'Untitled mission',
  description: '',
  start_time: null,
  end_time: null,
  created_by: null,
  start_latitude: null,
  start_longitude: null,
  ...overrides,
})

const reefSurvey = mission({
  id: 'reef',
  title: 'Reef survey',
  description: 'Testing Cockpit/Cloud integration',
  start_time: '2026-08-04T12:00:00Z',
  start_latitude: '19.641100',
  start_longitude: '-156.007600',
})

const hullInspection = mission({
  id: 'hull',
  title: 'Hull inspection',
  start_time: '2026-07-29T12:00:00Z',
})

const undated = mission({ id: 'undated', title: 'Auto upload check', start_time: 'not a date' })

describe('BlueOS Cloud mission list', () => {
  it('sorts by start time, treating missions without a usable one as the oldest', () => {
    const missions = [hullInspection, undated, reefSurvey]

    expect(filterAndSortMissions(missions, '', 'newest').map((m) => m.id)).toEqual(['reef', 'hull', 'undated'])
    expect(filterAndSortMissions(missions, '', 'oldest').map((m) => m.id)).toEqual(['undated', 'hull', 'reef'])
  })

  it('sorts by name', () => {
    expect(filterAndSortMissions([reefSurvey, hullInspection], '', 'name').map((m) => m.id)).toEqual(['hull', 'reef'])
  })

  it('matches the query against name, description and location', () => {
    const missions = [reefSurvey, hullInspection]

    expect(filterAndSortMissions(missions, 'reef', 'newest').map((m) => m.id)).toEqual(['reef'])
    expect(filterAndSortMissions(missions, 'integration', 'newest').map((m) => m.id)).toEqual(['reef'])
    expect(filterAndSortMissions(missions, '-156.00', 'newest').map((m) => m.id)).toEqual(['reef'])
    expect(filterAndSortMissions(missions, 'HULL', 'newest').map((m) => m.id)).toEqual(['hull'])
    expect(filterAndSortMissions(missions, 'reef hull', 'newest')).toEqual([])
  })

  it('matches the query against the start date as it is displayed', () => {
    const displayedDate = new Date(reefSurvey.start_time as string).toLocaleString()

    expect(filterAndSortMissions([reefSurvey, hullInspection], displayedDate, 'newest').map((m) => m.id)).toEqual([
      'reef',
    ])
  })

  it('keeps the whole list when the query is empty and never mutates the input', () => {
    const missions = [hullInspection, reefSurvey]

    expect(filterAndSortMissions(missions, '   ', 'newest')).toHaveLength(2)
    expect(missions.map((m) => m.id)).toEqual(['hull', 'reef'])
  })

  it('formats the metadata shown on a row, falling back when there is none', () => {
    expect(formatMissionMeta(reefSurvey)).toContain('19.6411, -156.0076')
    expect(formatMissionMeta(mission({}))).toBe('No metadata')
    expect(formatMissionMeta(mission({ start_latitude: 'unknown', start_longitude: '1.0' }))).toBe('No metadata')
  })
})
