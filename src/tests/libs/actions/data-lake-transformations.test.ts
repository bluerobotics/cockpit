import { expect, test, vi } from 'vitest'

import { type TransformingFunction } from '@/libs/actions/data-lake-transformations'

const transformingFunctionsKey = 'cockpit-transforming-functions'

// A function stored by a Cockpit version that did not record who owned it, plus one the user actually made.
const storage: Record<string, unknown> = {
  [transformingFunctionsKey]: [
    { id: 'camera-zoom', name: 'Camera Zoom', type: 'number', expression: '1' },
    { id: 'user/compound/mine', name: 'Mine', type: 'number', expression: '2' },
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

const storedFunction = (id: string): TransformingFunction =>
  (storage[transformingFunctionsKey] as TransformingFunction[]).find((func) => func.id === id) as TransformingFunction

test("an already stored function is recorded as Cockpit's, keeping the expression the user may have tuned", async () => {
  const { ensureCockpitTransformingFunction, getAllTransformingFunctions } = await import(
    '@/libs/actions/data-lake-transformations'
  )

  ensureCockpitTransformingFunction({
    id: 'camera-zoom',
    name: 'Camera Zoom',
    type: 'number',
    expression: 'the default expression',
    allowUserToChangeValue: true,
  })

  expect(storedFunction('camera-zoom')).toMatchObject({
    expression: '1',
    systemOwned: true,
    allowUserToChangeValue: true,
  })
  // Read as the user's, since a pre-flag entry cannot be told from one they wrote, and assuming otherwise would
  // take their own compound variables away from them.
  expect(storedFunction('user/compound/mine').systemOwned).toBe(false)
  expect(getAllTransformingFunctions()).toHaveLength(2)
})

test('a function Cockpit has not stored yet is created already recorded as its own', async () => {
  const { ensureCockpitTransformingFunction } = await import('@/libs/actions/data-lake-transformations')

  ensureCockpitTransformingFunction({
    id: 'outputs/mavlink/axis-x',
    name: 'Axis X Output',
    type: 'number',
    expression: '3',
    allowUserToChangeValue: true,
  })

  expect(storedFunction('outputs/mavlink/axis-x')).toMatchObject({
    expression: '3',
    systemOwned: true,
    allowUserToChangeValue: true,
  })
})

test('what is recorded reaches the data lake variable the page reads, which is what gates the actions', async () => {
  const { ensureCockpitTransformingFunction, isCompoundDataLakeVariable } = await import(
    '@/libs/actions/data-lake-transformations'
  )
  const { canUserChangeDataLakeVariable, canUserDeleteDataLakeVariable } = await import('@/libs/utils-data-lake')

  const legacySystemId = { id: 'ardupilotSystemId', name: '(Legacy) ArduPilot System ID', type: 'number' as const }
  ensureCockpitTransformingFunction({ ...legacySystemId, expression: '{{autopilotSystemId}}' })
  // Claimed here too rather than relying on the first test having run, so this one passes on its own.
  const cameraZoom = { id: 'camera-zoom', name: 'Camera Zoom', type: 'number' as const, expression: '1' }
  ensureCockpitTransformingFunction({ ...cameraZoom, allowUserToChangeValue: true })

  // Cockpit's compound variables are never the user's to delete, whether or not it may change them.
  expect(canUserDeleteDataLakeVariable('ardupilotSystemId')).toBe(false)
  expect(canUserDeleteDataLakeVariable('camera-zoom')).toBe(false)
  expect(canUserChangeDataLakeVariable('camera-zoom')).toBe(true)
  expect(canUserDeleteDataLakeVariable('user/compound/mine')).toBe(true)

  // No control may write to a computed variable, however changeable the page considers it.
  expect(isCompoundDataLakeVariable('camera-zoom')).toBe(true)
  expect(isCompoundDataLakeVariable('camera-zoom-speed')).toBe(false)
})
