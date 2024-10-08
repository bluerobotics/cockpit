/**
 * A variable to be used on a Cockpit action
 * @param { string } id - The id of the variable
 * @param { string } name - The name of the variable
 * @param { 'string' | 'number' | 'boolean' } type - The type of the variable (string, number or boolean)
 * @param { string } description - What the variable does or means
 */
class CockpitActionVariable {
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

const cockpitActionVariableInfo: Record<string, CockpitActionVariable> = {}
export const cockpitActionVariableData: Record<string, string | number | boolean> = {}
const cockpitActionVariableListeners: Record<string, ((value: string | number | boolean) => void)[]> = {}

export const getAllCockpitActionVariablesInfo = (): Record<string, CockpitActionVariable> => {
  return cockpitActionVariableInfo
}

export const getCockpitActionVariableInfo = (id: string): CockpitActionVariable | undefined => {
  return cockpitActionVariableInfo[id]
}

export const createCockpitActionVariable = (variable: CockpitActionVariable): void => {
  if (cockpitActionVariableInfo[variable.id]) {
    throw new Error(`Cockpit action variable with id '${variable.id}' already exists. Update it instead.`)
  }
  cockpitActionVariableInfo[variable.id] = variable
}

export const updateCockpitActionVariableInfo = (variable: CockpitActionVariable): void => {
  if (!cockpitActionVariableInfo[variable.id]) {
    throw new Error(`Cockpit action variable with id '${variable.id}' does not exist. Create it first.`)
  }
  cockpitActionVariableInfo[variable.id] = variable
}

export const getCockpitActionVariableData = (id: string): string | number | boolean | undefined => {
  return cockpitActionVariableData[id]
}

export const setCockpitActionVariableData = (id: string, data: string | number | boolean): void => {
  cockpitActionVariableData[id] = data
  notifyCockpitActionVariableListeners(id)
}

export const deleteCockpitActionVariable = (id: string): void => {
  delete cockpitActionVariableInfo[id]
  delete cockpitActionVariableData[id]
}

export const listenCockpitActionVariable = (id: string, listener: (value: string | number | boolean) => void): void => {
  if (!cockpitActionVariableListeners[id]) {
    cockpitActionVariableListeners[id] = []
  }
  cockpitActionVariableListeners[id].push(listener)
}

export const unlistenCockpitActionVariable = (id: string): void => {
  delete cockpitActionVariableListeners[id]
}

const notifyCockpitActionVariableListeners = (id: string): void => {
  if (cockpitActionVariableListeners[id]) {
    const value = cockpitActionVariableData[id]
    cockpitActionVariableListeners[id].forEach((listener) => listener(value))
  }
}
