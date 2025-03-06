import {
  availableCockpitActions,
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { replaceDataLakeInputsInJsonString, replaceDataLakeInputsInString } from '../utils-data-lake'

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

export const registerHttpRequestActionConfig = (action: HttpRequestActionConfig): string => {
  const id = `${httpRequestActionIdPrefix} (${action.name})`
  registeredHttpRequestActionConfigs[id] = action
  saveHttpRequestActionConfigs()
  updateCockpitActions()
  return id
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
      if (!action) throw new Error(`Action with id ${id} not found.`)

      // Parse the body variables
      const parsedBody = replaceDataLakeInputsInJsonString(action.body)

      // Parse the URL parameters
      const parsedUrlParams: Record<string, string> = {}
      Object.entries(action.urlParams).forEach(([key, value]) => {
        parsedUrlParams[key] = replaceDataLakeInputsInString(value)
      })

      // Parse the URL as well for any datalake variables
      const parsedUrl = replaceDataLakeInputsInString(action.url)

      // Make the request
      try {
        const url = new URL(parsedUrl)
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
