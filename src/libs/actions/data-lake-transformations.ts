import { settingsManager } from '../settings-management'
import { findDataLakeVariablesIdsInString, replaceDataLakeInputsInString } from '../utils-data-lake'
import {
  createDataLakeVariable,
  DataLakeVariableType,
  deleteDataLakeVariable,
  getDataLakeVariableData,
  listenDataLakeVariable,
  setDataLakeVariableData,
  unlistenDataLakeVariable,
} from './data-lake'

const transformingFunctionsKey = 'cockpit-transforming-functions'

let globalTransformingFunctions: TransformingFunction[] = []

const loadTransformingFunctions = (): void => {
  const transformingFunctions = settingsManager.getKeyValue(transformingFunctionsKey)
  if (transformingFunctions === undefined) {
    globalTransformingFunctions = []
    return
  }
  globalTransformingFunctions = transformingFunctions as TransformingFunction[]
  updateTransformingFunctionListeners()
}

const saveTransformingFunctions = (): void => {
  settingsManager.setKeyValue(transformingFunctionsKey, globalTransformingFunctions)
  updateTransformingFunctionListeners()
}

// Substitutes `NaN` for any data-lake variable that has not been populated yet,
// so expressions referencing missing dependencies evaluate to `NaN` instead of
// throwing a SyntaxError. Once the missing variable's data arrives, the listener
// fires and the expression is re-evaluated with the real value.
const expressionReplaceFunction = (match: string): string => {
  const variableId = match.replace('{{', '').replace('}}', '').trim()
  if (!variableId) return 'NaN'
  const variableData = getDataLakeVariableData(variableId)
  if (variableData === undefined) return 'NaN'
  return variableData.toString()
}

/**
 * Evaluates a data-lake expression, replacing `{{ variable }}` inputs with their current values and
 * running the result as a JavaScript expression (so arithmetic like "{{ x }} * 10" works).
 * Missing dependencies are substituted with `NaN` so the expression can still evaluate.
 * @param {string} expression - The expression to evaluate
 * @returns {string | number | boolean} The evaluated value
 */
export const evaluateDataLakeExpression = (expression: string): string | number | boolean => {
  const expressionWithValues = replaceDataLakeInputsInString(expression, expressionReplaceFunction)

  // If the expression contains a return statement, we can just evaluate it directly
  if (expression.includes('return')) {
    return eval(`(function() { ${expressionWithValues} })()`)
  }

  // If the expression doesn't contain comments, we can just add a return statement in the beggining and evaluate it
  if (!expressionWithValues.includes('//') && !expressionWithValues.includes('/*')) {
    return eval(`(function() { return ${expressionWithValues} })()`)
  }

  // If the expression contains comments, we need to remove the comment lines and add a return statement in the beggining
  const lines = expressionWithValues.split('\n')
  let multiLineCommentOngoing = false
  for (const line of lines) {
    if (line.trim().startsWith('/*') && line.trim().endsWith('*/')) {
      continue
    }
    if (line.trim().startsWith('/*')) {
      multiLineCommentOngoing = true
      continue
    }
    if (line.trim().includes('*/')) {
      multiLineCommentOngoing = false
      continue
    }
    if (!line.trim().startsWith('//') && !multiLineCommentOngoing && line.trim().length > 0) {
      return eval(`(function() { return ${line.trim()} })()`)
    }
  }

  throw new Error('Function has no return statement and has comments on all lines.')
}

const getExpressionValue = (func: TransformingFunction): string | number | boolean => {
  return evaluateDataLakeExpression(func.expression)
}

const variablesListeners: Record<string, Record<string, string>> = {}

const nextDelayToEvaluateFailingTransformingFunction: Record<string, number> = {}
const lastTimeTriedToEvaluateFailingTransformingFunction: Record<string, number> = {}
const initialEvaluationTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
// Last error logged per function, so a function that keeps failing the same way (e.g. depends on a vehicle
// parameter that never arrives) is logged once instead of on every dependency update.
const lastLoggedErrorForTransformingFunction: Record<string, string> = {}

const setupTransformingFunctionsListeners = (): void => {
  globalTransformingFunctions.forEach((func) => {
    // Re-syncs the listener set to whatever variables the expression currently
    // resolves into. Necessary for expressions with nested templates like
    // `{{vehicle/{{autopilotSystemId}}/parameters/X}}` — when the inner
    // variable changes, the outer reference resolves to a different ID and we
    // need to listen to the new one.
    const syncDependencies = (): void => {
      const desiredIds = new Set(findDataLakeVariablesIdsInString(func.expression))
      const currentIds = new Set(Object.keys(variablesListeners[func.id] ?? {}))

      desiredIds.forEach((variableId) => {
        if (currentIds.has(variableId)) return
        const listenerId = listenDataLakeVariable(variableId, onDependencyChange)
        if (!variablesListeners[func.id]) variablesListeners[func.id] = {}
        variablesListeners[func.id][variableId] = listenerId
      })

      currentIds.forEach((variableId) => {
        if (desiredIds.has(variableId)) return
        const listenerId = variablesListeners[func.id]?.[variableId]
        if (listenerId) unlistenDataLakeVariable(variableId, listenerId)
        if (variablesListeners[func.id]) delete variablesListeners[func.id][variableId]
      })
    }

    const evaluate = (): void => {
      try {
        // If the function is failing, we don't want to evaluate it too often
        const currentDelay = nextDelayToEvaluateFailingTransformingFunction[func.id] || 10
        const lastTimeTried = lastTimeTriedToEvaluateFailingTransformingFunction[func.id] || 0
        if (currentDelay > 0 && lastTimeTried + currentDelay > Date.now()) return

        setDataLakeVariableData(func.id, getExpressionValue(func))

        delete nextDelayToEvaluateFailingTransformingFunction[func.id]
        delete lastTimeTriedToEvaluateFailingTransformingFunction[func.id]
        delete lastLoggedErrorForTransformingFunction[func.id]
      } catch (error) {
        lastTimeTriedToEvaluateFailingTransformingFunction[func.id] = Date.now()
        const currentDelay = nextDelayToEvaluateFailingTransformingFunction[func.id] || 10
        const nextDelay = Math.min(2 * currentDelay, 10000)
        nextDelayToEvaluateFailingTransformingFunction[func.id] = nextDelay
        // Avoid spamming the log when the same error repeats on every dependency update.
        const errorText = `${error}`
        if (lastLoggedErrorForTransformingFunction[func.id] !== errorText) {
          lastLoggedErrorForTransformingFunction[func.id] = errorText
          const msg = `Error evaluating expression for transforming function '${func.id}'. Next evaluation in ${nextDelay} ms. Error: ${errorText}`
          console.error(msg)
        }
      }
    }

    const onDependencyChange = (): void => {
      // If the variable changes, we don't need to perform the initial evaluation again
      clearTimeout(initialEvaluationTimeouts[func.id])
      evaluate()
      // Re-sync after evaluation: a change to an inner template variable (e.g.
      // `autopilotSystemId`) may have shifted the resolved dependency set.
      syncDependencies()
    }

    // This function is used to evaluate the transforming function when it's created.
    // It's called when the transforming function is created and then every 1000ms until it succeeds, with a max of 10 tries.
    const performInitialEvaluation = (timesTried = 0): void => {
      try {
        setDataLakeVariableData(func.id, getExpressionValue(func))
        clearTimeout(initialEvaluationTimeouts[func.id])
      } catch (error) {
        console.error(`Error setting initial value for transforming function '${func.id}'. Error: ${error}`)
        if (timesTried < 10) {
          initialEvaluationTimeouts[func.id] = setTimeout(() => performInitialEvaluation(timesTried + 1), 1000)
        } else {
          console.error(`Failed to set initial value for transforming function '${func.id}'. Won't try again.`)
        }
      }
      syncDependencies()
    }
    initialEvaluationTimeouts[func.id] = setTimeout(performInitialEvaluation, 1000)

    syncDependencies()
  })
}

const deleteAllTransformingFunctionsListeners = (): void => {
  // Cancel any pending initial evaluations. Without this, a rebuild leaves stale timeouts that hold
  // an outdated function reference and later write an old value back (e.g. reverting one coordinate
  // of a just-dragged POI, since updating a function replaces its object and triggers a rebuild).
  Object.keys(initialEvaluationTimeouts).forEach((funcId) => {
    clearTimeout(initialEvaluationTimeouts[funcId])
    delete initialEvaluationTimeouts[funcId]
  })
  Object.keys(nextDelayToEvaluateFailingTransformingFunction).forEach((funcId) => {
    delete nextDelayToEvaluateFailingTransformingFunction[funcId]
    delete lastTimeTriedToEvaluateFailingTransformingFunction[funcId]
  })
  Object.keys(lastTimeTriedToEvaluateFailingTransformingFunction).forEach((funcId) => {
    delete lastTimeTriedToEvaluateFailingTransformingFunction[funcId]
  })
  Object.entries(variablesListeners).forEach(([funcId, variableListeners]) => {
    Object.entries(variableListeners).forEach(([variableId, listenerId]) => {
      unlistenDataLakeVariable(variableId, listenerId)
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
      createDataLakeVariable({ ...func })
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
  type: DataLakeVariableType,
  expression: string,
  description?: string
): void => {
  const transformingFunction: TransformingFunction = { name, id, type, expression, description }
  globalTransformingFunctions.push(transformingFunction)
  createDataLakeVariable({ id, name, type, description })
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
