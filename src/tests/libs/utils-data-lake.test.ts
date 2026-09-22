import { describe, expect, it, test, vi } from 'vitest'

import { createDataLakeVariable, setDataLakeVariableData } from '@/libs/actions/data-lake'
import {
  canUserChangeDataLakeVariable,
  canUserDeleteDataLakeVariable,
  findDataLakeVariablesIdsInString,
  findUnknownDataLakeVariablesInString,
  getSoleDataLakeVariableIdInString,
  isSystemOwnedDataLakeVariable,
  replaceDataLakeInputsInString,
  replaceDataLakeInputsInStringAsLiterals,
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

describe('Data lake inputs substituted as literals', () => {
  const evaluate = (expression: string): unknown => eval(`(function() { return ${expression} })()`)

  // The form 'evaluateDataLakeExpression' uses for an expression that returns on its own.
  const evaluateBody = (expression: string): unknown => eval(`(function() { ${expression} })()`)

  const codePayload = '0 })(); globalThis.pwned = true; (function() { return 0'

  // A template substitution needs no quote, brace nor backtick to run, so the escaping that keeps a value
  // out of syntax in a text position leaves this payload untouched.
  const templateSubstitutionPayload = '(globalThis.pwned = true)'

  it('substitutes a string value as a literal, so it cannot become code', () => {
    setDataLakeVariableData('/mavlink/3/1/GLOBAL_POSITION_INT/lat', '0); globalThis.pwned = true; (0')

    const expression = replaceDataLakeInputsInStringAsLiterals('{{ /mavlink/3/1/GLOBAL_POSITION_INT/lat }} / 1e7')

    expect(evaluate(expression)).toBeNaN()
    expect('pwned' in globalThis).toBe(false)
  })

  it('still substitutes a number value as a number', () => {
    setDataLakeVariableData('/mavlink/3/1/GLOBAL_POSITION_INT/lat', -278899760)

    const expression = replaceDataLakeInputsInStringAsLiterals('{{ /mavlink/3/1/GLOBAL_POSITION_INT/lat }} / 1e7')

    expect(evaluate(expression)).toBeCloseTo(-27.889976)
  })

  it('keeps a number that is not finite as it is, instead of turning it into null', () => {
    setDataLakeVariableData('/mavlink/3/1/VFR_HUD/heading', NaN)
    setDataLakeVariableData('/mavlink/3/1/VFR_HUD/alt', -Infinity)

    expect(evaluate(replaceDataLakeInputsInStringAsLiterals('{{ /mavlink/3/1/VFR_HUD/heading }} + 1'))).toBeNaN()
    expect(evaluate(replaceDataLakeInputsInStringAsLiterals('{{ /mavlink/3/1/VFR_HUD/alt }} / 2'))).toBe(-Infinity)
  })

  it('converts a value to the unit system the input asks for, and keeps it a number', () => {
    createDataLakeVariable(variable('literal-lat', { unit: 'degE7' }), 123456789)

    expect(evaluate(replaceDataLakeInputsInStringAsLiterals('{{ literal-lat : metric }} + 1'))).toBeCloseTo(13.3456789)
  })

  it('keeps a string value inside a string literal as text, so a saved template keeps its meaning', () => {
    setDataLakeVariableData('/vehicle/mode', 'GUIDED')

    expect(evaluate(replaceDataLakeInputsInStringAsLiterals("'Mode: {{ /vehicle/mode }}'"))).toBe('Mode: GUIDED')
    expect(evaluate(replaceDataLakeInputsInStringAsLiterals("'{{ /vehicle/mode }}' === 'GUIDED'"))).toBe(true)
  })

  it('does not let a string value close the literal it is substituted into', () => {
    setDataLakeVariableData('/vehicle/mode', "'; globalThis.pwned = true; '`${globalThis.pwned = true}`")

    const expression = replaceDataLakeInputsInStringAsLiterals("'{{ /vehicle/mode }}'")

    expect(evaluate(expression)).toBe("'; globalThis.pwned = true; '`${globalThis.pwned = true}`")
    expect('pwned' in globalThis).toBe(false)
  })

  it('does not let a quote inside a comment make the value on the next line be read as code', () => {
    setDataLakeVariableData('/mavlink/3/1/STATUSTEXT/text', codePayload)

    const expression = replaceDataLakeInputsInStringAsLiterals(
      "// Show the vehicle's last message\nreturn {{ /mavlink/3/1/STATUSTEXT/text }}.length"
    )

    expect(evaluateBody(expression)).toBe(codePayload.length)
    expect('pwned' in globalThis).toBe(false)
  })

  it('quotes every value when the scan leaves a literal open, since it can no longer tell code from text', () => {
    setDataLakeVariableData('/mavlink/3/1/STATUSTEXT/text', codePayload)

    const expression = replaceDataLakeInputsInStringAsLiterals("/'/.test({{ /mavlink/3/1/STATUSTEXT/text }})")

    expect(evaluate(expression)).toBe(false)
    expect('pwned' in globalThis).toBe(false)
  })

  it('treats a value inside a template substitution as a value being read, so it cannot become code', () => {
    setDataLakeVariableData('/mavlink/3/1/STATUSTEXT/text', templateSubstitutionPayload)

    const expression = replaceDataLakeInputsInStringAsLiterals(
      '`Depth: ${ {{ /mavlink/3/1/STATUSTEXT/text }} / 1000 } m`'
    )

    expect(evaluate(expression)).toBe('Depth: NaN m')
    expect('pwned' in globalThis).toBe(false)
  })

  it('keeps a value in the text of a template literal as text, even when the same template substitutes one', () => {
    setDataLakeVariableData('/vehicle/mode', 'GUIDED')

    const expression = replaceDataLakeInputsInStringAsLiterals('`Mode: {{ /vehicle/mode }} (${ 1 + 1 })`')

    expect(evaluate(expression)).toBe('Mode: GUIDED (2)')
  })

  it('leaves an input whose variable has no value in place for the caller to report', () => {
    const input = '{{ /mavlink/3/1/NEVER_SENT/lat }} / 1e7'

    expect(replaceDataLakeInputsInStringAsLiterals(input)).toBe(input)
  })
})

test('finds unavailable and malformed placeholders without rejecting available ones', () => {
  expect(findUnknownDataLakeVariablesInString('Bearer {{ known }} {{ missing }} {{ two words }}', ['known'])).toEqual([
    'missing',
    'two words',
  ])
})

test('checks the variable id rather than the unit system in placeholders', () => {
  expect(findUnknownDataLakeVariablesInString('{{ known : metric }} {{ missing : imperial }}', ['known'])).toEqual([
    'missing',
  ])
})
