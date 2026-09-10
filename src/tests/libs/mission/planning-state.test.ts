import { expect, test } from 'vitest'

import { hasLivePlanningMission } from '@/libs/mission/planning-state'
import type { Survey, Waypoint } from '@/types/mission'

test('hasLivePlanningMission', () => {
  expect(hasLivePlanningMission([], [])).toBe(false)
  expect(hasLivePlanningMission([{ id: 'wp' } as Waypoint], [])).toBe(true)
  expect(hasLivePlanningMission([], [{ id: 'survey' } as Survey])).toBe(true)
})
