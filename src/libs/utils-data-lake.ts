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
 * @param {Function} replaceFunction The function to use to replace the data lake inputs. If not provided, the default function will be used.
 * @returns {string} The string with data lake inputs replaced
 */
export const replaceDataLakeInputsInString = (input: string, replaceFunction?: (match: string) => string): string => {
  if (typeof input !== 'string') return input

  const defaultReplaceFunction = (match: string): string => {
    const variableId = getDataLakeVariableIdFromInput(match)
    if (!variableId) return match
    const variableData = getDataLakeVariableData(variableId)
    if (variableData === undefined) return match
    return variableData.toString()
  }

  const replaceFunctionToUse = replaceFunction || defaultReplaceFunction

  return input.toString().replace(dataLakeInputRegex, (match) => replaceFunctionToUse(match))
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
