import { HttpRequestActionConfig, HttpRequestMethod } from '@/types/cockpit-actions'
import { ValidationFunctionReturn } from '@/types/general'

import {
  availableCockpitActions,
  CockpitAction,
  CockpitActionsFunction,
  deleteAction,
  registerActionCallback,
  registerNewAction,
} from '../joystick/protocols/cockpit-actions'
import { settingsManager } from '../settings-management'
import { isElectron } from '../utils'
import {
  findUnknownDataLakeVariablesInString,
  replaceDataLakeInputsInJsonString,
  replaceDataLakeInputsInString,
} from '../utils-data-lake'

const httpRequestActionIdPrefix = 'http-request-action'
export const availableHttpRequestMethods: HttpRequestMethod[] = Object.values(HttpRequestMethod)

let registeredHttpRequestActionConfigs: Record<string, HttpRequestActionConfig> = {}

const replaceDataLakeInputsInRecord = (record: Record<string, string>): Record<string, string> => {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, replaceDataLakeInputsInString(value)]))
}

export const validateHttpRequestHeaders = (
  headers: Record<string, unknown>
): ValidationFunctionReturn & {
  /**
   * The header input the error belongs to, so the editor can show it under that field.
   */
  field?: 'key' | 'value'
} => {
  for (const [key, value] of Object.entries(headers)) {
    // Header keys should be non-empty and contain valid characters
    const validKeyRegex = /^[a-zA-Z0-9!#$%&'*+-.^_`|~]+$/
    if (!key || !validKeyRegex.test(key)) {
      return {
        isValid: false,
        error: 'Invalid header key. Use only letters, numbers, and common punctuation. No spaces allowed.',
        field: 'key',
      }
    }

    if (typeof value !== 'string') {
      return { isValid: false, error: 'Header value must be text.', field: 'value' }
    }

    if (value.includes('\0') || value.includes('\r') || value.includes('\n')) {
      return { isValid: false, error: 'Header value cannot contain null bytes or newlines.', field: 'value' }
    }

    // Fetch converts header values to ByteString and rejects code points above 255.
    if (Array.from(value).some((character) => (character.codePointAt(0) ?? 0) > 0xff)) {
      return { isValid: false, error: 'Header value contains unsupported characters.', field: 'value' }
    }
  }

  return { isValid: true }
}

/**
 * Register a new HTTP request action config and create a cockpit action for it
 * @param {HttpRequestActionConfig} action - The action config to register
 * @param {string} customId - Optional explicit ID (e.g. from an extension manifest). Falls back to a generated ID.
 * @returns {string} The ID under which the action was registered
 */
export const registerHttpRequestActionConfig = (action: HttpRequestActionConfig, customId?: string): string => {
  const id = customId ?? `${httpRequestActionIdPrefix} (${action.name})`
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
  deleteAction(id as CockpitActionsFunction)
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

  const httpRequestActions = getAllHttpRequestActionConfigs()
  for (const [id, action] of Object.entries(httpRequestActions)) {
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
  const savedActions = settingsManager.getKeyValue('cockpit-http-request-actions')
  if (savedActions !== undefined) {
    registeredHttpRequestActionConfigs = savedActions as Record<string, HttpRequestActionConfig>
  }
}

export const saveHttpRequestActionConfigs = (): void => {
  settingsManager.setKeyValue('cockpit-http-request-actions', registeredHttpRequestActionConfigs)
}

export type HttpRequestActionCallback = () => Promise<void>

export const getHttpRequestActionCallback = (id: string): HttpRequestActionCallback => {
  return async () => {
    const action = getHttpRequestActionConfig(id)
    if (!action) throw new Error(`Action with id ${id} not found.`)

    // Parse the body variables
    const parsedBody = replaceDataLakeInputsInJsonString(action.body)

    // Parse the URL parameters
    const parsedUrlParams = replaceDataLakeInputsInRecord(action.urlParams)

    // Parse the URL as well for any datalake variables
    const parsedUrl = replaceDataLakeInputsInString(action.url)

    // Parse the header values
    const parsedHeaders = replaceDataLakeInputsInRecord(action.headers)
    const headerValidation = validateHttpRequestHeaders(parsedHeaders)
    if (!headerValidation.isValid) throw new Error(`HTTP request not sent: ${headerValidation.error}`)
    if (Object.values(parsedHeaders).some((value) => findUnknownDataLakeVariablesInString(value, []).length > 0)) {
      throw new Error('HTTP request not sent: A header value has an unresolved placeholder.')
    }

    // Find custom User-Agent header (case-insensitive)
    const userAgentEntry = Object.entries(parsedHeaders).find(([key]) => key.toLowerCase() === 'user-agent')
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
      const fetchHeaders = { ...parsedHeaders }
      if (userAgentChanged && userAgentEntry) {
        delete fetchHeaders[userAgentEntry[0]]
      }

      const response = await fetch(url, {
        method: action.method,
        headers: fetchHeaders,
        body: action.method === HttpRequestMethod.GET ? undefined : parsedBody,
      })

      console.log(`HTTP ${action.method} request completed: ${response.status} ${response.statusText}`)
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
  }
}

loadHttpRequestActionConfigs()
updateCockpitActions()
