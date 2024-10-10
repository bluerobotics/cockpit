/**
 * A variable parameter for a Cockpit action
 * @param { string } id - The id of the variable
 * @param { string } name - The name of the variable
 * @param { 'string' | 'number' | 'boolean' } type - The type of the variable (string, number or boolean)
 * @param { string } description - What the variable does or means
 */
class CockpitActionParameter {
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

const cockpitActionParametersInfo: Record<string, CockpitActionParameter> = {}
export const cockpitActionParametersData: Record<string, string | number | boolean> = {}
const cockpitActionParametersListeners: Record<string, ((value: string | number | boolean) => void)[]> = {}

export const getCockpitActionParametersInfo = (id: string): CockpitActionParameter | undefined => {
  return cockpitActionParametersInfo[id]
}

export const getAllCockpitActionParametersInfo = (): Record<string, CockpitActionParameter> => {
  return cockpitActionParametersInfo
}

export const getCockpitActionParameterInfo = (id: string): CockpitActionParameter | undefined => {
  return cockpitActionParametersInfo[id]
}

export const setCockpitActionParameterInfo = (id: string, parameter: CockpitActionParameter): void => {
  cockpitActionParametersInfo[id] = parameter
}

export const getCockpitActionParameterData = (id: string): string | number | boolean | undefined => {
  return cockpitActionParametersData[id]
}

export const setCockpitActionParameterData = (id: string, data: string | number | boolean): void => {
  cockpitActionParametersData[id] = data
  notifyCockpitActionParameterListeners(id)
}

export const deleteCockpitActionParameter = (id: string): void => {
  delete cockpitActionParametersInfo[id]
  delete cockpitActionParametersData[id]
}

export const listenCockpitActionParameter = (
  id: string,
  listener: (value: string | number | boolean) => void
): void => {
  if (!cockpitActionParametersListeners[id]) {
    cockpitActionParametersListeners[id] = []
  }
  cockpitActionParametersListeners[id].push(listener)
}

export const unlistenCockpitActionParameter = (id: string): void => {
  delete cockpitActionParametersListeners[id]
}

const notifyCockpitActionParameterListeners = (id: string): void => {
  if (cockpitActionParametersListeners[id]) {
    const value = cockpitActionParametersData[id]
    cockpitActionParametersListeners[id].forEach((listener) => listener(value))
  }
}
