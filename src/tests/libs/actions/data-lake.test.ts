import { expect, test, vi } from 'vitest'

import { type DataLakeVariable } from '@/types/data-lake'

const persistentValuesKey = 'cockpit-persistent-data-lake-values'
const persistentVariablesKey = 'cockpit-persistent-data-lake-variables'
const storage: Record<string, unknown> = {
  [persistentValuesKey]: { 'camera-zoom-speed': 7, 'camera-focus-speed': 5 },
  // Stored by a Cockpit version that did not record who made a variable. Only the dialogs that create one on the
  // user's behalf ever write to this key, since Cockpit's own are never `persistent`.
  [persistentVariablesKey]: [{ id: 'user/custom/legacy', name: 'Legacy', type: 'number', persistent: true }],
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

test("a variable stored before Cockpit recorded who made one is read back as the user's", async () => {
  const { getDataLakeVariableInfo } = await import('@/libs/actions/data-lake')

  // Assuming Cockpit's ownership, as everywhere else, would take the user's own variables away from them.
  expect(getDataLakeVariableInfo('user/custom/legacy')?.systemOwned).toBe(false)
})

test('deleting a persistValue variable drops its stored value and nothing else', async () => {
  const { createDataLakeVariable, deleteDataLakeVariable } = await import('@/libs/actions/data-lake')

  createDataLakeVariable(speedVariable('some-other-speed'), 1)
  deleteDataLakeVariable('some-other-speed')

  expect(storage[persistentValuesKey]).not.toHaveProperty('some-other-speed')
  expect(storage[persistentValuesKey]).toMatchObject({ 'camera-zoom-speed': 7, 'camera-focus-speed': 5 })
})
