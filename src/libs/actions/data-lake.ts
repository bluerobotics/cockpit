import { v4 as uuid } from 'uuid'

import {
  type DataLakeVariable,
  type DataLakeVariableListener,
  type DataLakeVariableType,
  type ListenDataLakeVariableOptions,
} from '@/types/data-lake'

import { settingsManager } from '../settings-management'

export type { DataLakeVariable, DataLakeVariableListener, DataLakeVariableType, ListenDataLakeVariableOptions }

const persistentVariablesKey = 'cockpit-persistent-data-lake-variables'
const persistentValuesKey = 'cockpit-persistent-data-lake-values'

const dataLakeVariableInfo: Record<string, DataLakeVariable> = {}
const dataLakeVariableTimestamps: Record<string, number> = {}
export const dataLakeVariableData: Record<string, string | number | boolean | undefined> = {}
const dataLakeVariableListeners: Record<string, Record<string, DataLakeVariableListener>> = {}
const dataLakeVariableInfoListeners: Record<string, (variables: Record<string, DataLakeVariable>) => void> = {}

// Stored variables whose id differs from an earlier one only by leading slashes. They would share its record, so
// they are kept out of the lake and saved back untouched instead of overwriting it.
const collidingPersistentVariables: DataLakeVariable[] = []

// The id each variable was written with, by its canonical id. Records stay keyed by the written id, since those keys
// reach scripts, autocompletion and stored settings that older Cockpit versions read with an exact match.
const writtenDataLakeVariableIds: Record<string, string> = {}

/**
 * The id without leading slashes, so '/mavlink/1/1/VFR_HUD/alt' and 'mavlink/1/1/VFR_HUD/alt' name the same variable.
 * The variable itself keeps the id it was written with.
 * @param {string} id - The id as written
 * @returns {string} The id both spellings share
 */
export const canonicalDataLakeVariableId = (id: string): string => {
  return typeof id === 'string' && id.startsWith('/') ? id.replace(/^\/+/, '') : id
}

// The exact spelling is tried first, since it is what the per-message path always passes.
const writtenDataLakeVariableId = (id: string): string =>
  id in dataLakeVariableInfo || id in dataLakeVariableData
    ? id
    : writtenDataLakeVariableIds[canonicalDataLakeVariableId(id)] ?? id

/**
 * Whether two data lake variable ids name the same variable, whatever leading slashes either is written with.
 * @param {string} a - One id
 * @param {string} b - The other id
 * @returns {boolean} True when both ids name the same variable
 */
export const isSameDataLakeVariableId = (a: string, b: string): boolean =>
  canonicalDataLakeVariableId(a) === canonicalDataLakeVariableId(b)

// Load persistent variables from localStorage on initialization
const loadPersistentVariables = (): void => {
  const savedVariables = settingsManager.getKeyValue(persistentVariablesKey)

  if (savedVariables && Array.isArray(savedVariables)) {
    savedVariables.forEach((variable) => {
      // Ownership is assumed to be Cockpit's when unsaid, but only the dialogs that create a variable on the user's
      // behalf ever store one here, so an entry that predates the flag is theirs rather than Cockpit's.
      const canonicalId = canonicalDataLakeVariableId(variable.id)
      const writtenId = writtenDataLakeVariableIds[canonicalId]
      if (writtenId !== undefined && writtenId !== variable.id) {
        collidingPersistentVariables.push(variable)
        return
      }
      writtenDataLakeVariableIds[canonicalId] = variable.id
      dataLakeVariableInfo[variable.id] = { systemOwned: false, ...variable }
    })
  }
  if (collidingPersistentVariables.length > 0) {
    const ids = collidingPersistentVariables.map((variable) => `'${variable.id}'`).join(', ')
    console.warn(`Ignoring stored data lake variable(s) ${ids}, whose ids only differ from others by leading slashes.`)
  }

  // Load persistent values
  const savedValues = settingsManager.getKeyValue(persistentValuesKey)
  if (savedValues && typeof savedValues === 'object') {
    Object.entries(savedValues).forEach(([id, value]) => {
      // Only load values for variables that exist and have persistValue set to true
      if (dataLakeVariableInfo[id] && dataLakeVariableInfo[id]?.persistValue) {
        dataLakeVariableData[id] = value as string | number | boolean | undefined
      }
    })
  }
}

// Save persistent variables to localStorage
const savePersistentVariables = (): void => {
  const persistentVariables = Object.values(dataLakeVariableInfo).filter((variable) => variable?.persistent)

  settingsManager.setKeyValue(persistentVariablesKey, [...persistentVariables, ...collidingPersistentVariables])
}

const getPersistentValues = (): Record<string, string | number | boolean> => {
  return settingsManager.getKeyValue<Record<string, string | number | boolean>>(persistentValuesKey) ?? {}
}

// Save persistent values to localStorage. Merges into the stored object instead of rebuilding it, as a call made
// before every persistValue variable is registered would otherwise drop the values of the missing ones.
const savePersistentValues = (): void => {
  const persistentValuesObj = getPersistentValues()

  Object.entries(dataLakeVariableInfo)
    .filter(([, variable]) => variable?.persistValue)
    .forEach(([id]) => {
      if (dataLakeVariableData[id] !== undefined) {
        persistentValuesObj[id] = dataLakeVariableData[id] as string | number | boolean
      }
    })

  settingsManager.setKeyValue(persistentValuesKey, persistentValuesObj)
}

export const getAllDataLakeVariablesInfo = (): Record<string, DataLakeVariable> => {
  return dataLakeVariableInfo
}

export const getDataLakeVariableInfo = (id: string): DataLakeVariable | undefined => {
  return dataLakeVariableInfo[writtenDataLakeVariableId(id)]
}

export const createDataLakeVariable = (variable: DataLakeVariable, initialValue?: string | number | boolean): void => {
  // The spelling already in the lake wins, as on an update, so recreating a variable never rewrites its stored id.
  const id = (writtenDataLakeVariableIds[canonicalDataLakeVariableId(variable.id)] ??= variable.id)
  if (dataLakeVariableInfo[id]) {
    console.warn(`Cockpit action variable with id '${variable.id}' already exists. Updating it.`)
  }
  dataLakeVariableInfo[id] = id === variable.id ? variable : { ...variable, id }

  let valueToSet = initialValue
  if (variable.persistValue) {
    const savedValue = getPersistentValues()[id]
    if (savedValue !== undefined) {
      valueToSet = savedValue
    }
  }
  dataLakeVariableData[id] = valueToSet

  // Initialize timestamp if a value is being set
  if (valueToSet !== undefined) {
    dataLakeVariableTimestamps[id] = performance.now()
  }

  if (variable.persistent) {
    savePersistentVariables()
  }

  if (variable.persistValue && valueToSet !== undefined) {
    savePersistentValues()
  }

  notifyDataLakeVariableInfoListeners()
}

export const updateDataLakeVariableInfo = (variable: DataLakeVariable): void => {
  const id = writtenDataLakeVariableId(variable.id)
  if (!dataLakeVariableInfo[id]) {
    throw new Error(`Cockpit action variable with id '${variable.id}' does not exist. Create it first.`)
  }

  // The stored spelling of the id wins, so an update written without its leading slashes does not rewrite it.
  dataLakeVariableInfo[id] = { ...variable, id }

  if (variable?.persistent) {
    savePersistentVariables()
  }

  if (variable?.persistValue) {
    savePersistentValues()
  }

  notifyDataLakeVariableInfoListeners()
}

export const getDataLakeVariableData = (id: string): string | number | boolean | undefined => {
  return dataLakeVariableData[writtenDataLakeVariableId(id)]
}

export const setDataLakeVariableData = (id: string, data: string | number | boolean): void => {
  const canonicalId = canonicalDataLakeVariableId(id)
  id = writtenDataLakeVariableIds[canonicalId] ??= id
  // Always update the timestamp regardless of value change
  dataLakeVariableTimestamps[id] = performance.now()

  // If the value is not changing, skip the value "update" but notify timestamp listeners
  if (dataLakeVariableData[id] === data) {
    notifyDataLakeVariableTimestampListeners(canonicalId)
    return
  }

  dataLakeVariableData[id] = data

  // If this variable has persistValue enabled, save the value to localStorage
  if (dataLakeVariableInfo[id]?.persistValue) {
    savePersistentValues()
  }

  notifyDataLakeVariableListeners(canonicalId)
}

export const deleteDataLakeVariable = (id: string): void => {
  const canonicalId = canonicalDataLakeVariableId(id)
  id = writtenDataLakeVariableIds[canonicalId] ?? id
  const variable = dataLakeVariableInfo[id]

  delete dataLakeVariableInfo[id]
  delete dataLakeVariableData[id]
  delete dataLakeVariableTimestamps[id]
  delete writtenDataLakeVariableIds[canonicalId]

  // If variable was persistent, remove it from the storage
  if (variable && variable?.persistent) {
    savePersistentVariables()
  }

  // If variable had persistValue, update the persisted values
  if (variable && variable?.persistValue) {
    const persistentValues = getPersistentValues()
    delete persistentValues[id]
    settingsManager.setKeyValue(persistentValuesKey, persistentValues)
  }

  notifyDataLakeVariableInfoListeners()
}

export const listenDataLakeVariable = (
  variableId: string,
  listener: (value: string | number | boolean) => void,
  options?: ListenDataLakeVariableOptions
): string => {
  variableId = canonicalDataLakeVariableId(variableId)
  if (!dataLakeVariableListeners[variableId]) {
    dataLakeVariableListeners[variableId] = {}
  }
  const listenerId = uuid()
  dataLakeVariableListeners[variableId][listenerId] = {
    callback: listener,
    notifyOnTimestampChange: options?.notifyOnTimestampChange ?? false,
  }

  return listenerId
}

export const unlistenDataLakeVariable = (variableId: string, listenerId: string): void => {
  variableId = canonicalDataLakeVariableId(variableId)
  if (!dataLakeVariableListeners[variableId]) {
    console.warn(`No listeners found for variable with id '${variableId}'.`)
    return
  }
  if (!dataLakeVariableListeners[variableId][listenerId]) {
    console.warn(`No listener found with id '${listenerId}' for variable with id '${variableId}'.`)
    return
  }
  delete dataLakeVariableListeners[variableId][listenerId]
}

const notifyDataLakeVariableListeners = (id: string): void => {
  if (dataLakeVariableListeners[id]) {
    const value = dataLakeVariableData[writtenDataLakeVariableIds[id]]
    if (value === undefined) return
    Object.entries(dataLakeVariableListeners[id]).forEach(([listenerId, listener]) => {
      try {
        listener.callback(value)
      } catch (error) {
        console.error(`[DataLake] Error in listener "${listenerId}" for variable "${id}":`, error)
      }
    })
  }
}

const notifyDataLakeVariableTimestampListeners = (id: string): void => {
  if (dataLakeVariableListeners[id]) {
    const value = dataLakeVariableData[writtenDataLakeVariableIds[id]]
    if (value === undefined) return
    Object.entries(dataLakeVariableListeners[id])
      .filter(([, listener]) => listener.notifyOnTimestampChange)
      .forEach(([listenerId, listener]) => {
        try {
          listener.callback(value)
        } catch (error) {
          console.error(`[DataLake] Error in timestamp listener "${listenerId}" for variable "${id}":`, error)
        }
      })
  }
}

/**
 * Get the timestamp of the last update for a data lake variable
 * @param {string} id - The id of the variable
 * @returns {number | undefined} The timestamp (from performance.now()) or undefined if the variable has never been set
 */
export const getDataLakeVariableLastUpdateTimestamp = (id: string): number | undefined => {
  return dataLakeVariableTimestamps[writtenDataLakeVariableId(id)]
}

export const listenToDataLakeVariablesInfoChanges = (
  listener: (variables: Record<string, DataLakeVariable>) => void
): string => {
  const listenerId = uuid()
  dataLakeVariableInfoListeners[listenerId] = listener
  return listenerId
}

export const unlistenToDataLakeVariablesInfoChanges = (listenerId: string): void => {
  delete dataLakeVariableInfoListeners[listenerId]
}

// Debounce timer for variable info change notifications
let notifyInfoListenersTimeout: ReturnType<typeof setTimeout> | null = null
const notifyInfoDebounceMs = 1000

const notifyDataLakeVariableInfoListeners = (): void => {
  // Clear any pending notification
  if (notifyInfoListenersTimeout) {
    clearTimeout(notifyInfoListenersTimeout)
  }

  // Schedule a new notification after the debounce period
  notifyInfoListenersTimeout = setTimeout(() => {
    const updatedVariables = getAllDataLakeVariablesInfo()
    Object.entries(dataLakeVariableInfoListeners).forEach(([listenerId, listener]) => {
      try {
        listener(updatedVariables)
      } catch (error) {
        console.error(`[DataLake] Error in variable info listener "${listenerId}":`, error)
      }
    })
    notifyInfoListenersTimeout = null
  }, notifyInfoDebounceMs)
}

// Initialize by loading persistent variables
loadPersistentVariables()
