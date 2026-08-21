import { expect, test, vi } from 'vitest'

import { getDataLakeVariableData } from '@/libs/actions/data-lake'
import { replaceDataLakeInputsInStringAsLiterals } from '@/libs/utils-data-lake'

// The real data lake pulls in the settings manager, which needs a working localStorage the test environment
// does not provide, so the value each input resolves to is set per test.
vi.mock('@/libs/actions/data-lake', () => ({
  getDataLakeVariableData: vi.fn(),
  getDataLakeVariableInfo: vi.fn(),
}))

const evaluate = (expression: string): unknown => eval(`(function() { return ${expression} })()`)

// The form 'evaluateDataLakeExpression' uses for an expression that returns on its own.
const evaluateBody = (expression: string): unknown => eval(`(function() { ${expression} })()`)

const codePayload = '0 })(); globalThis.pwned = true; (function() { return 0'

// A template substitution needs no quote, brace nor backtick to run, so the escaping that keeps a value
// out of syntax in a text position leaves this payload untouched.
const templateSubstitutionPayload = '(globalThis.pwned = true)'

test('A string value is substituted as a literal, so it cannot become code', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue('0); globalThis.pwned = true; (0')

  const expression = replaceDataLakeInputsInStringAsLiterals('{{ /mavlink/3/1/GLOBAL_POSITION_INT/lat }} / 1e7')

  expect(evaluate(expression)).toBeNaN()
  expect('pwned' in globalThis).toBe(false)
})

test('A number value is still substituted as a number', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue(-278899760)

  const expression = replaceDataLakeInputsInStringAsLiterals('{{ /mavlink/3/1/GLOBAL_POSITION_INT/lat }} / 1e7')

  expect(evaluate(expression)).toBeCloseTo(-27.889976)
})

test('A string value inside a string literal stays text, so a saved template keeps its meaning', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue('GUIDED')

  expect(evaluate(replaceDataLakeInputsInStringAsLiterals("'Mode: {{ /vehicle/mode }}'"))).toBe('Mode: GUIDED')
  expect(evaluate(replaceDataLakeInputsInStringAsLiterals("'{{ /vehicle/mode }}' === 'GUIDED'"))).toBe(true)
})

test('A string value cannot close the literal it is substituted into', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue("'; globalThis.pwned = true; '`${globalThis.pwned = true}`")

  const expression = replaceDataLakeInputsInStringAsLiterals("'{{ /vehicle/mode }}'")

  expect(evaluate(expression)).toBe("'; globalThis.pwned = true; '`${globalThis.pwned = true}`")
  expect('pwned' in globalThis).toBe(false)
})

test('A quote inside a comment does not make the value on the next line be read as code', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue(codePayload)

  const expression = replaceDataLakeInputsInStringAsLiterals(
    "// Show the vehicle's last message\nreturn {{ /mavlink/3/1/STATUSTEXT/text }}.length"
  )

  expect(evaluateBody(expression)).toBe(codePayload.length)
  expect('pwned' in globalThis).toBe(false)
})

test('A literal the scan leaves open makes every value quoted, since it can no longer tell code from text', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue(codePayload)

  const expression = replaceDataLakeInputsInStringAsLiterals("/'/.test({{ /mavlink/3/1/STATUSTEXT/text }})")

  expect(evaluate(expression)).toBe(false)
  expect('pwned' in globalThis).toBe(false)
})

test('A value inside a template substitution is a value being read, so it cannot become code', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue(templateSubstitutionPayload)

  const expression = replaceDataLakeInputsInStringAsLiterals(
    '`Depth: ${ {{ /mavlink/3/1/STATUSTEXT/text }} / 1000 } m`'
  )

  expect(evaluate(expression)).toBe('Depth: NaN m')
  expect('pwned' in globalThis).toBe(false)
})

test('A value in the text of a template literal stays text, even when the same template substitutes one', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue('GUIDED')

  const expression = replaceDataLakeInputsInStringAsLiterals('`Mode: {{ /vehicle/mode }} (${ 1 + 1 })`')

  expect(evaluate(expression)).toBe('Mode: GUIDED (2)')
})

test('An input whose variable has no value is left in place for the caller to report', () => {
  vi.mocked(getDataLakeVariableData).mockReturnValue(undefined)

  const input = '{{ /mavlink/3/1/GLOBAL_POSITION_INT/lat }} / 1e7'

  expect(replaceDataLakeInputsInStringAsLiterals(input)).toBe(input)
})
