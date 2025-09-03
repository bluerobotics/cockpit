import { v4 as uuid } from 'uuid'

/**
 * The type of a variable in the data lake
 */
export type DataLakeVariableType = 'string' | 'number' | 'boolean'

/**
 * A configuration for a Data Lake variable
 */
export interface DataLakeVariable {
  /**
   * The id of the variable
   */
  id: string
  /**
   * The name of the variable
   */
  name: string
  /**
   * The type of the variable
   */
  type: DataLakeVariableType
  /**
   * What the variable does or means
   */
  description?: string
  /**
   * Whether the variable existance should be persisted between boots
   */
  persistent?: boolean
  /**
   * Whether the variable's value should be persisted between boots
   */
  persistValue?: boolean
  /**
   * Whether the variable's value should be allowed to be changed by the user
   */
  allowUserToChangeValue?: boolean
}

const persistentVariablesKey = 'cockpit-persistent-data-lake-variables'
const persistentValuesKey = 'cockpit-persistent-data-lake-values'

const dataLakeVariableInfo: Record<string, DataLakeVariable> = {}
export const dataLakeVariableData: Record<string, string | number | boolean | undefined> = {}
const dataLakeVariableListeners: Record<string, Record<string, (value: string | number | boolean) => void>> = {}
const dataLakeVariableInfoListeners: Record<string, (variables: Record<string, DataLakeVariable>) => void> = {}

// Load persistent variables from localStorage on initialization
const loadPersistentVariables = (): void => {
  const savedVariables = localStorage.getItem(persistentVariablesKey)

  if (savedVariables) {
    const variables = JSON.parse(savedVariables) as DataLakeVariable[]
    variables.forEach((variable) => {
      dataLakeVariableInfo[variable.id] = variable
    })
  }

  // Load persistent values
  const savedValues = localStorage.getItem(persistentValuesKey)
  if (savedValues) {
    const values = JSON.parse(savedValues) as Record<string, string | number | boolean>
    Object.entries(values).forEach(([id, value]) => {
      // Only load values for variables that exist and have persistValue set to true
      if (dataLakeVariableInfo[id] && dataLakeVariableInfo[id].persistValue) {
        dataLakeVariableData[id] = value
      }
    })
  }
}

// Save persistent variables to localStorage
const savePersistentVariables = (): void => {
  const persistentVariables = Object.values(dataLakeVariableInfo).filter((variable) => variable.persistent)

  localStorage.setItem(persistentVariablesKey, JSON.stringify(persistentVariables))
}

// Save persistent values to localStorage
const savePersistentValues = (): void => {
  const persistentValuesObj: Record<string, string | number | boolean> = {}

  Object.entries(dataLakeVariableInfo)
    .filter(([, variable]) => variable.persistValue)
    .forEach(([id]) => {
      if (dataLakeVariableData[id] !== undefined) {
        persistentValuesObj[id] = dataLakeVariableData[id] as string | number | boolean
      }
    })

  localStorage.setItem(persistentValuesKey, JSON.stringify(persistentValuesObj))
}

export const getAllDataLakeVariablesInfo = (): Record<string, DataLakeVariable> => {
  return dataLakeVariableInfo
}

export const getDataLakeVariableInfo = (id: string): DataLakeVariable | undefined => {
  return dataLakeVariableInfo[id]
}

export const createDataLakeVariable = (variable: DataLakeVariable, initialValue?: string | number | boolean): void => {
  if (dataLakeVariableInfo[variable.id]) {
    console.warn(`Cockpit action variable with id '${variable.id}' already exists. Updating it.`)
  }
  dataLakeVariableInfo[variable.id] = variable
  dataLakeVariableData[variable.id] = initialValue

  if (variable.persistent) {
    savePersistentVariables()
  }

  if (variable.persistValue && initialValue !== undefined) {
    savePersistentValues()
  }

  notifyDataLakeVariableInfoListeners()
}

export const updateDataLakeVariableInfo = (variable: DataLakeVariable): void => {
  if (!dataLakeVariableInfo[variable.id]) {
    throw new Error(`Cockpit action variable with id '${variable.id}' does not exist. Create it first.`)
  }

  dataLakeVariableInfo[variable.id] = variable

  if (variable.persistent) {
    savePersistentVariables()
  }

  if (variable.persistValue) {
    savePersistentValues()
  }

  notifyDataLakeVariableInfoListeners()
}

export const getDataLakeVariableData = (id: string): string | number | boolean | undefined => {
  return dataLakeVariableData[id]
}

export const setDataLakeVariableData = (id: string, data: string | number | boolean): void => {
  // If the value is not changing, skip the "update"
  if (dataLakeVariableData[id] === data) {
    return
  }

  dataLakeVariableData[id] = data

  // If this variable has persistValue enabled, save the value to localStorage
  if (dataLakeVariableInfo[id]?.persistValue) {
    savePersistentValues()
  }

  notifyDataLakeVariableListeners(id)
}

export const deleteDataLakeVariable = (id: string): void => {
  const variable = dataLakeVariableInfo[id]

  delete dataLakeVariableInfo[id]
  delete dataLakeVariableData[id]

  // If variable was persistent, remove it from the storage
  if (variable && variable.persistent) {
    savePersistentVariables()
  }

  // If variable had persistValue, update the persisted values
  if (variable && variable.persistValue) {
    savePersistentValues()
  }

  notifyDataLakeVariableInfoListeners()
}

export const listenDataLakeVariable = (
  variableId: string,
  listener: (value: string | number | boolean) => void
): string => {
  if (!dataLakeVariableListeners[variableId]) {
    dataLakeVariableListeners[variableId] = {}
  }
  const listenerId = uuid()
  dataLakeVariableListeners[variableId][listenerId] = listener
  return listenerId
}

export const unlistenDataLakeVariable = (variableId: string, listenerId: string): void => {
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
    const value = dataLakeVariableData[id]
    if (value === undefined) return
    Object.values(dataLakeVariableListeners[id]).forEach((listener) => listener(value))
  }
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

const notifyDataLakeVariableInfoListeners = (): void => {
  const updatedVariables = getAllDataLakeVariablesInfo()
  Object.values(dataLakeVariableInfoListeners).forEach((listener) => listener(updatedVariables))
}

// Initialize by loading persistent variables
loadPersistentVariables()
