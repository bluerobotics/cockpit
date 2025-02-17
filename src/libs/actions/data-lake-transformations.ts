import {
  findDataLakeVariablesIdsInString,
  getDataLakeVariableIdFromInput,
  replaceDataLakeInputsInString,
} from '../utils-data-lake'
import {
  createDataLakeVariable,
  DataLakeVariable,
  deleteDataLakeVariable,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
} from './data-lake'

const transformingFunctionsKey = 'cockpit-transforming-functions'

let globalTransformingFunctions: TransformingFunction[] = []

const loadTransformingFunctions = (): void => {
  const transformingFunctions = localStorage.getItem(transformingFunctionsKey)
  if (!transformingFunctions) {
    globalTransformingFunctions = []
    return
  }
  globalTransformingFunctions = JSON.parse(transformingFunctions)
  updateTransformingFunctionListeners()
}

const saveTransformingFunctions = (): void => {
  localStorage.setItem(transformingFunctionsKey, JSON.stringify(globalTransformingFunctions))
  updateTransformingFunctionListeners()
}

const getExpressionValue = (func: TransformingFunction): string | number | boolean => {
  const expressionWithValues = replaceDataLakeInputsInString(func.expression)
  if (func.expression.includes('return')) {
    return eval(`(function() { ${expressionWithValues} })()`)
  }
  return eval(`(function() { return ${expressionWithValues} })()`)
}

const variablesListeners: Record<string, Record<string, string[]>> = {}

const nextDelayToEvaluateFaillingTransformingFunction: Record<string, number> = {}
const lastTimeTriedToEvaluateFaillingTransformingFunction: Record<string, number> = {}

const setupTransformingFunctionsListeners = (): void => {
  globalTransformingFunctions.forEach((func) => {
    const dataLakeVariablesInExpression = getDataLakeVariableIdFromInput(func.expression)
    if (dataLakeVariablesInExpression) {
      const variableIds = findDataLakeVariablesIdsInString(func.expression)
      variableIds.forEach((variableId) => {
        const listenerId = listenDataLakeVariable(variableId, () => {
          try {
            // If the function is failing, we don't want to evaluate it too often
            const currentDelay = nextDelayToEvaluateFaillingTransformingFunction[func.id] || 10
            const lastTimeTried = lastTimeTriedToEvaluateFaillingTransformingFunction[func.id] || 0
            if (currentDelay > 0 && lastTimeTried + currentDelay > Date.now()) {
              return
            } else {
              const expressionValue = getExpressionValue(func)
              setDataLakeVariableData(func.id, expressionValue)
            }
          } catch (error) {
            lastTimeTriedToEvaluateFaillingTransformingFunction[func.id] = Date.now()
            const currentDelay = nextDelayToEvaluateFaillingTransformingFunction[func.id] || 10
            const nextDelay = Math.min(2 * currentDelay, 10000)
            nextDelayToEvaluateFaillingTransformingFunction[func.id] = nextDelay
            const msg = `Error evaluating expression for transforming function '${func.id}'. Next evaluation in ${nextDelay} ms. Error: ${error}`
            console.error(msg)
          }
        })
        if (!variablesListeners[func.id]) {
          variablesListeners[func.id] = { [variableId]: [listenerId] }
        } else if (!variablesListeners[func.id][variableId]) {
          variablesListeners[func.id][variableId] = [listenerId]
        } else {
          variablesListeners[func.id][variableId].push(listenerId)
        }
      })
    }
  })
}

const deleteAllTransformingFunctionsListeners = (): void => {
  Object.keys(nextDelayToEvaluateFaillingTransformingFunction).forEach((funcId) => {
    delete nextDelayToEvaluateFaillingTransformingFunction[funcId]
    delete lastTimeTriedToEvaluateFaillingTransformingFunction[funcId]
  })
  Object.keys(lastTimeTriedToEvaluateFaillingTransformingFunction).forEach((funcId) => {
    delete lastTimeTriedToEvaluateFaillingTransformingFunction[funcId]
  })
  Object.entries(variablesListeners).forEach(([funcId, variableListeners]) => {
    Object.entries(variableListeners).forEach(([variableId, listenerIds]) => {
      listenerIds.forEach((listenerId) => unlistenDataLakeVariable(variableId, listenerId))
    })
    delete variablesListeners[funcId]
  })
}

const deleteAllTransformingFunctionsVariables = (): void => {
  globalTransformingFunctions.forEach((func) => {
    deleteDataLakeVariable(func.id)
  })
}

const setupAllTransformingFunctionsVariables = (): void => {
  globalTransformingFunctions.forEach((func) => {
    try {
      createDataLakeVariable(new DataLakeVariable(func.id, func.name, func.type, func.description))
    } catch (createError) {
      const msg = `Could not create data lake variable info for transforming function ${func.id}. Error: ${createError}`
      console.error(msg)
    }
  })
}

const updateTransformingFunctionListeners = (): void => {
  deleteAllTransformingFunctionsListeners()
  deleteAllTransformingFunctionsVariables()
  setupAllTransformingFunctionsVariables()
  setupTransformingFunctionsListeners()
}

/**
 * Interface for a transforming function that creates a new data lake variable
 * based on an expression using other variables
 */
export interface TransformingFunction {
  /** Name of the new variable */
  name: string
  /** ID of the new variable */
  id: string
  /** Type of the new variable */
  type: 'string' | 'number' | 'boolean'
  /** Description of the new variable */
  description?: string
  /** JavaScript expression that defines how to calculate the new variable */
  expression: string
}

/**
 * Creates a new transforming function that listens to its dependencies
 * and updates its value when they change
 * @param {string} id - ID of the new variable
 * @param {string} name - Name of the new variable
 * @param {'string' | 'number' | 'boolean'} type - Type of the new variable
 * @param {string} expression - Expression to calculate the variable's value
 * @param {string?} description - Description of the new variable
 */
export const createTransformingFunction = (
  id: string,
  name: string,
  type: 'string' | 'number' | 'boolean',
  expression: string,
  description?: string
): void => {
  const transformingFunction: TransformingFunction = { name, id, type, expression, description }
  globalTransformingFunctions.push(transformingFunction)
  createDataLakeVariable(new DataLakeVariable(id, name, type, description))
  saveTransformingFunctions()
}

/**
 * Returns all transforming functions
 * @returns {TransformingFunction[]} All transforming functions
 */
export const getAllTransformingFunctions = (): TransformingFunction[] => {
  return globalTransformingFunctions
}

/**
 * Updates a transforming function
 * @param {TransformingFunction} func - The function to update
 */
export const updateTransformingFunction = (func: TransformingFunction): void => {
  const index = globalTransformingFunctions.findIndex((f) => f.id === func.id)
  if (index !== -1) {
    globalTransformingFunctions[index] = func
    saveTransformingFunctions()
  }
}

/**
 * Deletes a transforming function and cleans up its subscriptions
 * @param {TransformingFunction} func - The function to delete
 */
export const deleteTransformingFunction = (func: TransformingFunction): void => {
  // Remove the variable from the data lake
  globalTransformingFunctions = globalTransformingFunctions.filter((f) => f.id !== func.id)
  deleteDataLakeVariable(func.id)
  saveTransformingFunctions()
}

loadTransformingFunctions()
