import { getDataLakeVariableData, getDataLakeVariableInfo } from './actions/data-lake'

/**
 * Guess the type of a string
 * @param {string} str The string to guess the type of
 * @returns {'boolean' | 'number' | 'string'} The guessed type of the string
 */
export const guessedTypeFromString = (str: string): 'boolean' | 'number' | 'string' => {
  const strValue = str.toString().toLowerCase()
  // Check if it's a boolean
  if (strValue === 'true' || strValue === 'false') {
    return 'boolean'
  }
  // Check if it's a number
  if (!isNaN(Number(strValue)) && strValue !== '') {
    return 'number'
  }
  return 'string'
}

/**
 * Regex to find all data lake inputs in a string.
 * The inputs include the {{ and }}, so they can be used to replace the input in original string.
 * @type {RegExp}
 */
export const dataLakeInputRegex = /{{\s*([^{}\s]+)\s*}}/g

/**
 * Find all data lake inputs in a string.
 * The inputs include the {{ and }}, so they can be used to replace the input in original string.
 * @param {string} input The string to search for data lake inputs
 * @returns {string[]} An array of possible data lake inputs. If there are no data lake inputs, an empty array is returned.
 */
export const findDataLakeInputsInString = (input: string): string[] => {
  if (typeof input !== 'string') return []
  return input.match(dataLakeInputRegex) || []
}

/**
 * Get the id of a data lake variable from an input string.
 * @param {string} input The string to search for a data lake variable id
 * @returns {string | null} The id of the data lake variable or null if no id is found
 */
export const getDataLakeVariableIdFromInput = (input: string): string | null => {
  const match = input.match(dataLakeInputRegex)
  if (!match) return null
  return match[0].replace('{{', '').replace('}}', '').trim()
}

/**
 * Replace all data lake inputs in a string with values from the data lake.
 * If a possible input is not found in the data lake, it will be left unchanged.
 * @param {string} input The string to replace data lake inputs in
 * @param {Function} replaceFunction The function to use to replace the data lake inputs, taking the match and the position it was found at. If not provided, the default function will be used.
 * @returns {string} The string with data lake inputs replaced
 */
export const replaceDataLakeInputsInString = (
  input: string,
  replaceFunction?: (match: string, offset: number) => string
): string => {
  if (typeof input !== 'string') return input

  const defaultReplaceFunction = (match: string): string => {
    const variableId = getDataLakeVariableIdFromInput(match)
    if (!variableId) return match
    const variableData = getDataLakeVariableData(variableId)
    if (variableData === undefined) return match
    return variableData.toString()
  }

  const replaceFunctionToUse = replaceFunction || defaultReplaceFunction

  return input.toString().replace(dataLakeInputRegex, (match, _id, offset) => replaceFunctionToUse(match, offset))
}

/**
 * Tell, for each position of a JavaScript expression, whether it sits inside a string literal.
 * Comments are skipped, so an apostrophe in one does not open a literal the evaluation never sees.
 * A template literal's '${ ... }' is an expression the evaluation runs, so it counts as code and not as
 * part of the literal holding it.
 * @param {string} code The expression to scan
 * @returns {boolean[]} Whether the character at each position is inside a string literal
 */
const stringLiteralPositions = (code: string): boolean[] => {
  // ponytail: quotes, comments and template substitutions only, so a quote or a brace inside a regex literal
  // still shifts what follows it. Two of those balance out and can hand a code position the unquoted form;
  // tokenize if that ever matters.
  const positions = new Array<boolean>(code.length).fill(false)
  // What is currently open, innermost last: a quote for each string literal, '${' for each template
  // substitution and '{' for each brace nested in one, which is how the substitution's own '}' is found.
  const open: string[] = []

  for (let index = 0; index < code.length; index++) {
    const character = code[index]
    const enclosing = open[open.length - 1]
    const insideLiteral = enclosing === "'" || enclosing === '"' || enclosing === '`'
    const commentOpener = insideLiteral ? '' : code.slice(index, index + 2)
    if (commentOpener === '//' || commentOpener === '/*') {
      const commentEnd =
        commentOpener === '//' ? code.indexOf('\n', index) : code.indexOf('*/', index + commentOpener.length)
      if (commentEnd === -1) break
      index = commentOpener === '//' ? commentEnd : commentEnd + 1
    } else if (insideLiteral && character === '\\') {
      positions[index] = true
      if (index + 1 < code.length) positions[index + 1] = true
      index++
    } else if (enclosing === '`' && character === '$' && code[index + 1] === '{') {
      open.push('${')
      index++
    } else if (insideLiteral) {
      positions[index] = character !== enclosing
      if (character === enclosing) open.pop()
    } else if (["'", '"', '`'].includes(character)) {
      open.push(character)
    } else if (enclosing !== undefined && character === '{') {
      open.push('{')
    } else if (enclosing !== undefined && character === '}') {
      open.pop()
    }
  }

  // Anything left open means the scan lost track of which positions are code, and the unquoted form in a
  // code position is exactly the injection this exists to prevent, so no position is trusted as text.
  return open.length === 0 ? positions : positions.fill(false)
}

// Escaped for all three kinds of string literal at once, since the value has to be unable to close the one
// it lands in, whichever that is, nor open a template substitution inside it.
const asStringLiteralContent = (value: unknown): string =>
  JSON.stringify(String(value)).slice(1, -1).replace(/['`]/g, '\\$&').replace(/\$\{/g, '\\${')

/**
 * Replace all data lake inputs in a string with their values written as JavaScript literals, for strings
 * that are going to be evaluated as code. Substituting a string value raw would let it be read as syntax
 * instead of as a value, so whatever wrote the variable would be choosing what the evaluation runs.
 * An input inside a string literal is text being built rather than a value being read, so it gets the value
 * escaped instead of quoted, which keeps templates like `'Mode: {{ /x }}'` meaning what they always did.
 * If a possible input is not found in the data lake, it will be left unchanged.
 * @param {string} input The string to replace data lake inputs in
 * @returns {string} The string with data lake inputs replaced by their literals
 */
export const replaceDataLakeInputsInStringAsLiterals = (input: string): string => {
  const insideStringLiteral = typeof input === 'string' ? stringLiteralPositions(input) : []

  return replaceDataLakeInputsInString(input, (match, offset) => {
    const variableId = getDataLakeVariableIdFromInput(match)
    if (!variableId) return match
    const variableData = getDataLakeVariableData(variableId)
    if (variableData === undefined) return match
    return insideStringLiteral[offset] ? asStringLiteralContent(variableData) : JSON.stringify(variableData)
  })
}

/**
 * Get the id of the single data lake variable a string is made of, be it a bare id, taken as-is
 * without checking it exists, or a lone '{{ }}' reference. A string mixing a reference with other
 * text has no sole variable.
 * @param {string} input The string to inspect
 * @returns {string | null} The variable id, or null when the string is not a single variable
 */
export const getSoleDataLakeVariableIdInString = (input: string): string | null => {
  const value = input.trim()
  if (value === '') return null

  const inputs = findDataLakeInputsInString(value)
  if (inputs.length === 0) return value
  return inputs.length === 1 && inputs[0] === value ? getDataLakeVariableIdFromInput(value) : null
}

/**
 * Find all data lake variable ids in a string.
 * @param {string} input The string to search for data lake variable ids
 * @returns {string[]} An array of data lake variable ids
 */
export const findDataLakeVariablesIdsInString = (input: string): string[] => {
  const inputs = findDataLakeInputsInString(input)
  return inputs.map((i) => getDataLakeVariableIdFromInput(i)).filter((id) => id !== null)
}

export const replaceDataLakeInputsInJsonString = (jsonString: string): string => {
  let parsedJson = jsonString

  const inputs = findDataLakeInputsInString(parsedJson)
  inputs.forEach((input) => {
    const variableId = getDataLakeVariableIdFromInput(input)
    if (!variableId) return input
    const variableInfo = getDataLakeVariableInfo(variableId)
    const variableData = getDataLakeVariableData(variableId)
    if (variableInfo === undefined || variableData === undefined) return input

    // Determine type either from variable info or by parsing the value
    const type = variableInfo.type || guessedTypeFromString(variableData?.toString() || '')

    if (type === 'string') {
      parsedJson = parsedJson.replace(input, variableData.toString())
    } else if (type === 'number' || type === 'boolean') {
      parsedJson = parsedJson.replace(`"${input}"`, variableData.toString())
    } else {
      return input
    }
  })

  return parsedJson
}
