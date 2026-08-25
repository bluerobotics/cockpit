import { expect, test } from 'vitest'

import { counterDeltaToMbps } from '@/libs/blueos'

const megabitsToBytes = (megabits: number): number => (megabits * 1024 * 1024) / 8

test('reads the real rate of a counter that only refreshes every few seconds', () => {
  // Ten seconds of a 12 Mbps link whose counter last refreshed at second 9, so the newest reading is stale.
  expect(counterDeltaToMbps(megabitsToBytes(12 * 9), 10000)).toBeCloseTo(10.8)

  // The same link measured between two consecutive polls: one pair falls inside a refresh period and reads
  // no traffic at all, the next catches the refresh and reads three seconds worth of it as one second.
  expect(counterDeltaToMbps(0, 1000)).toBe(0)
  expect(counterDeltaToMbps(megabitsToBytes(12 * 3), 1000)).toBe(0)
})

test('reports no traffic for a counter reset by a vehicle reboot, and for an empty span', () => {
  expect(counterDeltaToMbps(-megabitsToBytes(500), 10000)).toBe(0)
  expect(counterDeltaToMbps(megabitsToBytes(50), 0)).toBe(0)
})
