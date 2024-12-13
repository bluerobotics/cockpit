/**
 * A variable to be used on a Cockpit action
 * @param { string } id - The id of the variable
 * @param { string } name - The name of the variable
 * @param { 'string' | 'number' | 'boolean' } type - The type of the variable (string, number or boolean)
 * @param { string } description - What the variable does or means
 */
export class DataLakeVariable {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean'
  description?: string
  // eslint-disable-next-line jsdoc/require-jsdoc
  constructor(id: string, name: string, type: 'string' | 'number' | 'boolean', description?: string) {
    this.id = id
    this.name = name
    this.type = type
    this.description = description
  }
}

const dataLakeVariableInfo: Record<string, DataLakeVariable> = {}
export const dataLakeVariableData: Record<string, string | number | boolean | undefined> = {}
const dataLakeVariableListeners: Record<string, ((value: string | number | boolean) => void)[]> = {}

export const getAllDataLakeVariablesInfo = (): Record<string, DataLakeVariable> => {
  return dataLakeVariableInfo
}

export const getDataLakeVariableInfo = (id: string): DataLakeVariable | undefined => {
  return dataLakeVariableInfo[id]
}

export const createDataLakeVariable = (variable: DataLakeVariable, initialValue?: string | number | boolean): void => {
  if (dataLakeVariableInfo[variable.id]) {
    throw new Error(`Cockpit action variable with id '${variable.id}' already exists. Update it instead.`)
  }
  dataLakeVariableInfo[variable.id] = variable
  dataLakeVariableData[variable.id] = initialValue
}

export const updateDataLakeVariableInfo = (variable: DataLakeVariable): void => {
  if (!dataLakeVariableInfo[variable.id]) {
    throw new Error(`Cockpit action variable with id '${variable.id}' does not exist. Create it first.`)
  }
  dataLakeVariableInfo[variable.id] = variable
}

export const getDataLakeVariableData = (id: string): string | number | boolean | undefined => {
  return dataLakeVariableData[id]
}

export const setDataLakeVariableData = (id: string, data: string | number | boolean): void => {
  dataLakeVariableData[id] = data
  notifyDataLakeVariableListeners(id)
}

export const deleteDataLakeVariable = (id: string): void => {
  delete dataLakeVariableInfo[id]
  delete dataLakeVariableData[id]
}

export const listenDataLakeVariable = (id: string, listener: (value: string | number | boolean) => void): void => {
  if (!dataLakeVariableListeners[id]) {
    dataLakeVariableListeners[id] = []
  }
  dataLakeVariableListeners[id].push(listener)
}

export const unlistenDataLakeVariable = (id: string): void => {
  delete dataLakeVariableListeners[id]
}

const notifyDataLakeVariableListeners = (id: string): void => {
  if (dataLakeVariableListeners[id]) {
    const value = dataLakeVariableData[id]
    if (value === undefined) return
    dataLakeVariableListeners[id].forEach((listener) => listener(value))
  }
}
