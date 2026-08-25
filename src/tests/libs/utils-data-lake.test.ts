import { describe, expect, it, test, vi } from 'vitest'

import { createDataLakeVariable } from '@/libs/actions/data-lake'
import {
  canUserChangeDataLakeVariable,
  canUserDeleteDataLakeVariable,
  findDataLakeVariablesIdsInString,
  getSoleDataLakeVariableIdInString,
  isSystemOwnedDataLakeVariable,
  replaceDataLakeInputsInString,
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

describe('Data lake input unit systems', () => {
  createDataLakeVariable(variable('lat', { unit: 'degE7' }), 123456789)
  createDataLakeVariable(variable('alt', { unit: 'mm' }), 5000)
  createDataLakeVariable(variable('sog', { unit: 'cm/s' }), 500)
  createDataLakeVariable(variable('plain', {}), 42)

  it('leaves values untouched when no unit system is asked for', () => {
    expect(replaceDataLakeInputsInString('{{ lat }}')).toBe('123456789')
    expect(replaceDataLakeInputsInString('{{ alt }}')).toBe('5000')
  })

  it('converts to the metric reading of the variable unit', () => {
    expect(replaceDataLakeInputsInString('{{ lat : metric }}')).toBe('12.3456789')
    expect(replaceDataLakeInputsInString('{{ alt:metric }}')).toBe('5')
  })

  it('converts to the imperial reading of the variable unit', () => {
    expect(Number(replaceDataLakeInputsInString('{{ alt : imperial }}'))).toBeCloseTo(16.4041995, 6)
  })

  it('converts to the nautical reading of the variable unit', () => {
    expect(Number(replaceDataLakeInputsInString('{{ sog : nautical }}'))).toBeCloseTo(9.7192, 4)
  })

  it('passes the value through when the variable states no unit', () => {
    expect(replaceDataLakeInputsInString('{{ plain : metric }}')).toBe('42')
  })

  it('resolves an input to its variable id regardless of the unit system', () => {
    expect(findDataLakeVariablesIdsInString('{{ lat : metric }} + {{ alt : imperial }}')).toEqual(['lat', 'alt'])
    expect(getSoleDataLakeVariableIdInString('{{ lat : metric }}')).toBe('lat')
  })

  // A mistyped system used to leave the braces in place, which reached eval as a SyntaxError and
  // killed the expression for good. It now costs only the conversion.
  it('reads a mistyped unit system as no unit system at all', () => {
    expect(replaceDataLakeInputsInString('{{ lat : si }}')).toBe('123456789')
    expect(replaceDataLakeInputsInString('{{ lat : }}')).toBe('123456789')
    expect(findDataLakeVariablesIdsInString('{{ lat : si }}')).toEqual(['lat'])
  })
})
