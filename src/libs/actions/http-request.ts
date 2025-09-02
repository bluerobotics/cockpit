import {
  availableCockpitActions,
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { isElectron } from '../utils'
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

export type HttpRequestActionCallback = () => Promise<void>

export const getHttpRequestActionCallback = (id: string): HttpRequestActionCallback => {
  return async () => {
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

      // Find custom User-Agent header (case-insensitive)
      const userAgentEntry = Object.entries(action.headers).find(([key]) => key.toLowerCase() === 'user-agent')
      const customUserAgent = userAgentEntry?.[1]
      let userAgentChanged = false

      // Make the request
      try {
        const url = new URL(parsedUrl)

        // Preserve existing query parameters and merge with new ones
        const existingParams = new URLSearchParams(url.search)
        const newParams = new URLSearchParams(parsedUrlParams)

        // Add new parameters to existing ones (new params will override existing ones with same key)
        for (const [key, value] of newParams) {
          existingParams.set(key, value)
        }

        url.search = existingParams.toString()

        // Set custom User-Agent in Electron if specified
        if (customUserAgent && isElectron() && window.electronAPI?.setUserAgent) {
          try {
            window.electronAPI.setUserAgent(customUserAgent)
            userAgentChanged = true
          } catch (error) {
            console.warn('Failed to set custom User-Agent:', error)
          }
        }

        // Prepare headers (remove User-Agent if we set it globally in Electron)
        const fetchHeaders = { ...action.headers }
        if (userAgentChanged && userAgentEntry) {
          delete fetchHeaders[userAgentEntry[0]]
        }

        const response = await fetch(url, {
          method: action.method,
          headers: fetchHeaders,
          body: action.method === HttpRequestMethod.GET ? undefined : parsedBody,
        })

        console.log(`HTTP ${action.method} request completed: ${response.status} ${response.statusText}`)
      } catch (error) {
        console.error(`HTTP ${action.method} request failed:`, error)
      } finally {
        // Always restore the original User-Agent
        if (userAgentChanged && window.electronAPI?.restoreUserAgent) {
          try {
            window.electronAPI.restoreUserAgent()
          } catch (error) {
            console.warn('Failed to restore User-Agent:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error executing HTTP request action:', error)
    }
  }
}

loadHttpRequestActionConfigs()
updateCockpitActions()
