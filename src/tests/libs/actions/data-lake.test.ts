import { expect, test, vi } from 'vitest'

import { type DataLakeVariable } from '@/types/data-lake'

const persistentValuesKey = 'cockpit-persistent-data-lake-values'
const storage: Record<string, unknown> = {
  [persistentValuesKey]: { 'camera-zoom-speed': 7, 'camera-focus-speed': 5 },
}

vi.mock('@/libs/settings-management', () => ({
  settingsManager: {
    getKeyValue: (key: string): unknown => storage[key],
    setKeyValue: (key: string, value: unknown): void => {
      storage[key] = structuredClone(value)
    },
  },
}))

const speedVariable = (id: string): DataLakeVariable => ({ id, name: id, type: 'number', persistValue: true })

test('a saved value survives the registration of the persistValue variables that come after it', async () => {
  const { createDataLakeVariable, getDataLakeVariableData } = await import('@/libs/actions/data-lake')

  createDataLakeVariable(speedVariable('camera-zoom-speed'), 3)
  createDataLakeVariable(speedVariable('camera-focus-speed'), 3)

  expect(getDataLakeVariableData('camera-zoom-speed')).toBe(7)
  expect(getDataLakeVariableData('camera-focus-speed')).toBe(5)
})

test('deleting a persistValue variable drops its stored value and nothing else', async () => {
  const { createDataLakeVariable, deleteDataLakeVariable } = await import('@/libs/actions/data-lake')

  createDataLakeVariable(speedVariable('some-other-speed'), 1)
  deleteDataLakeVariable('some-other-speed')

  expect(storage[persistentValuesKey]).not.toHaveProperty('some-other-speed')
  expect(storage[persistentValuesKey]).toMatchObject({ 'camera-zoom-speed': 7, 'camera-focus-speed': 5 })
})
