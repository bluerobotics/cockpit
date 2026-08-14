import { expect, test, vi } from 'vitest'

import { setDataLakeVariableData } from '@/libs/actions/data-lake'
import type { Package } from '@/libs/connection/m2r/messages/mavlink2rest'
import { injectMavlinkPackageIntoDataLake } from '@/libs/vehicle/mavlink/data-lake-injection'

// The real data lake pulls in the settings manager, which needs a working localStorage the test environment
// does not provide, so the injected variables are read back from what the injection tried to write.
vi.mock('@/libs/actions/data-lake', () => ({
  createDataLakeVariable: vi.fn(),
  getDataLakeVariableInfo: vi.fn(),
  setDataLakeVariableData: vi.fn(),
}))

const variables = (): Map<string, string | number> =>
  new Map(vi.mocked(setDataLakeVariableData).mock.calls as [string, string | number][])

const mavlinkPackage = (systemId: number | undefined, message: Record<string, unknown>): Package =>
  ({ header: { system_id: systemId, component_id: 1, sequence: 0 }, message } as unknown as Package)

test('Variables are named after the system and component the package came from', () => {
  injectMavlinkPackageIntoDataLake(mavlinkPackage(3, { type: 'ATTITUDE', roll: 0.5 }))

  expect(variables().get('/mavlink/3/1/ATTITUDE/roll')).toBe(0.5)
  expect(variables().has('ATTITUDE/roll')).toBe(false)
})

test('Legacy unprefixed variables are created only for the system that asked for them', () => {
  injectMavlinkPackageIntoDataLake(mavlinkPackage(1, { type: 'VFR_HUD', alt: 10 }), 1)
  expect(variables().get('VFR_HUD/alt')).toBe(10)

  injectMavlinkPackageIntoDataLake(mavlinkPackage(2, { type: 'VFR_HUD', alt: 20 }), 1)
  expect(variables().get('VFR_HUD/alt')).toBe(10)
})

test('A package with no system id does not create legacy variables while they are disabled', () => {
  injectMavlinkPackageIntoDataLake(mavlinkPackage(undefined, { type: 'AHRS2', altitude: 5 }))

  expect(variables().has('AHRS2/altitude')).toBe(false)
})
