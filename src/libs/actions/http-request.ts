import {
  availableCockpitActions,
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { getDataLakeVariableData, getDataLakeVariableInfo } from './data-lake'

const httpRequestActionIdPrefix = 'http-request-action'

/**
 * The types of HTTP methods that can be used.
 */
export enum HttpRequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}
export const availableHttpRequestMethods: HttpRequestMethod[] = Object.values(HttpRequestMethod)

export type HttpRequestActionConfig = {
  /**
   * The name of the action.
   */
  name: string
  /**
   * The URL to send the request to.
   */
  url: string
  /**
   * The HTTP method to use.
   */
  method: HttpRequestMethod
  /**
   * The headers to send with the request.
   */
  headers: Record<string, string>
  /**
   * The URL parameters to send with the request.
   */
  urlParams: Record<string, string>
  /**
   * The body of the request.
   */
  body: string
}

let registeredHttpRequestActionConfigs: Record<string, HttpRequestActionConfig> = {}

export const registerHttpRequestActionConfig = (action: HttpRequestActionConfig): void => {
  const id = `${httpRequestActionIdPrefix} (${action.name})`
  registeredHttpRequestActionConfigs[id] = action
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const getHttpRequestActionConfig = (id: string): HttpRequestActionConfig | undefined => {
  return registeredHttpRequestActionConfigs[id]
}

export const getAllHttpRequestActionConfigs = (): Record<string, HttpRequestActionConfig> => {
  return registeredHttpRequestActionConfigs
}

export const deleteHttpRequestActionConfig = (id: string): void => {
  delete registeredHttpRequestActionConfigs[id]
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const updateHttpRequestActionConfig = (id: string, updatedAction: HttpRequestActionConfig): void => {
  registeredHttpRequestActionConfigs[id] = updatedAction
  saveHttpRequestActionConfigs()
  updateCockpitActions()
}

export const updateCockpitActions = (): void => {
  Object.entries(availableCockpitActions).forEach(([id]) => {
    if (id.includes(httpRequestActionIdPrefix)) {
      deleteAction(id as CockpitActionsFunction)
    }
  })

  const httpResquestActions = getAllHttpRequestActionConfigs()
  for (const [id, action] of Object.entries(httpResquestActions)) {
    try {
      const cockpitAction = new CockpitAction(id as CockpitActionsFunction, action.name)
      registerNewAction(cockpitAction)
      registerActionCallback(cockpitAction, getHttpRequestActionCallback(id))
    } catch (error) {
      console.error(`Error registering action ${id}: ${error}`)
    }
  }
}

export const loadHttpRequestActionConfigs = (): void => {
  const savedActions = localStorage.getItem('cockpit-http-request-actions')
  if (savedActions) {
    registeredHttpRequestActionConfigs = JSON.parse(savedActions)
  }
}

export const saveHttpRequestActionConfigs = (): void => {
  localStorage.setItem('cockpit-http-request-actions', JSON.stringify(registeredHttpRequestActionConfigs))
}

export type HttpRequestActionCallback = () => void

export const getHttpRequestActionCallback = (id: string): HttpRequestActionCallback => {
  return () => {
    try {
      const action = getHttpRequestActionConfig(id)
      if (!action) {
        throw new Error(`Action with id ${id} not found.`)
      }

      let parsedBody = action.body
      const parsedUrlParams = { ...action.urlParams }

      // Parse body variables
      try {
        const cockpitInputsInBody = action.body.match(/{{\s*([^{}\s]+)\s*}}/g)
        if (cockpitInputsInBody) {
          for (const input of cockpitInputsInBody) {
            try {
              const parsedInput = input.replace('{{', '').replace('}}', '').trim()
              const inputData = getDataLakeVariableData(parsedInput)
              const variableInfo = getDataLakeVariableInfo(parsedInput)

              if (inputData !== undefined) {
                let valueToReplace: string

                try {
                  // Determine type either from variable info or by parsing the value
                  const type =
                    variableInfo?.type ||
                    (() => {
                      const strValue = inputData.toString().toLowerCase()
                      // Check if it's a boolean
                      if (strValue === 'true' || strValue === 'false') {
                        return 'boolean'
                      }
                      // Check if it's a number
                      if (!isNaN(Number(strValue)) && strValue !== '') {
                        return 'number'
                      }
                      return 'string'
                    })()

                  // Cast the value based on the determined type
                  switch (type) {
                    case 'number':
                    case 'boolean':
                      valueToReplace = inputData.toString()
                      // Remove quotes if they exist around the placeholder
                      parsedBody = parsedBody.replace(`"${input}"`, valueToReplace)
                      // If no quotes found, replace the placeholder directly
                      if (parsedBody.includes(input)) {
                        parsedBody = parsedBody.replace(input, valueToReplace)
                      }
                      break
                    case 'string':
                      valueToReplace = `"${inputData.toString()}"`
                      // Replace the placeholder, maintaining the quotes if they exist
                      parsedBody = parsedBody.replace(`"${input}"`, valueToReplace)
                      // If no quotes found, replace and add them
                      if (parsedBody.includes(input)) {
                        parsedBody = parsedBody.replace(input, valueToReplace)
                      }
                      break
                  }
                } catch (error) {
                  console.warn(`Error parsing value for ${input}, using as string:`, error)
                  // Fallback to string if parsing fails
                  valueToReplace = `"${inputData.toString()}"`
                  parsedBody = parsedBody.replace(input, valueToReplace)
                }
              }
            } catch (error) {
              console.warn(`Error processing body variable ${input}:`, error)
            }
          }
        }
      } catch (error) {
        console.error('Error parsing body variables:', error)
      }

      // Parse URL parameters
      try {
        const cockpitInputsInUrlParams = Object.entries(action.urlParams).filter(
          ([, value]) => typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')
        )
        if (cockpitInputsInUrlParams) {
          for (const [key, value] of cockpitInputsInUrlParams) {
            try {
              const parsedInput = value.replace('{{', '').replace('}}', '').trim()
              const inputData = getDataLakeVariableData(parsedInput)
              if (inputData) {
                parsedUrlParams[key] = inputData.toString()
              }
            } catch (error) {
              console.warn(`Error processing URL parameter ${key}:`, error)
            }
          }
        }
      } catch (error) {
        console.error('Error parsing URL parameters:', error)
      }

      // Make the request
      try {
        const url = new URL(action.url)
        url.search = new URLSearchParams(parsedUrlParams).toString()

        fetch(url, {
          method: action.method,
          headers: action.headers,
          body: action.method === HttpRequestMethod.GET ? undefined : parsedBody,
        }).catch((error) => {
          console.error('Fetch request failed:', error)
        })
      } catch (error) {
        console.error('Error making HTTP request:', error)
      }
    } catch (error) {
      console.error('Error executing HTTP request action:', error)
    }
  }
}

loadHttpRequestActionConfigs()
updateCockpitActions()
