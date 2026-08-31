import { expect, test, vi } from 'vitest'

import { createDataLakeVariable } from '@/libs/actions/data-lake'
import {
  canUserChangeDataLakeVariable,
  canUserDeleteDataLakeVariable,
  isSystemOwnedDataLakeVariable,
} from '@/libs/utils-data-lake'
import { type DataLakeVariable } from '@/types/data-lake'

vi.mock('@/libs/settings-management', () => ({
  settingsManager: { getKeyValue: vi.fn(), setKeyValue: vi.fn() },
}))

const variable = (id: string, config: Partial<DataLakeVariable>): DataLakeVariable => ({
  id,
  name: id,
  type: 'number',
  ...config,
})

test("a variable that does not say who made it is Cockpit's, and one nobody made belongs to no one", () => {
  createDataLakeVariable(variable('mavlink/1/1/VFR_HUD/heading', {}))

  expect(isSystemOwnedDataLakeVariable('mavlink/1/1/VFR_HUD/heading')).toBe(true)
  expect(canUserChangeDataLakeVariable('mavlink/1/1/VFR_HUD/heading')).toBe(false)
  expect(canUserDeleteDataLakeVariable('mavlink/1/1/VFR_HUD/heading')).toBe(false)

  expect(canUserChangeDataLakeVariable('never-created')).toBe(false)
  expect(canUserDeleteDataLakeVariable('never-created')).toBe(false)
})

test('the user may change their own variables and the ones Cockpit lets them set, but delete only their own', () => {
  createDataLakeVariable(variable('user/custom/mine', { systemOwned: false, allowUserToChangeValue: true }))
  createDataLakeVariable(variable('camera-zoom-speed', { allowUserToChangeValue: true, persistValue: true }))

  expect(canUserChangeDataLakeVariable('user/custom/mine')).toBe(true)
  expect(canUserChangeDataLakeVariable('camera-zoom-speed')).toBe(true)

  expect(canUserDeleteDataLakeVariable('user/custom/mine')).toBe(true)
  expect(canUserDeleteDataLakeVariable('camera-zoom-speed')).toBe(false)
})
