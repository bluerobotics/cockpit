import { afterEach, expect, test, vi } from 'vitest'

import { MAVLinkVehicle } from '@/libs/vehicle/mavlink/vehicle'

import { drain } from '../mission-helpers'

vi.mock('@/libs/communication/mavlink', () => ({ sendMavlinkMessage: vi.fn() }))
vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: vi.fn(), setKeyValue: vi.fn() },
}))

afterEach(() => {
  vi.useRealTimers()
})

test('a vehicle that never arms is not told to start the mission', async () => {
  vi.useFakeTimers()
  const vehicle = {
    resetMode: vi.fn().mockResolvedValue(undefined),
    arm: vi.fn().mockResolvedValue(undefined),
    isArmed: () => false,
    sendCommandLong: vi.fn().mockResolvedValue(undefined),
  }

  const starting = MAVLinkVehicle.prototype.startMission.call(vehicle) as Promise<void>
  const outcome = expect(starting).rejects.toThrow('Could not arm the vehicle')
  // The arming loop retries every 100 ms for 5 s, on fake timers so the test does not wait for it.
  for (let elapsed = 0; elapsed <= 5100; elapsed += 100) {
    vi.advanceTimersByTime(100)
    await drain()
  }

  await outcome
  expect(vehicle.sendCommandLong).not.toHaveBeenCalled()
})
