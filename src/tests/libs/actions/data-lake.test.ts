import { expect, test, vi } from 'vitest'

import { type DataLakeVariable } from '@/types/data-lake'

const persistentValuesKey = 'cockpit-persistent-data-lake-values'
const persistentVariablesKey = 'cockpit-persistent-data-lake-variables'
const storage: Record<string, unknown> = {
  [persistentValuesKey]: { 'camera-zoom-speed': 7, 'camera-focus-speed': 5, '/user/twin': 1, 'user/twin': 2 },
  // Stored by a Cockpit version that did not record who made a variable. Only the dialogs that create one on the
  // user's behalf ever write to this key, since Cockpit's own are never `persistent`.
  [persistentVariablesKey]: [
    { id: 'user/custom/legacy', name: 'Legacy', type: 'number', persistent: true },
    // Two variables an older Cockpit kept apart, whose ids only differ by the leading slash.
    { id: '/user/twin', name: 'Slashed twin', type: 'number', persistent: true, persistValue: true },
    { id: 'user/twin', name: 'Bare twin', type: 'number', persistent: true, persistValue: true },
  ],
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

test('an id with or without its leading slash names the same variable', async () => {
  const { createDataLakeVariable, getDataLakeVariableData, listenDataLakeVariable, setDataLakeVariableData } =
    await import('@/libs/actions/data-lake')

  createDataLakeVariable({ id: '/repro/slash', name: 'repro', type: 'number' }, 7)
  expect(getDataLakeVariableData('/repro/slash')).toBe(7)
  expect(getDataLakeVariableData('repro/slash')).toBe(7)

  const listener = vi.fn()
  listenDataLakeVariable('/repro/slash', listener)
  setDataLakeVariableData('repro/slash', 8)
  expect(listener).toHaveBeenCalledWith(8)
})

test('records stay keyed by the id they were written with, even for a listener that came first', async () => {
  const { dataLakeVariableData, listenDataLakeVariable, setDataLakeVariableData } = await import(
    '@/libs/actions/data-lake'
  )

  const listener = vi.fn()
  listenDataLakeVariable('early/listener', listener)
  setDataLakeVariableData('/early/listener', 3)

  expect(listener).toHaveBeenCalledWith(3)
  expect(Object.keys(dataLakeVariableData)).toContain('/early/listener')
  expect(Object.keys(dataLakeVariableData)).not.toContain('early/listener')
})

test('saving never rewrites a stored id, nor drops one that only differs from another by its leading slash', async () => {
  const { createDataLakeVariable, getDataLakeVariableData, getDataLakeVariableInfo } = await import(
    '@/libs/actions/data-lake'
  )

  expect(getDataLakeVariableInfo('user/twin')?.name).toBe('Slashed twin')
  expect(getDataLakeVariableData('user/twin')).toBe(1)

  createDataLakeVariable({ id: 'user/another', name: 'Another', type: 'number', persistent: true })
  createDataLakeVariable({ id: 'user/value-saver', name: 'Saver', type: 'number', persistValue: true }, 0)

  const storedIds = (storage[persistentVariablesKey] as DataLakeVariable[]).map((variable) => variable.id)
  expect(storedIds).toEqual(expect.arrayContaining(['user/custom/legacy', '/user/twin', 'user/twin', 'user/another']))
  expect(storage[persistentValuesKey]).toMatchObject({ '/user/twin': 1, 'user/twin': 2 })
})
