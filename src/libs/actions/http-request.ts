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
import { setDataLakeVariableData } from './data-lake'

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
  /**
   * Whether this action should populate a data lake variable with the response (GET requests only).
   */
  populateDataLake?: boolean
  /**
   * The ID of the data lake variable to populate with the response.
   */
  dataLakeVariableId?: string
  /**
   * The path to extract from the response JSON (e.g., "response.coco" or "response.xixi[2]").
   */
  responseParser?: string
}

/**
 * Parse a JSON path and extract the value from a JSON object
 * Supports paths like "response.coco", "response.xixi[2]", "response.nested.value"
 * @param obj The JSON object to extract from
 * @param path The path to extract (e.g., "response.coco" or "response.xixi[2]")
 * @returns The extracted value or undefined if not found
 */
export const parseJsonPath = (obj: any, path: string): any => {
  if (!path || !obj) return undefined

  try {
    // Remove "response." prefix if present since we're already working with the response object
    const cleanPath = path.startsWith('response.') ? path.substring('response.'.length) : path

    // Split path by dots and handle array indices
    const parts = cleanPath.split('.')
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined) return undefined

      // Handle array indices like "xixi[2]"
      const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/)
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch
        current = current[arrayName]
        if (Array.isArray(current)) {
          current = current[parseInt(index)]
        } else {
          return undefined
        }
      } else {
        current = current[part]
      }
    }

    return current
  } catch (error) {
    console.error('Error parsing JSON path:', error)
    return undefined
  }
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
        // Handle response for data lake population (GET requests only)
        if (action.populateDataLake && action.dataLakeVariableId && action.method === HttpRequestMethod.GET) {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`)
          }

          const responseData = await response.json()

          // Extract the value using the response parser
          let extractedValue = responseData
          if (action.responseParser) {
            extractedValue = parseJsonPath(responseData, action.responseParser)
          }

          // Set the data lake variable with the extracted value
          if (extractedValue !== undefined && action.dataLakeVariableId) {
            setDataLakeVariableData(action.dataLakeVariableId, extractedValue)
          }
        } else {
          // For non-data-lake requests, just catch errors
          console.error('Fetch request failed:', response.statusText)
        }
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
